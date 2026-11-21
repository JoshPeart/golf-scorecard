import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  debounceSearch,
  savedCourseGroups,
  teeTotals,
} from "./courseSelection";
import { TeeCard } from "./CourseSearch";
import { Scorecard } from "./Scorecard";
import { createRound } from "./rounds";
import { CourseBadges, SourceLink } from "./CourseBadges";
import { courseToSave, resizeDraft, isCourseDirty } from "./courseDraft";
import { searchCourses } from "./courseSearch";
import type { Course } from "./types";

const course: Course = {
  id: "c",
  name: "Links",
  holes: 18,
  source: "golfcore",
  sourceId: "links",
  sourceUrl: "https://www.golfcore.org/courses/links/",
  tees: [
    {
      id: "white",
      name: "White",
      color: "white",
      gender: "male",
      courseRating: 72.1,
      slope: 130,
      pars: Array(18).fill(5),
      yardages: Array(18).fill(400),
      strokeIndexes: Array.from({ length: 18 }, (_, i) => i + 1),
    },
    { id: "red", name: "Red", pars: Array(18).fill(4) },
  ],
};
afterEach(() => vi.useRealTimers());
describe("course selection UI", () => {
  it("debounces and cancels replaced searches at 300ms", () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const cancel = debounceSearch(() => search("old"));
    vi.advanceTimersByTime(200);
    cancel();
    debounceSearch(() => search("new"));
    vi.advanceTimersByTime(299);
    expect(search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(search).toHaveBeenCalledExactlyOnceWith("new");
  });
  it("groups favourites then recent courses newest first and deduplicates", () => {
    const favourite = { ...course, id: "fav", favourite: true },
      other = { ...course, id: "other" };
    const round = createRound(course, course.tees[0], ["Me"], "18");
    const groups = savedCourseGroups(
      [other, course, favourite],
      [
        { ...round, date: "2026-01-01" },
        { ...round, courseId: "fav", date: "2026-02-01" },
        { ...round, date: "2026-03-01" },
      ],
    );
    expect(groups.map((g) => g.courses.map((c) => c.id))).toEqual([
      ["fav"],
      ["c"],
      ["other"],
    ]);
    expect(savedCourseGroups([], []).every((g) => !g.courses.length)).toBe(
      true,
    );
  });
  it("renders per-tee totals, rating, gender, swatch and selected state", () => {
    const html = renderToStaticMarkup(
      createElement(TeeCard, {
        tee: course.tees[0],
        selected: true,
        onSelect: () => {},
      }),
    );
    for (const text of [
      'aria-pressed="true"',
      "White",
      "male",
      "Par 90",
      "7,200 yds",
      "Rating 72.1",
      "Slope 130",
      "background-color:white",
    ])
      expect(html).toContain(text);
    expect(teeTotals(course.tees[1])).toEqual({ par: 72, yards: undefined });
    expect(teeTotals({ ...course.tees[0], totalYardage: 7010 }).yards).toBe(
      7010,
    );
  });
  it("renders SI snapshot, back-nine offset and par variations without changing round pars", () => {
    const round = createRound(course, course.tees[0], ["Me"], "back");
    const html = renderToStaticMarkup(
      createElement(Scorecard, {
        round,
        course,
        hole: 0,
        summary: false,
        saved: true,
        onChange: () => {},
        onCourseChange: () => {},
        onBack: () => {},
        onDelete: () => {},
        onNavigate: () => {},
      }),
    );
    for (const text of [
      "400",
      "SI <b>10</b>",
      "Par varies by tee",
      "Red par 4",
    ])
      expect(html).toContain(text);
    expect(round.pars).toEqual(Array(9).fill(5));
  });
  it("shows quality/customised badges and safe source attribution", () => {
    expect(
      renderToStaticMarkup(
        createElement(CourseBadges, {
          course: { ...course, tees: [], customised: true },
          cached: true,
        }),
      ),
    ).toContain("Needs checking");
    expect(
      renderToStaticMarkup(createElement(SourceLink, { course })),
    ).toContain(course.sourceUrl);
    expect(
      renderToStaticMarkup(
        createElement(SourceLink, {
          course: { ...course, sourceUrl: "javascript:alert(1)" },
        }),
      ),
    ).toBe("");
  });
  it("searches by location with a blank query and retains cached results offline", async () => {
    const provider = {
      id: "golfcore" as const,
      searchCourses: vi
        .fn()
        .mockResolvedValue([
          { provider: "golfcore", sourceId: "other", name: "Other" },
        ]),
      getCourse: vi.fn(),
    };
    const options = {
      courses: [course],
      location: { lat: 52, lng: -1 },
      providers: [provider],
      online: true,
    };
    expect((await searchCourses("", options)).results).toHaveLength(2);
    expect(provider.searchCourses).toHaveBeenCalledWith("", options.location);
    provider.searchCourses.mockClear();
    expect(
      (await searchCourses("Links", { ...options, online: false })).results,
    ).toHaveLength(1);
    expect(provider.searchCourses).not.toHaveBeenCalled();
  });
});
describe("SI course edits", () => {
  it("preserves/resizes SI, flags changes on imports only, and saves manual provenance", () => {
    expect(courseToSave(course, course)?.customised).toBeUndefined();
    const draft = {
      ...course,
      tees: course.tees.map((t) => ({
        ...t,
        strokeIndexes: [18, ...(t.strokeIndexes?.slice(1) ?? [])],
      })),
    };
    expect(isCourseDirty(draft, course)).toBe(true);
    expect(courseToSave(draft, course)?.customised).toBe(true);
    const nine = resizeDraft(draft, 9);
    expect(courseToSave(nine)?.tees[0].strokeIndexes).toHaveLength(9);
    expect(resizeDraft(nine, 18).tees[0].strokeIndexes?.[17]).toBe(18);
    expect(courseToSave({ ...course, source: undefined })?.source).toBe(
      "manual",
    );
    expect(
      courseToSave({ ...draft, source: "manual" }, course)?.customised,
    ).toBeUndefined();
  });
});
