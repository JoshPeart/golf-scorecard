export interface Tee {
  id: string;
  name: string;
  color?: string;
  pars: number[];
  yardages?: (number | null)[];
}
export interface Course {
  id: string;
  name: string;
  holes: 9 | 18;
  tees: Tee[];
}
export interface Round {
  id: string;
  courseId: string;
  teeId: string;
  date: string;
  players: string[];
  pars: number[];
  scores: (number | null)[][];
  notes?: string;
}
export interface Store {
  courses: Course[];
  rounds: Round[];
}
