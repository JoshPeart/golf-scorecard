import { describe, expect, it } from "vitest";
import { roundDetails, snapshotTee } from "./roundDetails";
import type { Course, Round } from "./types";
import { load, save } from "./storage";
import { vi } from "vitest";

const course: Course = {
  id: "c",
  name: "Links",
  holes: 9,
  tees: [
    {
      id: "t",
      name: "Red",
      pars: Array(9).fill(4),
      yardages: Array(9).fill(300),
    },
  ],
};
const legacy: Round = {
  id: "r",
  courseId: "c",
  teeId: "t",
  date: "2026-01-01",
  players: ["Me"],
  pars: Array(9).fill(4),
  scores: [Array(9).fill(null)],
};

describe("round tee snapshots", () => {
  it("round-trips old and snapshot rounds through the existing storage key", () => {
    let stored = "";
    vi.stubGlobal("localStorage", {
      setItem: (_key: string, value: string) => {
        stored = value;
      },
      getItem: () => stored,
    });
    try {
      const data = {
        courses: [course],
        rounds: [
          legacy,
          { ...legacy, id: "new", ...snapshotTee(course, course.tees[0]) },
        ],
      };
      expect(save(data)).toBe(true);
      expect(load()).toEqual(data);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("copies yardages without sharing mutable course data", () => {
    const snapshot = snapshotTee(course, course.tees[0]);
    expect(snapshot).toEqual({
      courseName: "Links",
      teeName: "Red",
      teeYardages: Array(9).fill(300),
    });
    expect(snapshot.teeYardages).not.toBe(course.tees[0].yardages);
  });
  it("preserves original names and yardages after deletion or renaming", () => {
    const round = { ...legacy, ...snapshotTee(course, course.tees[0]) };
    for (const changed of [
      undefined,
      { ...course, tees: [] },
      { ...course, name: "Renamed" },
      {
        ...course,
        tees: [{ ...course.tees[0], name: "Gold", yardages: [100] }],
      },
    ]) {
      expect(roundDetails(round, changed)).toEqual({
        courseName: "Links",
        teeName: "Red",
        yardages: Array(9).fill(300),
      });
    }
  });
  it("uses live yardages while the original course and tee still exist", () => {
    const round = { ...legacy, ...snapshotTee(course, course.tees[0]) };
    expect(
      roundDetails(round, {
        ...course,
        tees: [{ ...course.tees[0], yardages: [250] }],
      }).yardages,
    ).toEqual([250]);
  });
  it("keeps legacy fallbacks and handles missing optional yardages", () => {
    expect(roundDetails(legacy, course)).toEqual({
      courseName: "Links",
      teeName: "Red",
      yardages: Array(9).fill(300),
    });
    expect(roundDetails(legacy)).toEqual({
      courseName: "Deleted course",
      teeName: "Removed tee",
      yardages: undefined,
    });
    expect(
      snapshotTee(course, { ...course.tees[0], yardages: undefined })
        .teeYardages,
    ).toBeUndefined();
  });
});
