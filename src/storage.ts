import type { Course, Round, Store } from "./types";
const KEY = "golf-scorecard:v1";
const ACTIVE_KEY = "golf-scorecard:active:v1";
export interface ActiveRound {
  roundId: string;
  hole: number;
  summary: boolean;
}
export function defaultRoundLocation(round: Round): ActiveRound {
  const next = round.pars.findIndex((_, h) =>
    round.scores.some((s) => s[h] == null),
  );
  return {
    roundId: round.id,
    hole: next === -1 ? round.pars.length - 1 : next,
    summary: round.scores.every((s) => s.every((n) => n != null)),
  };
}
export function loadActiveRound(data: Store): ActiveRound | null {
  try {
    const active = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null");
    const round = data.rounds.find((r) => r.id === active?.roundId);
    if (
      round &&
      Number.isInteger(active.hole) &&
      active.hole >= 0 &&
      active.hole < round.pars.length &&
      typeof active.summary === "boolean"
    )
      return { roundId: round.id, hole: active.hole, summary: active.summary };
  } catch {
    /* Storage may be disabled. */
  }
  return null;
}
export function saveActiveRound(active: ActiveRound | null): boolean {
  try {
    if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    else localStorage.removeItem(ACTIVE_KEY);
    return true;
  } catch {
    return false;
  }
}
export function load(): Store {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (data && Array.isArray(data.courses) && Array.isArray(data.rounds))
      return {
        ...data,
        courses: data.courses.map((course: Course) => ({
          ...course,
          source: course.source ?? "manual",
          verified: course.verified ?? false,
        })),
      };
  } catch {
    /* Storage may be disabled. */
  }
  return { courses: [], rounds: [] };
}
export function save(data: Store): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
