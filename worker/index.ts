export interface Env {
  GOLFCORE_API_KEY?: string;
  GOLFCOURSEAPI_KEY?: string;
  ALLOWED_ORIGINS?: string;
}
interface Context {
  waitUntil(promise: Promise<unknown>): void;
}

function allowedOrigin(origin: string, env: Env): boolean {
  const allowed = env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? [
    "https://joshpeart.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
  return allowed.includes(origin);
}

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: Context,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  const headers = new Headers({ Vary: "Origin" });
  if (origin && !allowedOrigin(origin, env))
    return new Response("Origin not allowed", { status: 403, headers });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  const respond = (body: BodyInit | null, status: number) =>
    new Response(body, { status, headers });
  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/(golfcore|golfcourseapi)\/v1\/(courses(?:\/[a-zA-Z0-9_-]+)?|search)$/,
  );
  if (!match) return respond("Not found", 404);
  const [, provider, path] = match;
  if (
    (provider === "golfcore" && path === "search") ||
    (provider === "golfcourseapi" && path === "courses")
  )
    return respond("Not found", 404);
  if (request.method === "OPTIONS") return respond(null, 204);
  if (request.method !== "GET") {
    headers.set("Allow", "GET, OPTIONS");
    return respond("Method not allowed", 405);
  }
  const upstream = new URL(
    `https://api.${provider === "golfcore" ? "golfcore.org" : "golfcourseapi.com"}/v1/${path}`,
  );
  const params =
    provider === "golfcore"
      ? [
          "q",
          "country",
          "region",
          "city",
          "near",
          "radius",
          "coverage",
          "limit",
          "offset",
        ]
      : ["search_query", "fuzzy_match"];
  for (const [key, value] of url.searchParams) {
    if (!params.includes(key)) return respond("Unknown query parameter", 400);
    upstream.searchParams.set(key, value);
  }
  upstream.searchParams.sort();
  const key = new Request(upstream.toString());
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cors = (response: Response) => {
    const result = new Response(response.body, response);
    for (const [name, value] of headers) result.headers.set(name, value);
    return result;
  };
  const cached = await cache.match(key);
  if (cached) return cors(cached);
  const token =
    provider === "golfcore" ? env.GOLFCORE_API_KEY : env.GOLFCOURSEAPI_KEY;
  if (provider === "golfcourseapi" && !token)
    return respond("Secondary provider is not configured", 503);
  const auth = new Headers({ Accept: "application/json" });
  if (token)
    auth.set(
      "Authorization",
      `${provider === "golfcore" ? "Bearer" : "Key"} ${token}`,
    );
  try {
    const remote = await fetch(upstream, {
      headers: auth,
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    const response = new Response(remote.body, {
      status: remote.status,
      headers: {
        "Content-Type":
          remote.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": remote.ok ? "public, max-age=86400" : "no-store",
      },
    });
    const retry = remote.headers.get("Retry-After");
    if (retry) response.headers.set("Retry-After", retry);
    if (remote.ok)
      ctx.waitUntil(cache.put(key, response.clone()).catch(() => {}));
    return cors(response);
  } catch {
    return respond("Upstream course service unavailable", 502);
  }
}

export default { fetch: handleRequest };
