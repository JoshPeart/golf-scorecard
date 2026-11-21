import type { CourseProvider, CourseSummary, Location } from "./types";
import {
  array,
  decode,
  endpoint,
  fetchJson,
  mapTee,
  mappedCourse,
  num,
  object,
  required,
  str,
} from "./shared";

export class GolfCoreProvider implements CourseProvider {
  readonly id = "golfcore";
  private readonly url: string;
  constructor(base = import.meta.env.VITE_COURSE_API_URL ?? "") {
    this.url = endpoint(this.id, base);
  }
  async searchCourses(
    query: string,
    location?: Location,
  ): Promise<CourseSummary[]> {
    const courses: CourseSummary[] = [];
    let total = 0;
    do {
      const params = new URLSearchParams({
        q: query,
        country: "gb",
        limit: "200",
        offset: String(courses.length),
      });
      if (location) params.set("near", `${location.lat},${location.lng}`);
      const data = await fetchJson(`${this.url}/courses?${params}`, this.id);
      const page = decode(this.id, () => {
        const raw = object(data);
        const rows = array(raw.courses).map(object);
        const found = num(raw.total);
        if (
          found == null ||
          !Number.isInteger(found) ||
          found < 0 ||
          raw.offset !== courses.length ||
          (!rows.length && courses.length < found)
        )
          throw new Error("Invalid pagination");
        total = found;
        return rows.map((c): CourseSummary => ({
          provider: this.id,
          sourceId: required(c.slug),
          name: required(c.name),
          town: str(c.city),
          country: str(c.country),
          lat: num(c.lat),
          lng: num(c.lng),
          distanceMiles: num(c.miles),
        }));
      });
      courses.push(...page);
    } while (courses.length < total);
    return courses;
  }
  async getCourse(id: string) {
    const data = await fetchJson(
      `${this.url}/courses/${encodeURIComponent(id)}`,
      this.id,
    );
    return decode(this.id, () => {
      const raw = object(data);
      const layouts = array(raw.layouts).map(object);
      const tees = layouts.flatMap((layout) => {
        const prefix = layouts.length > 1 ? `${required(layout.name)} — ` : "";
        return array(layout.tees)
          .map((t) => {
            const tee = object(t);
            const count =
              array(layout.holes).length ||
              array(tee.holes).length ||
              num(raw.hole_count) ||
              18;
            const mapped = mapTee(tee, this.id, count, prefix);
            return mapped
              ? {
                  ...mapped,
                  layoutId: `${required(raw.slug)}:${required(layout.name)}`,
                }
              : null;
          })
          .filter((t) => t !== null);
      });
      return mappedCourse(
        raw,
        this.id,
        required(raw.slug),
        tees,
        tees[0]?.pars.length ?? num(raw.hole_count) ?? 18,
      );
    });
  }
}
