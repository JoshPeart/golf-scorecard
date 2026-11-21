import type { Course, Round, Tee } from "./types";

export function savedCourseGroups(courses: Course[], rounds: Round[]) {
  const favourites = courses.filter((c) => c.favourite);
  const seen = new Set(favourites.map((c) => c.id));
  const recent: Course[] = [];
  for (const r of [...rounds].sort((a, b) => b.date.localeCompare(a.date))) {
    const c = courses.find((c) => c.id === r.courseId);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      recent.push(c);
    }
  }
  return [
    { name: "Favourites", courses: favourites },
    { name: "Recently played", courses: recent },
    { name: "Saved courses", courses: courses.filter((c) => !seen.has(c.id)) },
  ];
}

export function teeTotals(tee: Tee) {
  return {
    par: tee.pars.reduce((a, b) => a + b, 0),
    yards:
      tee.totalYardage ??
      (tee.yardages?.length && tee.yardages.every((y) => y != null)
        ? tee.yardages.reduce<number>((a, b) => a + (b ?? 0), 0)
        : undefined),
  };
}

export function debounceSearch(action: () => void, milliseconds = 300) {
  const timer = setTimeout(action, milliseconds);
  return () => clearTimeout(timer);
}
