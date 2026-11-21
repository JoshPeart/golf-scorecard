import type { Course, Round, Tee } from "./types";
import { snapshotTee } from "./roundDetails";

export type RoundLength = "18" | "front" | "back";

export function roundTees(round: Round, course: Course): Tee[] {
  const layout =
    round.teeLayoutId ??
    course.tees.find((t) => t.id === round.teeId)?.layoutId;
  return course.tees.filter((t) => t.layoutId === layout);
}

export function teeHoleCount(course: Course, tee: Tee): 9 | 18 {
  return tee.layoutId && (tee.pars.length === 9 || tee.pars.length === 18)
    ? tee.pars.length
    : course.holes;
}

export function createRound(
  course: Course,
  tee: Tee,
  players: string[],
  length: RoundLength = "18",
): Round {
  const count = teeHoleCount(course, tee);
  const startHole = count === 18 && length === "back" ? 9 : 0;
  const holes = count === 9 || length !== "18" ? 9 : 18;
  return {
    id: crypto.randomUUID(),
    courseId: course.id,
    teeId: tee.id,
    ...snapshotTee(course, tee, startHole, holes),
    date: new Date().toISOString(),
    players,
    startHole,
    pars: tee.pars.slice(startHole, startHole + holes),
    scores: players.map(() => Array(holes).fill(null)),
  };
}

export function switchTee(
  round: Round,
  tee: Tee,
  hole: number,
  course?: Course,
): Round {
  const layout =
    round.teeLayoutId ??
    course?.tees.find((t) => t.id === round.teeId)?.layoutId;
  if (tee.layoutId !== layout) return round;
  return {
    ...round,
    teeId: tee.id,
    ...snapshotTee(
      { name: course?.name ?? round.courseName },
      tee,
      round.startHole ?? 0,
      round.pars.length,
    ),
    pars: round.pars.map((par, i) =>
      i >= hole && round.scores.every((scores) => scores[i] == null)
        ? (tee.pars[i + (round.startHole ?? 0)] ?? par)
        : par,
    ),
  };
}
