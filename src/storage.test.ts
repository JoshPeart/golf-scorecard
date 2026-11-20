import { afterEach, describe, expect, it, vi } from "vitest";
import { load, save } from "./storage";
afterEach(() => vi.unstubAllGlobals());
describe("versioned storage", () => {
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
