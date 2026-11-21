import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GolfCoreProvider,
  GolfCourseAPIProvider,
  CourseProviderError,
} from "./index";
import {
  golfcoreDetail,
  golfcoreSearch,
  golfcourseapiDetail,
} from "./fixtures/courses";
import { needsChecking, parDiffersByTee } from "../courseSearch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function respond(data: unknown) {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("GolfCore provider", () => {
  it("uses the Worker URL, location and country filter; maps search summaries", async () => {
    vi.stubEnv("VITE_COURSE_API_URL", "https://courses.example/");
    const fetcher = respond(golfcoreSearch);
    const result = await new GolfCoreProvider().searchCourses("St Andrews", {
      lat: 56,
      lng: -2,
    });
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(
      "https://courses.example/golfcore/v1/courses",
    );
    expect(url.searchParams.get("country")).toBe("gb");
    expect(url.searchParams.get("near")).toBe("56,-2");
    expect(result[0]).toMatchObject({
      provider: "golfcore",
      sourceId: "st-andrews-old-course",
      town: "Saint Andrews",
      distanceMiles: 0,
    });
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
  });
  it("paginates and supports empty searches, keylessly without the Worker", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...golfcoreSearch, total: 2 })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...golfcoreSearch, total: 2, offset: 1 }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 0, offset: 0, courses: [] })),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await new GolfCoreProvider("").searchCourses("Old")).toHaveLength(2);
    expect(fetcher.mock.calls[1][0]).toContain("offset=1");
    expect(fetcher.mock.calls[0][0]).toMatch(
      /^https:\/\/api.golfcore.org\/v1\/courses/,
    );
    expect(await new GolfCoreProvider("").searchCourses("absent")).toEqual([]);
  });
  it("maps actual per-tee par, SI, ratings, colour and source, with null missing distances", async () => {
    const raw = structuredClone(golfcoreDetail);
    delete (raw.layouts[0].tees[0].holes[2] as { yards?: number }).yards;
    delete (raw.layouts[0].tees[0].holes[2] as { stroke_index?: number })
      .stroke_index;
    respond(raw);
    const course = await new GolfCoreProvider("").getCourse(
      golfcoreDetail.slug,
    );
    expect(course).toMatchObject({
      name: golfcoreDetail.name,
      source: "golfcore",
      sourceId: golfcoreDetail.slug,
      sourceUrl: golfcoreDetail.url,
      verified: false,
      holes: 18,
    });
    expect(new Date(course.lastSyncedAt!).toISOString()).toBe(
      course.lastSyncedAt,
    );
    expect(course.tees[0]).toMatchObject({
      color: "black",
      gender: "male",
      courseRating: 73.4,
      slope: 136,
      totalYardage: 6670,
    });
    expect(course.tees[0].yardages!.slice(0, 3)).toEqual([367, 400, null]);
    expect(course.tees[0].strokeIndexes!.slice(0, 3)).toEqual([11, 3, null]);
    expect(parDiffersByTee(course, 1)).toBe(true);
    expect(needsChecking(course)).not.toContain("Missing pars");
  });
  it("prefixes multiple layouts, drops empty/no-par tees and flags nonstandard counts", async () => {
    const original = golfcoreDetail.layouts[0];
    const layout = {
      ...original,
      holes: original.holes.slice(0, 10),
      tees: original.tees.map((t) => ({ ...t, holes: t.holes.slice(0, 10) })),
    };
    respond({
      ...golfcoreDetail,
      hole_count: 10,
      layouts: [
        {
          ...layout,
          name: "Main",
          holes: Array(10).fill({}),
          tees: [
            layout.tees[0],
            { name: "Empty", holes: [] },
            { name: "No pars", holes: [{ position: 1, par: null }] },
          ],
        },
        { ...layout, name: "Alternate" },
      ],
    });
    const course = await new GolfCoreProvider("").getCourse("sample");
    expect(course.holes).toBe(9);
    expect(course.tees).toHaveLength(3);
    expect(course.tees[0].name).toBe("Main — Black");
    expect(course.tees[1].name).toBe("Alternate — Black");
    expect(course.tees[0].layoutId).not.toBe(course.tees[1].layoutId);
    expect(needsChecking(course)).toContain("Unexpected hole count");
  });
  it("handles a course with no layouts or tees", async () => {
    respond({ ...golfcoreDetail, layouts: [] });
    expect((await new GolfCoreProvider("").getCourse("empty")).tees).toEqual(
      [],
    );
  });
  it("uses a complete nine-hole layout instead of the club's eighteen-hole summary", async () => {
    const raw = structuredClone(golfcoreDetail);
    raw.layouts[0].holes = raw.layouts[0].holes.slice(0, 9);
    raw.layouts[0].tees.forEach((t) => {
      t.holes = t.holes.slice(0, 9);
    });
    respond(raw);
    const course = await new GolfCoreProvider("").getCourse("balgove");
    expect(course.holes).toBe(9);
    expect(course.tees).toHaveLength(2);
    expect(course.tees[0].pars).toHaveLength(9);
    raw.layouts[0].holes = [];
    respond(raw);
    expect((await new GolfCoreProvider("").getCourse("balgove")).holes).toBe(9);
  });
  it("drops a tee with even one missing par and flags a course if none remain", async () => {
    const raw = structuredClone(golfcoreDetail);
    raw.layouts[0].tees.forEach((t) => {
      t.holes[7].par = 0;
    });
    respond(raw);
    const course = await new GolfCoreProvider("").getCourse("incomplete");
    expect(course.tees).toEqual([]);
    expect(needsChecking(course)).toContain("No tees");
  });
});

