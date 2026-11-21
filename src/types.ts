export interface Tee {
  id: string;
  name: string;
  color?: string;
  pars: number[];
  yardages?: (number | null)[];
  gender?: "male" | "female" | "mixed";
  courseRating?: number;
  slope?: number;
  totalYardage?: number;
  strokeIndexes?: (number | null)[];
  layoutId?: string;
}
export interface Course {
  id: string;
  name: string;
  holes: 9 | 18;
  tees: Tee[];
  clubName?: string;
  address?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  country?: string;
  source?: "golfcore" | "golfcourseapi" | "manual";
  sourceId?: string;
  sourceUrl?: string;
  lastSyncedAt?: string;
  verified?: boolean;
  customised?: boolean;
  favourite?: boolean;
}
export interface Round {
  id: string;
  courseId: string;
  teeId: string;
  courseName?: string;
  teeName?: string;
  teeYardages?: (number | null)[];
  teeStrokeIndexes?: (number | null)[];
  teeLayoutId?: string;
  date: string;
  players: string[];
  pars: number[];
  scores: (number | null)[][];
  notes?: string;
  startHole?: number;
}
export interface Store {
  courses: Course[];
  rounds: Round[];
}
