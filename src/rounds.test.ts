import { describe, expect, it } from "vitest";
import type { Course, Round, Tee } from "./types";
import { createRound, roundTees, switchTee } from "./rounds";
import { roundDetails } from "./roundDetails";

it("snapshots SI for the selected nine and clears it on switching to a legacy tee", () => {
  const indexes = Array.from({ length: 18 }, (_, i) => i + 1);
  const tee = {
    id: "si",
    name: "White",
    pars: Array(18).fill(4),
    strokeIndexes: indexes,
  };
  const course = { id: "c", name: "Course", holes: 18 as const, tees: [tee] };
  const round = createRound(course, tee, ["Me"], "back");
  expect(round.teeStrokeIndexes).toEqual(indexes.slice(9));
  indexes[9] = 1;
  expect(round.teeStrokeIndexes![0]).toBe(10);
  expect(
    switchTee(round, { ...tee, strokeIndexes: undefined }, 0).teeStrokeIndexes,
  ).toBeUndefined();
});

const tee: Tee = {
  id: "yellow",
  name: "Yellow",
  pars: [...Array(9).fill(4), ...Array(9).fill(5)],
};
const course: Course = {
  id: "course",
  name: "Meadowbrook",
  holes: 18,
  tees: [tee],
};

describe("round creation", () => {
  it("snapshots only the played nine's yardages", () => {
    const withYards = {
      ...tee,
      yardages: Array.from({ length: 18 }, (_, i) => 300 + i),
    };
    for (const length of ["front", "back"] as const) {
      const round = createRound(course, withYards, ["Me"], length);
      const expected = withYards.yardages.slice(
        length === "back" ? 9 : 0,
        length === "back" ? 18 : 9,
      );
      expect(round.teeYardages).toEqual(expected);
      expect(roundDetails(round).yardages).toEqual(expected);
      expect(
        roundDetails(round, { ...course, tees: [withYards] }).yardages,
      ).toEqual(expected);
    }
    expect(
      createRound({ ...course, holes: 9 }, withYards, ["Me"]).teeYardages,
    ).toHaveLength(9);
  });
  it("defaults to all 18 holes and independent blank player scores", () => {
    const round = createRound(course, tee, ["Me", "Alex"]);
    expect(round.startHole).toBe(0);
    expect(round.pars).toEqual(tee.pars);
    expect(round.pars).not.toBe(tee.pars);
    expect(round.scores).toEqual([Array(18).fill(null), Array(18).fill(null)]);
    expect(round.scores[0]).not.toBe(round.scores[1]);
  });
  it("slices front and back nines with a course-hole offset", () => {
    const front = createRound(course, tee, ["Me"], "front");
    const back = createRound(course, tee, ["Me"], "back");
    expect(front.startHole).toBe(0);
    expect(front.pars).toEqual(Array(9).fill(4));
    expect(back.startHole).toBe(9);
    expect(back.pars).toEqual(Array(9).fill(5));
    expect(back.scores).toEqual([Array(9).fill(null)]);
  });
  it("always starts nine-hole courses at hole 1", () => {
    const round = createRound({ ...course, holes: 9 }, tee, ["Me"], "back");
    expect(round.startHole).toBe(0);
    expect(round.pars).toEqual(Array(9).fill(4));
  });
});

describe("tee switching", () => {
  it("only offers and accepts tees in the snapshotted routing, even after tee removal", () => {
    const white = { ...tee, layoutId: "Brabazon" };
    const red = { ...white, id: "red" };
    const other = { ...white, id: "other", layoutId: "PGA National" };
    const club = { ...course, tees: [white, red, other] };
    const round = createRound(club, white, ["Me"]);
    expect(round.teeLayoutId).toBe("Brabazon");
    expect(roundTees(round, club)).toEqual([white, red]);
    expect(roundTees(round, { ...club, tees: [red, other] })).toEqual([red]);
    expect(switchTee(round, other, 0, club)).toBe(round);
    expect(switchTee(round, red, 0, club).teeId).toBe("red");
    expect(roundTees({ ...round, teeLayoutId: undefined }, club)).toEqual([
      white,
      red,
    ]);
    expect(roundTees(round, { ...club, tees: [] })).toEqual([]);
  });
  it("starts a nine-hole routing at hole one in a mixed eighteen-hole club", () => {
    const nine = { ...tee, layoutId: "Balgove", pars: Array(9).fill(3) };
    const round = createRound(course, nine, ["Me"], "back");
    expect(round.pars).toHaveLength(9);
    expect(round.scores[0]).toHaveLength(9);
    expect(round.startHole).toBe(0);
  });
  it("refreshes snapshots for the switched tee and course without changing scores", () => {
    const original = createRound(course, tee, ["Me"], "back");
    original.scores[0][0] = 4;
    const nextTee = {
      ...tee,
      id: "red",
      name: "Red",
      yardages: Array.from({ length: 18 }, (_, i) => 200 + i),
    };
    const renamed = { ...course, name: "Renamed course", tees: [nextTee] };
    const next = switchTee(original, nextTee, 1, renamed);
    expect(next.courseName).toBe("Renamed course");
    expect(next.teeName).toBe("Red");
    expect(next.teeYardages).toEqual(nextTee.yardages.slice(9));
    expect(next.teeYardages).not.toBe(nextTee.yardages);
    expect(next.scores).toBe(original.scores);
    expect(roundDetails(next)).toEqual({
      courseName: "Renamed course",
      teeName: "Red",
      yardages: nextTee.yardages.slice(9),
    });
    expect(switchTee(next, tee, 1, course).teeYardages).toBeUndefined();
  });
  const round: Round = {
    id: "round",
    courseId: course.id,
    teeId: tee.id,
    date: "2026-01-01",
    players: ["Me", "Alex"],
    pars: [6, 6, 6, 6],
    scores: [
      [null, null, null, 4],
      [null, null, 5, null],
    ],
  };
  it("replaces only unscored pars at or after the current hole", () => {
    const next = switchTee(round, { ...tee, id: "red" }, 1);
    expect(next.teeId).toBe("red");
    expect(next.pars).toEqual([6, 4, 6, 6]);
    expect(next.scores).toBe(round.scores);
    expect(round.pars).toEqual([6, 6, 6, 6]);
  });
  it("preserves a scored current hole and respects back-nine offsets", () => {
    expect(switchTee({ ...round, startHole: 9 }, tee, 2).pars).toEqual([
      6, 6, 6, 6,
    ]);
    expect(switchTee({ ...round, startHole: 9 }, tee, 1).pars).toEqual([
      6, 5, 6, 6,
    ]);
  });
  it("supports legacy offsets, empty rounds and missing new tee pars", () => {
    expect(switchTee(round, tee, 0).pars).toEqual([4, 4, 6, 6]);
    expect(
      switchTee({ ...round, pars: [], scores: [[]] }, tee, 0).pars,
    ).toEqual([]);
    expect(switchTee(round, { ...tee, pars: [] }, 1).pars).toEqual(round.pars);
  });
});
