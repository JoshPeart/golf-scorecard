import { describe, expect, it, vi } from "vitest";
import type { Course } from "./types";
import {
  CourseProviderError,
  type CourseProvider,
  type CourseSummary,
} from "./providers/types";
import {
  distanceMiles,
  importCourse,
  needsChecking,
  parDiffersByTee,
  searchCourses,
  searchLocal,
} from "./courseSearch";

const course: Course = {
  id: "local",
  name: "Kedleston Park Golf Club",
  holes: 18,
  source: "golfcore",
  sourceId: "kedleston-park-gc",
  lat: 52.964698,
  lng: -1.52005,
  favourite: true,
  tees: [
    {
      id: "white",
      name: "White",
      gender: "male",
      pars: Array(18).fill(4),
      yardages: Array(18).fill(300),
      strokeIndexes: Array.from({ length: 18 }, (_, i) => i + 1),
    },
  ],
};
const summary: CourseSummary = {
  provider: "golfcore",
  sourceId: course.sourceId!,
  name: course.name,
  town: "Derby",
  lat: course.lat,
  lng: course.lng,
};
function provider(
  id: CourseProvider["id"],
  rows: CourseSummary[] = [],
): CourseProvider {
  return {
    id,
    searchCourses: vi.fn().mockResolvedValue(rows),
    getCourse: vi.fn(),
  };
}

