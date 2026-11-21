import { afterEach, describe, expect, it, vi } from "vitest";
import {
  load,
  save,
  loadActiveRound,
  saveActiveRound,
  defaultRoundLocation,
} from "./storage";
import type { Store } from "./types";
afterEach(() => vi.unstubAllGlobals());
describe("versioned storage", () => {
  it("migrates legacy courses without touching rounds or overwriting provider metadata", () => {
    const round = { id: "legacy-round", pars: [4], teeYardages: [300] };
    const data = {
      courses: [
        { id: "manual", name: "Manual", holes: 9, tees: [] },
        {
          id: "remote",
          name: "Remote",
          holes: 18,
          tees: [],
          source: "golfcore",
          verified: true,
          favourite: true,
        },
      ],
      rounds: [round],
    };
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(data) });
    const loaded = load();
    expect(loaded.courses[0]).toMatchObject({
      source: "manual",
      verified: false,
    });
    expect(loaded.courses[1]).toEqual(data.courses[1]);
    expect(loaded.rounds).toEqual([round]);
  });
  it("returns an empty notebook without saved data", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(load()).toEqual({ courses: [], rounds: [] });
  });
  it("loads and saves using the v1 key", () => {
    const data = { courses: [], rounds: [] };
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(data),
      setItem,
    });
    expect(load()).toEqual(data);
    expect(save(data)).toBe(true);
    expect(setItem).toHaveBeenCalledWith(
      "golf-scorecard:v1",
      JSON.stringify(data),
    );
  });
  it("handles malformed data and unavailable storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "{",
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    });
    expect(load()).toEqual({ courses: [], rounds: [] });
    expect(save({ courses: [], rounds: [] })).toBe(false);
  });
});
describe("active round storage", () => {
  const data: Store = {
    courses: [],
    rounds: [
      {
        id: "round",
        courseId: "course",
        teeId: "tee",
        date: "2026-11-20",
        players: ["Me"],
        pars: [4, 4, 4, 4],
        scores: [[null, null, null, null]],
      },
    ],
  };
  it("restores the round, hole and either tab", () => {
    for (const summary of [false, true]) {
      const active = { roundId: "round", hole: 3, summary };
      const setItem = vi.fn();
      vi.stubGlobal("localStorage", {
        getItem: () => JSON.stringify(active),
        setItem,
      });
      expect(loadActiveRound(data)).toEqual(active);
      expect(saveActiveRound(active)).toBe(true);
      expect(setItem).toHaveBeenCalledWith(
        "golf-scorecard:active:v1",
        JSON.stringify(active),
      );
    }
  });
  it("defaults to the first hole unscored by any player, or summary when complete", () => {
    expect(defaultRoundLocation(data.rounds[0])).toEqual({
      roundId: "round",
      hole: 0,
      summary: false,
    });
    const round = {
      ...data.rounds[0],
      scores: [
        [4, 4, 4, null],
        [4, null, 4, null],
      ],
    };
    expect(defaultRoundLocation(round)).toEqual({
      roundId: "round",
      hole: 1,
      summary: false,
    });
    expect(defaultRoundLocation({ ...round, scores: [[4, 4, 4, 4]] })).toEqual({
      roundId: "round",
      hole: 3,
      summary: true,
    });
  });
  it("ignores absent, malformed, missing-round and invalid-hole locations", () => {
    for (const value of [
      null,
      "{",
      "null",
      JSON.stringify({ roundId: "missing", hole: 0, summary: false }),
      ...[-1, 4, 1.5, "3"].map((hole) =>
        JSON.stringify({ roundId: "round", hole, summary: false }),
      ),
      JSON.stringify({ roundId: "round", hole: 0, summary: "false" }),
    ]) {
      vi.stubGlobal("localStorage", { getItem: () => value });
      expect(loadActiveRound(data)).toBeNull();
    }
  });
  it("clears the location when leaving a round", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { removeItem });
    expect(saveActiveRound(null)).toBe(true);
    expect(removeItem).toHaveBeenCalledWith("golf-scorecard:active:v1");
  });
  it("handles unavailable storage", () => {
    const fail = () => {
      throw new Error("Storage disabled");
    };
    vi.stubGlobal("localStorage", {
      getItem: fail,
      setItem: fail,
      removeItem: fail,
    });
    expect(loadActiveRound(data)).toBeNull();
    expect(saveActiveRound({ roundId: "round", hole: 3, summary: false })).toBe(
      false,
    );
    expect(saveActiveRound(null)).toBe(false);
  });
});
