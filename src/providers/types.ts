import type { Course } from "../types";

export type ProviderId = "golfcore" | "golfcourseapi";
export interface Location {
  lat: number;
  lng: number;
}
export interface CourseSummary {
  provider: ProviderId | "local";
  sourceId: string;
  name: string;
  clubName?: string;
  town?: string;
  postcode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  distanceMiles?: number;
}
export interface CourseProvider {
  id: ProviderId;
  searchCourses(query: string, location?: Location): Promise<CourseSummary[]>;
  getCourse(id: string): Promise<Course>;
  getCourseLayouts?(id: string): Promise<Course[]>;
}
export class CourseProviderError extends Error {
  readonly provider: ProviderId;
  readonly kind: "network" | "timeout" | "http" | "invalid" | "disabled";
  readonly status?: number;
  constructor(
    provider: ProviderId,
    kind: CourseProviderError["kind"],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "CourseProviderError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}
