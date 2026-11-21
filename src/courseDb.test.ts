import { describe, expect, it } from "vitest";
import { fromTables, toTables } from "./courseDb";
import type { Course } from "./types";

const course: Course = {
  id: "c",
  name: "Park",
  holes: 9,
  clubName: "Park Club",
  address: "Street",
  postcode: "DE1 1AA",
  lat: 52,
  lng: -1,
  country: "gb",
  source: "golfcore",
  sourceId: "park",
  sourceUrl: "https://www.golfcore.org/courses/park/",
  lastSyncedAt: "2026-11-21T00:00:00.000Z",
  verified: false,
  customised: true,
  favourite: true,
  tees: ["male", "female"].map((gender, i) => ({
    id: `t${i}`,
    name: "White",
    color: "white",
    gender: gender as "male" | "female",
    courseRating: 70 + i,
    slope: 120,
    totalYardage: 3000,
    pars: Array(9).fill(4 + i),
    yardages: [null, ...Array(8).fill(300)],
    strokeIndexes: Array.from({ length: 9 }, (_, n) => (i ? 9 - n : n + 1)),
  })),
};

describe("normalized course tables", () => {
  it("round trips separate nine- and eighteen-hole layout courses", () => {
    const eighteen = {
      ...course,
      id: "other",
      holes: 18 as const,
      sourceId: "park::Main",
      name: "Park – Main",
      tees: course.tees.map((t) => ({
        ...t,
        id: `other-${t.id}`,
        pars: Array(18).fill(4),
        yardages: Array(18).fill(300),
        strokeIndexes: Array.from({ length: 18 }, (_, i) => i + 1),
      })),
    };
    const courses = [course, eighteen];
    expect(fromTables(toTables(courses))).toEqual(courses);
  });
  it("round trips metadata, flags, tees and tee-specific pars/SI", () => {
    const tables = toTables([course]);
    expect(tables.courses[0]).toMatchObject({
      source_url: course.sourceUrl,
      hole_count: 9,
      customised: true,
    });
    expect(tables.holes[0].stroke_index).toBe(1);
    expect(tables.tee_holes[9].stroke_index).toBe(9);
    tables.tee_holes.reverse();
    expect(fromTables(tables)).toEqual([course]);
  });
  it("uses the first complete SI tee, otherwise null", () => {
    const changed = structuredClone(course);
    changed.tees[0].strokeIndexes![0] = null;
    expect(toTables([changed]).holes[0].stroke_index).toBe(9);
    changed.tees[1].strokeIndexes = undefined;
    expect(
      toTables([changed]).holes.every((h) => h.stroke_index === null),
    ).toBe(true);
  });
  it("supports empty tables and canonicalizes legacy missing fields without inventing pars", () => {
    expect(fromTables(toTables([]))).toEqual([]);
    const old = {
      id: "old",
      name: "Old",
      holes: 9 as const,
      tees: [{ id: "old-tee", name: "White", pars: [] }],
    };
    const restored = fromTables(toTables([old]))[0];
    expect(restored.source).toBeUndefined();
    expect(restored.tees[0].pars).toEqual(Array(9).fill(0));
    expect(restored.tees[0].strokeIndexes).toEqual(Array(9).fill(null));
    expect(toTables([restored])).toEqual(
      toTables(fromTables(toTables([restored]))),
    );
  });
});
