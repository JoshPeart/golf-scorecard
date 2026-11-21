import type { Course, Tee } from "./types";

export function copyVisiblePars(
  destination: Tee,
  source: Tee,
  holes: number,
): number[] {
  return destination.pars.map((par, hole) =>
    hole < holes ? (source.pars[hole] ?? par) : par,
  );
}

export function resizeDraft(course: Course, holes: 9 | 18): Course {
  return {
    ...course,
    holes,
    tees: course.tees.map((tee) => ({
      ...tee,
      pars: Array.from(
        { length: Math.max(holes, tee.pars.length) },
        (_, i) => tee.pars[i] ?? 4,
      ),
      yardages: Array.from(
        { length: Math.max(holes, tee.yardages?.length ?? 0) },
        (_, i) => tee.yardages?.[i] ?? null,
      ),
      ...(tee.strokeIndexes
        ? {
            strokeIndexes: Array.from(
              { length: Math.max(holes, tee.strokeIndexes.length) },
              (_, i) => tee.strokeIndexes?.[i] ?? null,
            ),
          }
        : {}),
    })),
  };
}

export function courseToSave(draft: Course, initial?: Course): Course | null {
  if (!draft.name.trim() || draft.tees.some((tee) => !tee.name.trim()))
    return null;
  const course = normalizeCourse(draft);
  if (
    course.source &&
    course.source !== "manual" &&
    initial &&
    isCourseDirty(draft, initial)
  )
    course.customised = true;
  course.source ??= "manual";
  return course;
}

export function normalizeCourse(draft: Course): Course {
  return {
    ...draft,
    name: draft.name.trim(),
    tees: draft.tees.map((tee) => ({
      ...tee,
      name: tee.name.trim(),
      pars: tee.pars.slice(0, draft.holes),
      yardages: Array.from(
        { length: draft.holes },
        (_, hole) => tee.yardages?.[hole] ?? null,
      ),
      ...(tee.strokeIndexes
        ? {
            strokeIndexes: Array.from(
              { length: draft.holes },
              (_, i) => tee.strokeIndexes?.[i] ?? null,
            ),
          }
        : {}),
    })),
  };
}

export function isCourseDirty(draft: Course, initial: Course): boolean {
  return (
    JSON.stringify(normalizeCourse(draft)) !==
    JSON.stringify(normalizeCourse(initial))
  );
}
