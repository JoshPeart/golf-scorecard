import type { CourseProvider, CourseSummary } from "./types";
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

function isUKCountry(country: string | undefined): boolean {
  const name = country
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return (
    !!name &&
    [
      "gb",
      "gbr",
      "uk",
      "unitedkingdom",
      "unitedkingdomofgreatbritainandnorthernireland",
      "greatbritain",
      "britain",
      "england",
      "scotland",
      "wales",
      "northernireland",
      "gbeng",
      "gbsct",
      "gbwls",
      "gbnir",
    ].includes(name)
  );
}

export class GolfCourseAPIProvider implements CourseProvider {
  readonly id = "golfcourseapi";
  private readonly url: string;
  private readonly enabled: boolean;
  constructor(base = import.meta.env.VITE_COURSE_API_URL ?? "") {
    this.url = endpoint(this.id, base);
    this.enabled = !!base;
  }
  async searchCourses(query: string): Promise<CourseSummary[]> {
    if (!this.enabled) return [];
    const data = await fetchJson(
      `${this.url}/search?${new URLSearchParams({ search_query: query })}`,
      this.id,
    );
    return decode(this.id, () =>
      array(object(data).courses)
        .map(object)
        .filter((c) => isUKCountry(str(object(c.location ?? {}).country)))
        .map((c) => {
          const location = object(c.location ?? {});
          return {
            provider: this.id,
            sourceId: required(c.id),
            name: required(c.course_name),
            clubName: str(c.club_name),
            town: str(location.city),
            postcode: str(location.postcode),
            country: str(location.country),
            lat: num(location.latitude),
            lng: num(location.longitude),
          };
        }),
    );
  }
  async getCourse(id: string) {
    if (!this.enabled)
      throw new CourseProviderError(
        this.id,
        "disabled",
        "GolfCourseAPI needs the course Worker URL",
      );
    const data = await fetchJson(
      `${this.url}/courses/${encodeURIComponent(id)}`,
      this.id,
    );
    return decode(this.id, () => {
      const raw = object(data),
        groups = object(raw.tees);
      const tees = (["male", "female"] as const).flatMap((gender) =>
        array(groups[gender] ?? [])
          .map((t) => {
            const tee = object(t);
            return mapTee(
              tee,
              this.id,
              num(tee.number_of_holes) ?? array(tee.holes).length,
              "",
              gender,
            );
          })
          .filter((t) => t !== null),
      );
      return mappedCourse(
        raw,
        this.id,
        required(raw.id),
        tees,
        tees[0]?.pars.length ?? 18,
      );
    });
  }
}
