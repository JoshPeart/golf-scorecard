import type { CourseProvider, CourseSummary, Location } from "./types";
import { CourseProviderError } from "./types";
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
    const courses = await this.getCourseLayouts(id);
    const selected = courses.find((course) => course.sourceId === id);
    if (selected) return selected;
    if (courses.length === 1 && !id.includes("::")) return courses[0];
    throw new CourseProviderError(
      this.id,
      "invalid",
      "Choose a course layout before importing this club.",
    );
  }
  async getCourseLayouts(id: string) {
    const slug = id.split("::")[0];
    const data = await fetchJson(
      `${this.url}/courses/${encodeURIComponent(slug)}`,
      this.id,
    );
    return decode(this.id, () => {
      const raw = object(data);
      const layouts = array(raw.layouts).map(object);
      const sourceId = required(raw.slug);
      if (!layouts.length)
        return [
          mappedCourse(raw, this.id, sourceId, [], num(raw.hole_count) ?? 18),
        ];
      const courses = layouts.map((layout) => {
        const tees = array(layout.tees)
          .map((t) => {
            const tee = object(t);
            const count =
              array(layout.holes).length ||
              array(tee.holes).length ||
              num(raw.hole_count) ||
              18;
            return mapTee(tee, this.id, count);
          })
          .filter((t) => t !== null);
        const multi = layouts.length > 1;
        const name = multi ? required(layout.name).trim() : undefined;
        return mappedCourse(
          multi
            ? {
                ...raw,
                name: `${required(raw.name)} – ${name}`,
                club_name: required(raw.name),
              }
            : raw,
          this.id,
          multi ? `${sourceId}::${encodeURIComponent(name!)}` : sourceId,
          tees,
          tees[0]?.pars.length ||
            array(layout.holes).length ||
            num(raw.hole_count) ||
            18,
        );
      });
      if (
        new Set(courses.map((course) => course.sourceId)).size !==
        courses.length
      )
        throw new Error("Duplicate layout names");
      return courses;
    });
  }
}
