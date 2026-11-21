import type { Course } from "./types";
import {
  CourseProviderError,
  type CourseProvider,
  type CourseSummary,
  type Location,
  type ProviderId,
} from "./providers/types";

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}

function matches(text: string, query: string): boolean {
  const words = normalizeName(text).split(" ");
  return normalizeName(query)
    .split(" ")
    .every(
      (token) =>
        !token ||
        words.some(
          (word) =>
            word.includes(token) ||
            (token.length >= 4 &&
              Math.abs(word.length - token.length) <= 2 &&
              editDistance(word, token) <= (token.length >= 8 ? 2 : 1)),
        ),
    );
}

export function searchLocal(courses: Course[], query: string): Course[] {
  return courses.filter((c) =>
    matches(
      [c.name, c.clubName, c.address, c.postcode].filter(Boolean).join(" "),
      query,
    ),
  );
}

export function distanceMiles(a: Location, b: Location): number {
  const radians = (n: number) => (n * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat),
    dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

function coordinates(c: { lat?: number; lng?: number }): c is Location {
  return (
    c.lat != null &&
    c.lng != null &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng)
  );
}

function similarName(a: CourseSummary, b: CourseSummary): boolean {
  const numbers = (name: string) => name.match(/\p{N}+/gu)?.join(",") ?? "";
  if (numbers(a.name) !== numbers(b.name)) return false;
  const key = (c: CourseSummary) =>
    [
      ...new Set(
        normalizeName(c.name)
          .split(" ")
          .filter((w) => !["golf", "club", "course", "gc", "the"].includes(w)),
      ),
    ].join(" ");
  const x = key(a),
    y = key(b);
  return (
    !!x &&
    !!y &&
    (x === y || (Math.min(x.length, y.length) >= 8 && editDistance(x, y) <= 2))
  );
}

function sameCourse(a: CourseSummary, b: CourseSummary): boolean {
  if (a.provider === b.provider) {
    if (a.sourceId === b.sourceId) return true;
    if (
      a.provider === "golfcore" &&
      [a, b].some((c) => c.sourceId.includes("::"))
    )
      return false;
  }
  if (!similarName(a, b)) return false;
  if (coordinates(a) && coordinates(b)) return distanceMiles(a, b) <= 1;
  return (
    !!a.town && !!b.town && normalizeName(a.town) === normalizeName(b.town)
  );
}

export interface SearchOptions {
  courses: Course[];
  location?: Location;
  providers: CourseProvider[];
  online: boolean;
}

export function hasPlayableTee(course: Course): boolean {
  return course.tees.some(
    (tee) =>
      tee.pars.length === course.holes &&
      Array.from(tee.pars).every((par) => Number.isFinite(par) && par > 0),
  );
}

export async function searchCourses(
  query: string,
  options: SearchOptions,
): Promise<{
  results: CourseSummary[];
  errors: Partial<Record<ProviderId, CourseProviderError>>;
}> {
  const results: CourseSummary[] = searchLocal(options.courses, query)
    .filter((course) => !options.online || hasPlayableTee(course))
    .map((c) => ({
      provider:
        c.source === "golfcore" || c.source === "golfcourseapi"
          ? c.source
          : "local",
      sourceId: c.sourceId ?? c.id,
      name: c.name,
      clubName: c.clubName,
      postcode: c.postcode,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
    }));
  const errors: Partial<Record<ProviderId, CourseProviderError>> = {};
  const aliases = [...results];
  if (options.online && (normalizeName(query) || options.location)) {
    const providers = [...options.providers].sort(
      (a, b) =>
        Number(a.id === "golfcourseapi") - Number(b.id === "golfcourseapi"),
    );
    for (const provider of providers) {
      try {
        const found = await provider.searchCourses(query, options.location);
        for (const summary of found) {
          if (!aliases.some((existing) => sameCourse(existing, summary)))
            results.push(summary);
          aliases.push(summary);
        }
      } catch (error) {
        errors[provider.id] =
          error instanceof CourseProviderError
            ? error
            : new CourseProviderError(
                provider.id,
                "network",
                "Course search failed",
              );
      }
    }
  }
  return {
    results: results.map((c) =>
      options.location && coordinates(c)
        ? { ...c, distanceMiles: distanceMiles(options.location, c) }
        : c,
    ),
    errors,
  };
}

export function needsChecking(course: Course): string[] {
  const reasons: string[] = [];
  if (!course.tees.length) reasons.push("No tees");
  if (course.holes < 18) reasons.push("Fewer than 18 holes");
  if (course.tees.some((t) => t.pars.length !== course.holes))
    reasons.push("Unexpected hole count");
  const missing = (values: (number | null)[] | undefined) =>
    !values ||
    values.length !== course.holes ||
    Array.from({ length: course.holes }, (_, i) => values[i]).some(
      (v) => v == null || !Number.isFinite(v) || v <= 0,
    );
  if (course.tees.some((t) => missing(t.yardages)))
    reasons.push("Missing yardages");
  if (course.tees.some((t) => missing(t.pars))) reasons.push("Missing pars");
  if (course.tees.some((t) => missing(t.strokeIndexes)))
    reasons.push("Missing stroke indexes");
  return reasons;
}

export function importCourse(courses: Course[], fetched: Course): Course[] {
  const index =
    fetched.source && fetched.sourceId
      ? courses.findIndex(
          (c) => c.source === fetched.source && c.sourceId === fetched.sourceId,
        )
      : -1;
  if (index < 0) return [...courses, fetched];
  const existing = courses[index];
  if (existing.customised) return courses;
  const used = new Set<string>();
  const refreshed: Course = {
    ...fetched,
    id: existing.id,
    favourite: existing.favourite,
    tees: fetched.tees.map((tee) => {
      const match = existing.tees.find(
        (t) =>
          !used.has(t.id) &&
          normalizeName(t.name) === normalizeName(tee.name) &&
          t.gender === tee.gender,
      );
      if (match) used.add(match.id);
      return match ? { ...tee, id: match.id } : tee;
    }),
  };
  return courses.map((c, i) => (i === index ? refreshed : c));
}

export function parDiffersByTee(course: Course, holeIndex: number): boolean {
  return (
    new Set(
      course.tees
        .map((t) => t.pars[holeIndex])
        .filter((p) => p != null && p > 0),
    ).size > 1
  );
}
