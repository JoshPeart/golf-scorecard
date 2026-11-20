import type { Course, Round, Tee } from "./types";
import { snapshotTee } from "./roundDetails";

export type RoundLength = "18" | "front" | "back";

export function createRound(
  course: Course,
  tee: Tee,
  players: string[],
  length: RoundLength = "18",
): Round {
  const startHole = course.holes === 18 && length === "back" ? 9 : 0;
  const holes = course.holes === 9 || length !== "18" ? 9 : 18;
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
      i >= hole &&
      round.scores.every((scores) => scores[i] == null)
        ? (tee.pars[i + (round.startHole ?? 0)] ?? par)
        : par,
    ),
  };
}