describe("GolfCourseAPI provider", () => {
  it("is disabled without a Worker URL and never sends a key from the browser", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const provider = new GolfCourseAPIProvider("");
    expect(await provider.searchCourses("Park")).toEqual([]);
    await expect(provider.getCourse("id")).rejects.toMatchObject({
      kind: "disabled",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("maps the documented search location and detail tee shapes", async () => {
    const provider = new GolfCourseAPIProvider("https://worker.example");
    const fetcher = respond({
      courses: [
        {
          ...golfcourseapiDetail,
          location: { ...golfcourseapiDetail.location, country: "Scotland" },
        },
      ],
    });
    const summaries = await provider.searchCourses("Murray");
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://worker.example/golfcourseapi/v1/search?search_query=Murray",
    );
    expect(summaries[0]).toMatchObject({
      town: "Murray",
      lat: 36.6103,
      lng: -88.3148,
      clubName: "Murray Golf Club",
    });
    const raw = structuredClone(golfcourseapiDetail);
    raw.tees.male[0].holes = Array.from(
      { length: 18 },
      (_, i) => raw.tees.male[0].holes[i % 2],
    );
    respond(raw);
    const course = await provider.getCourse("7k2m9qb4");
    expect(course.tees[0]).toMatchObject({
      gender: "male",
      name: "Blue",
      color: "blue",
      courseRating: 75.7,
      slope: 132,
    });
    expect(course.tees[0].strokeIndexes!.slice(0, 3)).toEqual([9, 17, 9]);
    expect(course.tees[0].pars.slice(0, 3)).toEqual([4, 3, 4]);
    expect(course.source).toBe("golfcourseapi");
  });
  it("returns empty results and maps missing location/empty tees", async () => {
    const provider = new GolfCourseAPIProvider("https://worker.example");
    respond({ courses: [] });
    expect(await provider.searchCourses("absent")).toEqual([]);
    respond({ ...golfcourseapiDetail, location: {}, tees: {} });
    expect(await provider.getCourse("sample")).toMatchObject({
      tees: [],
      lat: undefined,
    });
  });
  it("accepts UK country names/codes and rejects overseas, missing and similarly named countries", async () => {
    const countries = [
      "GB",
      "UK",
      "GBR",
      "United Kingdom",
      "England",
      "scotland",
      "Wales",
      "Northern Ireland",
      "Great Britain",
      "United Kingdom of Great Britain and Northern Ireland",
      "U.K.",
      " gb ",
      "GB-ENG",
      "GB-SCT",
      "GB-WLS",
      "GB-NIR",
      "United States",
      "Republic of Ireland",
      "Guernsey",
      undefined,
      "New England",
      "British Virgin Islands",
    ];
    respond({
      courses: countries.map((country, i) => ({
        ...golfcourseapiDetail,
        id: String(i),
        location: { country },
      })),
    });
    const results = await new GolfCourseAPIProvider(
      "https://worker.example",
    ).searchCourses("Park");
    expect(results.map((r) => r.sourceId)).toEqual(
      Array.from({ length: 16 }, (_, i) => String(i)),
    );
    respond({
      courses: [
        golfcourseapiDetail,
        { ...golfcourseapiDetail, location: undefined },
      ],
    });
    expect(
      await new GolfCourseAPIProvider("https://worker.example").searchCourses(
        "Park",
      ),
    ).toEqual([]);
  });
  it("drops incomplete scorecards rather than inventing a missing par", async () => {
    respond(golfcourseapiDetail);
    const course = await new GolfCourseAPIProvider(
      "https://worker.example",
    ).getCourse("incomplete");
    expect(course.tees).toEqual([]);
    expect(needsChecking(course)).toContain("No tees");
  });
});

describe("typed provider failures", () => {
  it("classifies HTTP, JSON, shape and network errors", async () => {
    const provider = new GolfCoreProvider("");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("quota", { status: 429 })),
    );
    await expect(provider.searchCourses("park")).rejects.toMatchObject({
      provider: "golfcore",
      kind: "http",
      status: 429,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(provider.searchCourses("park")).rejects.toMatchObject({
      kind: "invalid",
    });
    respond({ courses: "bad" });
    await expect(provider.searchCourses("park")).rejects.toBeInstanceOf(
      CourseProviderError,
    );
    respond({ layouts: [], name: "Missing slug" });
    await expect(provider.getCourse("bad")).rejects.toMatchObject({
      kind: "invalid",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(provider.getCourse("park")).rejects.toMatchObject({
      kind: "network",
    });
  });
  it("aborts after ten seconds with a typed timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    const expectation = expect(
      new GolfCoreProvider("").searchCourses("park"),
    ).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(10_000);
    await expectation;
  });
});
