import type { Course, Tee } from "./types";

export interface CourseRow {
  id: string;
  name: string;
  club_name: string | null;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  country: string | null;
  source: Course["source"] | null;
  source_id: string | null;
  source_url: string | null;
  last_synced_at: string | null;
  verified: boolean | null;
  customised: boolean | null;
  favourite: boolean | null;
  hole_count: 9 | 18;
}
export interface TeeRow {
  id: string;
  course_id: string;
  name: string;
  colour: string | null;
  gender: Tee["gender"] | null;
  course_rating: number | null;
  slope: number | null;
  total_yardage: number | null;
}
export interface HoleRow {
  id: string;
  course_id: string;
  hole_number: number;
  stroke_index: number | null;
}
export interface TeeHoleRow {
  id: string;
  tee_id: string;
  hole_number: number;
  par: number | null;
  yardage: number | null;
  stroke_index: number | null;
}
export interface CourseTables {
  courses: CourseRow[];
  tees: TeeRow[];
  holes: HoleRow[];
  tee_holes: TeeHoleRow[];
}

export function toTables(courses: Course[]): CourseTables {
  const tables: CourseTables = {
    courses: [],
    tees: [],
    holes: [],
    tee_holes: [],
  };
  for (const c of courses) {
    tables.courses.push({
      id: c.id,
      name: c.name,
      club_name: c.clubName ?? null,
      address: c.address ?? null,
      postcode: c.postcode ?? null,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      country: c.country ?? null,
      source: c.source ?? null,
      source_id: c.sourceId ?? null,
      source_url: c.sourceUrl ?? null,
      last_synced_at: c.lastSyncedAt ?? null,
      verified: c.verified ?? null,
      customised: c.customised ?? null,
      favourite: c.favourite ?? null,
      hole_count: c.holes,
    });
    const reference = c.tees.find(
      (t) =>
        t.strokeIndexes?.length === c.holes &&
        t.strokeIndexes.every((si) => si != null && si > 0),
    );
    for (let i = 0; i < c.holes; i++)
      tables.holes.push({
        id: `${encodeURIComponent(c.id)}:hole:${i + 1}`,
        course_id: c.id,
        hole_number: i + 1,
        stroke_index: reference?.strokeIndexes?.[i] ?? null,
      });
    for (const t of c.tees) {
      tables.tees.push({
        id: t.id,
        course_id: c.id,
        name: t.name,
        colour: t.color ?? null,
        gender: t.gender ?? null,
        course_rating: t.courseRating ?? null,
        slope: t.slope ?? null,
        total_yardage: t.totalYardage ?? null,
      });
      for (
        let i = 0;
        i <
        Math.max(
          c.holes,
          t.pars.length,
          t.yardages?.length ?? 0,
          t.strokeIndexes?.length ?? 0,
        );
        i++
      )
        tables.tee_holes.push({
          id: `${encodeURIComponent(t.id)}:hole:${i + 1}`,
          tee_id: t.id,
          hole_number: i + 1,
          par: t.pars[i] ?? null,
          yardage: t.yardages?.[i] ?? null,
          stroke_index: t.strokeIndexes?.[i] ?? null,
        });
    }
  }
  return tables;
}

export function fromTables(tables: CourseTables): Course[] {
  return tables.courses.map((c) => ({
    id: c.id,
    name: c.name,
    holes: c.hole_count,
    clubName: c.club_name ?? undefined,
    address: c.address ?? undefined,
    postcode: c.postcode ?? undefined,
    lat: c.lat ?? undefined,
    lng: c.lng ?? undefined,
    country: c.country ?? undefined,
    source: c.source ?? undefined,
    sourceId: c.source_id ?? undefined,
    sourceUrl: c.source_url ?? undefined,
    lastSyncedAt: c.last_synced_at ?? undefined,
    verified: c.verified ?? undefined,
    customised: c.customised ?? undefined,
    favourite: c.favourite ?? undefined,
    tees: tables.tees
      .filter((t) => t.course_id === c.id)
      .map((t) => {
        const rows = tables.tee_holes
          .filter((h) => h.tee_id === t.id)
          .sort((a, b) => a.hole_number - b.hole_number);
        const count = Math.max(c.hole_count, ...rows.map((h) => h.hole_number));
        const byNumber = new Map(rows.map((h) => [h.hole_number, h]));
        return {
          id: t.id,
          name: t.name,
          color: t.colour ?? undefined,
          gender: t.gender ?? undefined,
          courseRating: t.course_rating ?? undefined,
          slope: t.slope ?? undefined,
          totalYardage: t.total_yardage ?? undefined,
          pars: Array.from(
            { length: count },
            (_, i) => byNumber.get(i + 1)?.par ?? 0,
          ),
          yardages: Array.from(
            { length: count },
            (_, i) => byNumber.get(i + 1)?.yardage ?? null,
          ),
          strokeIndexes: Array.from(
            { length: count },
            (_, i) => byNumber.get(i + 1)?.stroke_index ?? null,
          ),
        };
      }),
  }));
}
