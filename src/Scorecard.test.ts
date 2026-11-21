import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Scorecard } from "./Scorecard";
import { createRound, switchTee } from "./rounds";
import type { Course } from "./types";

describe("removed round tees", () => {
  it("keeps the selector visible with exactly one remaining tee and allows switching to it", () => {
    const course: Course = {
      id: "c",
      name: "The Belfry – Derby",
      holes: 18,
      tees: [
        { id: "white", name: "White", pars: Array(18).fill(5) },
        { id: "red", name: "Red", pars: Array(18).fill(4) },
      ],
    };
    const round = createRound(course, course.tees[0], ["Me"]);
    round.scores[0][0] = 4;
    const edited = { ...course, tees: [course.tees[1]] };
    const html = renderToStaticMarkup(
      createElement(Scorecard, {
        round,
        course: edited,
        hole: 1,
        summary: false,
        saved: true,
        onChange: () => {},
        onCourseChange: () => {},
        onBack: () => {},
        onDelete: () => {},
        onNavigate: () => {},
      }),
    );
    expect(html).toContain('aria-label="Round tee"');
    expect(html).toContain('<option value="white" selected="">White</option>');
    expect(html).toContain('<option value="red">Red</option>');
    const switched = switchTee(round, edited.tees[0], 1, edited);
    expect(switched.teeId).toBe("red");
    expect(switched.pars).toEqual([5, ...Array(17).fill(4)]);
    expect(switched.scores).toBe(round.scores);
  });
});
