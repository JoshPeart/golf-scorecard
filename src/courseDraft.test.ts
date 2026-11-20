import { describe, expect, it } from "vitest";
import {
  copyVisiblePars,
  courseToSave,
  isCourseDirty,
  resizeDraft,
} from "./courseDraft";
import type { Course } from "./types";

const course: Course = {
  id: "course",
  name: " Links ",
  holes: 18,
  tees: [
    {
      id: "tee",
      name: " Red ",
      pars: Array(18).fill(5),
      yardages: Array(18).fill(555),
    },
  ],
};

describe("course drafts", () => {
  it("ignores hidden holes after a nine-hole round trip but detects saved edits", () => {
    const nine = courseToSave({ ...course, holes: 9 })!;
    const restored = resizeDraft(resizeDraft(nine, 18), 9);
    expect(isCourseDirty(restored, nine)).toBe(false);
    expect(isCourseDirty({ ...restored, name: "Changed" }, nine)).toBe(true);
    expect(
      isCourseDirty(
        {
          ...restored,
          tees: [
            {
              ...restored.tees[0],
              pars: [3, ...restored.tees[0].pars.slice(1)],
            },
          ],
        },
        nine,
      ),
    ).toBe(true);
    expect(isCourseDirty({ ...restored, name: "" }, nine)).toBe(true);
    expect(
      isCourseDirty(
        { ...restored, tees: [{ ...restored.tees[0], name: "" }] },
        nine,
      ),
    ).toBe(true);
    expect(isCourseDirty(resizeDraft(nine, 18), nine)).toBe(true);
  });
  it("copies only visible pars and preserves the destination back nine", () => {
    const destination = course.tees[0];
    const source = { ...destination, pars: Array(18).fill(3) };
    expect(copyVisiblePars(destination, source, 9)).toEqual([
      ...Array(9).fill(3),
      ...Array(9).fill(5),
    ]);
    expect(copyVisiblePars(destination, source, 18)).toEqual(source.pars);
    expect(copyVisiblePars(destination, { ...source, pars: [] }, 9)).toEqual(
      destination.pars,
    );
    expect(destination.pars).toEqual(Array(18).fill(5));
  });
  it("retains hidden back-nine values until save without mutating the source", () => {
    const nine = resizeDraft(course, 9);
    expect(nine.holes).toBe(9);
    expect(resizeDraft(nine, 18).tees[0]).toEqual(course.tees[0]);
    expect(courseToSave(nine)?.tees[0].pars).toHaveLength(9);
    expect(courseToSave(nine)?.tees[0].yardages).toHaveLength(9);
    expect(course.holes).toBe(18);
    expect(course.tees[0].pars).toHaveLength(18);
  });
  it("initializes new holes and missing optional yardages", () => {
    const expanded = resizeDraft(
      {
        ...course,
        holes: 9,
        tees: [{ id: "tee", name: "Red", pars: Array(9).fill(3) }],
      },
      18,
    );
    expect(expanded.tees[0].pars).toEqual([
      ...Array(9).fill(3),
      ...Array(9).fill(4),
    ]);
    expect(expanded.tees[0].yardages).toEqual(Array(18).fill(null));
  });
  it("trims names and rejects empty or whitespace-only names", () => {
    expect(courseToSave(course)?.name).toBe("Links");
    expect(courseToSave(course)?.tees[0].name).toBe("Red");
    for (const name of ["", "   "]) {
      expect(courseToSave({ ...course, name })).toBeNull();
      expect(
        courseToSave({ ...course, tees: [{ ...course.tees[0], name }] }),
      ).toBeNull();
    }
  });
});
