import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type Env } from "./index";

const pending: Promise<unknown>[] = [];
const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p) };
const contents = new Map<string, Response>();
const cache = {
  match: vi.fn(async (key: Request) => contents.get(key.url)?.clone()),
  put: vi.fn(async (key: Request, response: Response) => {
    contents.set(key.url, response.clone());
  }),
};
function request(path: string, init: RequestInit = {}, env: Env = {}) {
  return handleRequest(
    new Request(`https://worker.example${path}`, {
      headers: { Origin: "https://joshpeart.github.io" },
      ...init,
    }),
    env,
    ctx,
  );
}
beforeEach(() => {
  pending.length = 0;
  contents.clear();
  vi.clearAllMocks();
  vi.stubGlobal("caches", { default: cache });
});
afterEach(() => vi.unstubAllGlobals());

describe("course Worker", () => {
  it("restricts routes, methods and exact origins without contacting providers", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect((await request("/other")).status).toBe(404);
    expect((await request("/golfcore/v1/search")).status).toBe(404);
    expect((await request("/golfcourseapi/v1/courses")).status).toBe(404);
    expect(
      (await request("/golfcore/v1/courses", { method: "POST" })).status,
    ).toBe(405);
    expect(
      (
        await request("/golfcore/v1/courses", {
          headers: { Origin: "https://joshpeart.github.io.evil.example" },
        })
      ).status,
    ).toBe(403);
    const preflight = await request("/golfcore/v1/courses", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    const custom = await request(
      "/golfcore/v1/courses",
      { method: "OPTIONS", headers: { Origin: "https://app.example" } },
      { ALLOWED_ORIGINS: "https://app.example" },
    );
    expect(custom.status).toBe(204);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("injects only server secrets and caches successful responses for a day without origin leakage", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('{"courses":[]}', {
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const first = await request(
      "/golfcore/v1/courses?q=park&country=gb",
      {
        headers: {
          Origin: "https://joshpeart.github.io",
          Authorization: "client-secret",
        },
      },
      { GOLFCORE_API_KEY: "server-secret" },
    );
    await Promise.all(pending);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.golfcore.org/v1/courses?country=gb&q=park",
    );
    expect(options.headers.get("Authorization")).toBe("Bearer server-secret");
    expect(cache.put).toHaveBeenCalledOnce();
    expect(cache.put.mock.calls[0][0].headers.has("Authorization")).toBe(false);
    expect(first.headers.get("Cache-Control")).toContain("86400");
    const next = await request("/golfcore/v1/courses?country=gb&q=park", {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(next.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(await next.json()).toEqual({ courses: [] });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("uses Key for GolfCourseAPI and omits GolfCore Authorization when unset", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await request("/golfcourseapi/v1/search?search_query=park")).status,
    ).toBe(503);
    await request(
      "/golfcourseapi/v1/courses/7k2m9qb4",
      {},
      { GOLFCOURSEAPI_KEY: "secondary-secret" },
    );
    expect(fetcher.mock.calls[0][1].headers.get("Authorization")).toBe(
      "Key secondary-secret",
    );
    await request("/golfcore/v1/courses/park");
    expect(fetcher.mock.calls[1][1].headers.has("Authorization")).toBe(false);
  });
  it("does not cache upstream errors; handles failures and refuses unknown query params", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("quota", {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
      )
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const quota = await request("/golfcore/v1/courses?q=park");
    expect(quota.status).toBe(429);
    expect(quota.headers.get("Retry-After")).toBe("60");
    expect(quota.headers.get("Cache-Control")).toBe("no-store");
    expect((await request("/golfcore/v1/courses?q=park")).status).toBe(502);
    expect(
      (await request("/golfcore/v1/courses?url=https://evil.example")).status,
    ).toBe(400);
    expect(cache.put).not.toHaveBeenCalled();
  });
});
