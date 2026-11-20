import { describe, expect, it } from "vitest";
import { relative, segment } from "./scoring";

describe("scoring", () => {
  it("totals strokes and compares only played holes with their own pars", () => {
    expect(segment([4, null, 3, 6], [5, 4, 3, 5])).toEqual({
      total: 13,
      toPar: 0,
      played: 3,
    });
  });
  it("handles empty and unplayed rounds", () => {
    expect(segment([], [])).toEqual({ total: 0, toPar: 0, played: 0 });
    expect(segment([null, null], [4, 5])).toEqual({
      total: 0,
      toPar: 0,
      played: 0,
    });
  });
  it("splits out and in, including null scores", () => {
    const pars = Array(18).fill(4);
    const scores = [...Array(9).fill(5), 3, ...Array(8).fill(null)];
    expect(segment(scores, pars, 0, 9)).toEqual({
      total: 45,
      toPar: 9,
      played: 9,
    });
    expect(segment(scores, pars, 9, 18)).toEqual({
      total: 3,
      toPar: -1,
      played: 1,
    });
    expect(segment(scores, pars)).toEqual({ total: 48, toPar: 8, played: 10 });
  });
  it("uses changed round pars, not a fixed course par", () => {
    expect(segment([4], [3]).toPar).toBe(1);
    expect(segment([4], [5]).toPar).toBe(-1);
  });
  it("caps ranges at the hole count for nine-hole courses", () => {
    expect(segment([3], [4], 0, 9).total).toBe(3);
    expect(segment([3], [4], 9, 18).played).toBe(0);
  });
  it("formats relative scores", () => {
    expect([relative(0), relative(2), relative(-1)]).toEqual(["E", "+2", "-1"]);
  });
});
