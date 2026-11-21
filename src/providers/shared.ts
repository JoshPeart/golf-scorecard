import type { Course, Tee } from "../types";
import { CourseProviderError, type ProviderId } from "./types";

export type JsonObject = Record<string, unknown>;
export const object = (v: unknown): JsonObject => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Expected an object");
  return v as JsonObject;
};
export const array = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new Error("Expected an array");
  return v;
};
export const str = (v: unknown) => (typeof v === "string" ? v : undefined);
export const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
export const positive = (v: unknown) => ((num(v) ?? 0) > 0 ? num(v)! : null);
export const required = (v: unknown) => {
  const s = str(v);
  if (!s?.trim()) throw new Error("Missing identifier or name");
  return s;
};

export async function fetchJson(
  url: string,
  provider: ProviderId,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok)
      throw new CourseProviderError(
        provider,
        "http",
        `Course service returned HTTP ${response.status}`,
        response.status,
      );
    try {
      return await response.json();
    } catch {
      throw new CourseProviderError(
        provider,
        "invalid",
        "Course service returned invalid JSON",
      );
    }
  } catch (error) {
    if (error instanceof CourseProviderError) throw error;
    throw new CourseProviderError(
      provider,
      controller.signal.aborted ? "timeout" : "network",
      controller.signal.aborted
        ? "Course request timed out"
        : "Could not reach course service",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function decode<T>(provider: ProviderId, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof CourseProviderError) throw error;
    throw new CourseProviderError(
      provider,
      "invalid",
      "Course service returned an unexpected shape",
    );
  }
}

export function endpoint(provider: ProviderId, base: string): string {
  return base
    ? `${base.replace(/\/$/, "")}/${provider}/v1`
    : `https://api.${provider === "golfcore" ? "golfcore.org" : "golfcourseapi.com"}/v1`;
}

export function mapTee(
  raw: JsonObject,
  provider: ProviderId,
  count: number,
  prefix = "",
  gender?: Tee["gender"],
): Tee | null {
  const holes = array(raw.holes).map(object);
  if (!holes.some((h) => positive(h.par))) return null;
  const name = required(raw.name ?? raw.tee_name);
  const positions = holes.map((h, i) =>
    provider === "golfcore" ? num(h.position) : i + 1,
  );
  const length = Math.max(count, ...positions.map((p) => p ?? 0));
  if (!Number.isInteger(length) || length <= 0 || length > 1000)
    throw new Error("Invalid hole count");
  const byPosition = new Map(holes.map((h, i) => [positions[i], h]));
  const at = (index: number) => byPosition.get(index + 1) ?? {};
  const color = name
    .toLowerCase()
    .match(
      /\b(black|blue|white|yellow|red|green|gold|silver|orange|purple|pink)\b/,
    )?.[1];
  return {
    id: crypto.randomUUID(),
    name: prefix + name,
    color,
    gender:
      gender ??
      (raw.gender === "M" ? "male" : raw.gender === "F" ? "female" : "mixed"),
    courseRating: num(raw.rating ?? raw.course_rating),
    slope: num(raw.slope ?? raw.slope_rating),
    totalYardage: num(raw.yards ?? raw.total_yards),
    pars: Array.from({ length }, (_, i) => positive(at(i).par) ?? 0),
    yardages: Array.from({ length }, (_, i) =>
      positive(at(i)[provider === "golfcore" ? "yards" : "yardage"]),
    ),
    strokeIndexes: Array.from({ length }, (_, i) =>
      positive(at(i)[provider === "golfcore" ? "stroke_index" : "handicap"]),
    ),
  };
}

export function mappedCourse(
  raw: JsonObject,
  provider: ProviderId,
  sourceId: string,
  tees: Tee[],
  count: number,
): Course {
  const location = provider === "golfcore" ? raw : object(raw.location ?? {});
  return {
    id: crypto.randomUUID(),
    name: required(raw.name ?? raw.course_name),
    clubName: str(raw.club_name),
    address: str(location.address),
    postcode: str(location.postcode),
    lat: num(location.lat ?? location.latitude),
    lng: num(location.lng ?? location.longitude),
    country: str(location.country),
    holes: Math.abs(count - 9) < Math.abs(count - 18) ? 9 : 18,
    tees,
    source: provider,
    sourceId,
    sourceUrl: str(raw.url),
    lastSyncedAt: new Date().toISOString(),
    verified: false,
  };
}