describe("local and federated course search", () => {
  it.each([
    ["Kedleston Course 1", "Kedleston Course 2", 2],
    ["Kedleston Layout 3", "Kedleston Layout 4", 2],
    ["Kedleston Layout 1", "Kedleston Layout 01", 2],
    ["Kedleston Layout 1", "Kedlston Layout 1", 1],
  ])(
    "requires exact numbers when comparing %s to %s",
    async (savedName, remoteName, count) => {
      const saved = { ...course, name: savedName };
      const remote: CourseSummary = {
        ...summary,
        provider: "golfcourseapi",
        sourceId: "other",
        name: remoteName,
      };
      const { results } = await searchCourses("Ked", {
        courses: [saved],
        providers: [provider("golfcourseapi", [remote])],
        online: true,
      });
      expect(results).toHaveLength(count);
    },
  );
  it.each([
    { tees: [] },
    { tees: [{ ...course.tees[0], pars: Array(18).fill(0) }] },
  ])(
    "does not hide online results behind an unplayable saved scorecard ($tees)",
    async ({ tees }) => {
      const saved = { ...course, tees };
      const core = provider("golfcore", [summary]);
      const { results } = await searchCourses("Ked", {
        courses: [saved],
        providers: [core],
        online: true,
      });
      expect(results).toEqual([summary]);
      const offline = await searchCourses("Ked", {
        courses: [saved],
        providers: [core],
        online: false,
      });
      expect(offline.results).toHaveLength(1);
      expect(core.searchCourses).toHaveBeenCalledTimes(1);
    },
  );
  it("matches accents, punctuation, tokens, substrings and typos without matching unrelated courses", () => {
    const courses = [
      course,
      { ...course, id: "other", name: "Royal Birkdale", address: "Southport" },
    ];
    for (const query of [
      "kedelston",
      "KÉDLESTON-PARK",
      "park kedleston",
      "ked",
      "",
    ])
      expect(searchLocal(courses, query)).toContain(course);
    expect(searchLocal(courses, "Southport")[0].id).toBe("other");
    expect(searchLocal(courses, "Carnoustie")).toEqual([]);
    expect(searchLocal([], "park")).toEqual([]);
  });
  it("returns local first, invokes providers in priority order and merges by identity or nearby similar name", async () => {
    const calls: string[] = [];
    const core = provider("golfcore", [
      summary,
      { ...summary, sourceId: "extra", name: "Kedleston Academy" },
    ]);
    const secondary = provider("golfcourseapi", [
      {
        ...summary,
        provider: "golfcourseapi",
        sourceId: "secondary",
        name: "Kedleston Park",
        lat: course.lat! + 0.001,
      },
      { ...summary, provider: "golfcourseapi", sourceId: "far", lat: 50 },
    ]);
    for (const p of [core, secondary]) {
      const original = p.searchCourses;
      p.searchCourses = async (...args) => {
        calls.push(p.id);
        return original(...args);
      };
    }
    const result = await searchCourses("Kedleston", {
      courses: [course],
      providers: [secondary, core],
      online: true,
      location: { lat: course.lat!, lng: course.lng! },
    });
    expect(calls).toEqual(["golfcore", "golfcourseapi"]);
    expect(result.results.map((r) => r.sourceId)).toEqual([
      course.sourceId,
      "extra",
      "far",
    ]);
    expect(result.results[0].distanceMiles).toBe(0);
    expect(result.errors).toEqual({});
  });
  it("merges matching towns when coordinates are unavailable but preserves different course names", async () => {
    const core = provider("golfcore", [
      { ...summary, lat: undefined, lng: undefined },
    ]);
    const secondary = provider("golfcourseapi", [
      {
        ...summary,
        lat: undefined,
        lng: undefined,
        provider: "golfcourseapi",
        sourceId: "same",
        town: "Dérby",
        name: "Kedleston Park",
      },
      {
        ...summary,
        provider: "golfcourseapi",
        sourceId: "different",
        name: "Kedleston New Course",
      },
    ]);
    const { results } = await searchCourses("Kedleston", {
      courses: [],
      providers: [core, secondary],
      online: true,
    });
    expect(results).toHaveLength(2);
  });
  it("only hides the same saved layout, keeping the online club and sibling layouts reachable", async () => {
    const saved = {
      ...course,
      name: "The Belfry – Club",
      clubName: "The Belfry",
      sourceId: "the-belfry::Club",
    };
    const club: CourseSummary = {
      ...summary,
      name: "The Belfry",
      sourceId: "the-belfry",
    };
    const derby = {
      ...club,
      name: "The Belfry – Derby",
      sourceId: "the-belfry::Derby",
    };
    const pga = {
      ...club,
      name: "The Belfry – PGA National",
      sourceId: "the-belfry::PGA%20National",
    };
    const core = provider("golfcore", [
      club,
      { ...club, name: saved.name, sourceId: saved.sourceId },
      derby,
      pga,
    ]);
    const secondary = provider("golfcourseapi", [
      { ...club, provider: "golfcourseapi", sourceId: "secondary-club" },
    ]);
    const { results, errors } = await searchCourses("Belfry", {
      courses: [saved],
      providers: [core, secondary],
      online: true,
    });
    expect(results.map((result) => result.sourceId)).toEqual([
      saved.sourceId,
      club.sourceId,
      derby.sourceId,
      pga.sourceId,
    ]);
    expect(errors).toEqual({});
    const offline = await searchCourses("Belfry", {
      courses: [saved],
      providers: [core],
      online: false,
    });
    expect(offline.results.map((result) => result.sourceId)).toEqual([
      saved.sourceId,
    ]);
    expect(core.searchCourses).toHaveBeenCalledTimes(1);
  });
  it("does not fuzzy-merge ambiguous sibling layout names or different clubs' layouts", async () => {
    const saved = {
      ...course,
      name: "The Belfry – Club",
      sourceId: "the-belfry::Club",
    };
    const sibling = {
      ...summary,
      name: "The Belfry – Golf Club",
      sourceId: "the-belfry::Golf%20Club",
    };
    const differentClub = { ...sibling, sourceId: "another-belfry::Club" };
    const { results } = await searchCourses("Belfry", {
      courses: [saved],
      providers: [provider("golfcore", [sibling, differentClub])],
      online: true,
    });
    expect(results.map((result) => result.sourceId)).toEqual([
      saved.sourceId,
      sibling.sourceId,
      differentClub.sourceId,
    ]);
  });
  it.each([
    { offset: 0.001, count: 1 },
    { offset: 1, count: 2 },
  ])(
    "merges cross-provider layout copies only when nearby ($offset degree offset)",
    async ({ offset, count }) => {
      const saved = {
        ...course,
        name: "The Belfry – Derby",
        clubName: "The Belfry",
        sourceId: "the-belfry::Derby",
      };
      const copy: CourseSummary = {
        ...summary,
        provider: "golfcourseapi",
        name: "The Belfry Derby",
        sourceId: "secondary-derby",
        lat: course.lat! + offset,
      };
      const { results, errors } = await searchCourses("Belfry", {
        courses: [saved],
        providers: [provider("golfcourseapi", [copy])],
        online: true,
      });
      expect(results).toHaveLength(count);
      expect(results[0].sourceId).toBe(saved.sourceId);
      expect(errors).toEqual({});
      if (count === 2) expect(results[1].sourceId).toBe(copy.sourceId);
    },
  );
  it("is local-only offline or for blank queries and keeps provider errors separate", async () => {
    const core = provider("golfcore");
    for (const [query, online] of [
      ["Kedleston", false],
      ["", true],
    ] as const) {
      const result = await searchCourses(query, {
        courses: [course],
        providers: [core],
        online,
      });
      expect(result.results).toHaveLength(1);
    }
    expect(core.searchCourses).not.toHaveBeenCalled();
    const secondary = provider("golfcourseapi", [
      { ...summary, provider: "golfcourseapi" },
    ]);
    vi.mocked(core.searchCourses).mockRejectedValue(
      new CourseProviderError("golfcore", "http", "Quota", 429),
    );
    const result = await searchCourses("Kedleston", {
      courses: [],
      providers: [core, secondary],
      online: true,
    });
    expect(result.results).toHaveLength(1);
    expect(result.errors.golfcore).toMatchObject({ status: 429 });
    expect(result.errors.golfcourseapi).toBeUndefined();
  });
  it("uses haversine miles", () => {
    expect(distanceMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(
      69.093,
      2,
    );
    expect(
      distanceMiles({ lat: 90, lng: 0 }, { lat: -90, lng: 180 }),
    ).toBeCloseTo(12436.8, 0);
  });
});

describe("course quality and import", () => {
  it("reports all requested quality checks and compares only known pars", () => {
    expect(needsChecking(course)).toEqual([]);
    expect(needsChecking({ ...course, holes: 9, tees: [] })).toEqual([
      "No tees",
      "Fewer than 18 holes",
    ]);
    const incomplete = {
      ...course,
      tees: [
        {
          ...course.tees[0],
          pars: [4, 0],
          yardages: [null],
          strokeIndexes: undefined,
        },
      ],
    };
    expect(needsChecking(incomplete)).toEqual([
      "Unexpected hole count",
      "Missing yardages",
      "Missing pars",
      "Missing stroke indexes",
    ]);
    expect(parDiffersByTee(course, 0)).toBe(false);
    expect(
      parDiffersByTee(
        { ...course, tees: [...course.tees, { ...course.tees[0], pars: [5] }] },
        0,
      ),
    ).toBe(true);
    expect(
      parDiffersByTee(
        { ...course, tees: [...course.tees, { ...course.tees[0], pars: [0] }] },
        0,
      ),
    ).toBe(false);
    expect(parDiffersByTee(course, -1)).toBe(false);
  });
  it("appends fetched courses; refreshes keep IDs, favourites and matched tee identities", () => {
    const fetched = {
      ...course,
      id: "fetched",
      name: "Updated",
      favourite: false,
      tees: [
        {
          ...course.tees[0],
          id: "new-id",
          name: "WHITE",
          pars: Array(18).fill(5),
        },
      ],
    };
    expect(importCourse([], fetched)).toEqual([fetched]);
    const existing = [course];
    const refreshed = importCourse(existing, fetched)[0];
    expect(refreshed).toMatchObject({
      id: "local",
      favourite: true,
      name: "Updated",
    });
    expect(refreshed.tees[0]).toMatchObject({
      id: "white",
      pars: Array(18).fill(5),
    });
    expect(existing[0].tees[0].pars[0]).toBe(4);
    expect(
      importCourse(existing, { ...fetched, sourceId: "different" }),
    ).toHaveLength(2);
    expect(
      importCourse(existing, { ...fetched, sourceId: undefined }),
    ).toHaveLength(2);
  });
  it("never replaces customised courses or matches tee IDs across genders", () => {
    const existing = [{ ...course, customised: true }];
    expect(importCourse(existing, { ...course, name: "Remote" })).toBe(
      existing,
    );
    const fetched = {
      ...course,
      tees: [{ ...course.tees[0], id: "female", gender: "female" as const }],
    };
    expect(importCourse([course], fetched)[0].tees[0].id).toBe("female");
  });
});
