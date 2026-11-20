import { describe, expect, it } from "vitest";
import type { Course, Round, Tee } from "./types";
import { createRound, switchTee } from "./rounds";

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
    expect(
      switchTee({ ...round, startHole: 9 }, tee, 2).pars,
    ).toEqual([6, 6, 6, 6]);
    expect(switchTee({ ...round, startHole: 9 }, tee, 1).pars).toEqual([
      6, 5, 6, 6,
    ]);
  });
  it("supports legacy offsets, empty rounds and missing new tee pars", () => {
    expect(switchTee(round, tee, 0).pars).toEqual([
      4, 4, 6, 6,
    ]);
    expect(switchTee({ ...round, pars: [], scores: [[]] }, tee, 0).pars).toEqual(
      [],
    );
    expect(switchTee(round, { ...tee, pars: [] }, 1).pars).toEqual(round.pars);
  });
});
