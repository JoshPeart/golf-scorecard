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
      tee.pars.length > 0 &&
      tee.yardages?.length === tee.pars.length &&
      tee.yardages.every((y) => y != null && Number.isFinite(y) && y > 0)
        ? tee.yardages.reduce<number>((a, b) => a + (b ?? 0), 0)
        : tee.totalYardage,
  };
}

export function teeLabel(tee: Tee, tees: Tee[], name = tee.name): string {
  if (
    !tees.some(
      (t) =>
        t.id !== tee.id &&
        t.name.trim().toLowerCase() === tee.name.trim().toLowerCase(),
    )
  )
    return name;
  const gender =
    tee.gender === "male"
      ? "Men's"
      : tee.gender === "female"
        ? "Women's"
        : tee.gender === "mixed"
          ? "Mixed"
          : "Unspecified";
  return `${name} (${gender})`;
}

export function debounceSearch(action: () => void, milliseconds = 300) {
  const timer = setTimeout(action, milliseconds);
  return () => clearTimeout(timer);
}
