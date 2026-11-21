import type { Course, Round, Tee } from "./types";

export function snapshotTee(
  course: Partial<Pick<Course, "name">>,
  tee: Tee,
  startHole = 0,
  holes = tee.pars.length,
) {
  return {
    courseName: course.name,
    teeName: tee.name,
    teeYardages: tee.yardages?.slice(startHole, startHole + holes),
    teeStrokeIndexes: Array.from(
      { length: holes },
      (_, i) => tee.strokeIndexes?.[startHole + i] ?? null,
    ),
  };
}

export function roundDetails(round: Round, course?: Course) {
  const tee = course?.tees.find((t) => t.id === round.teeId);
  const renamed =
    (round.courseName != null && course?.name !== round.courseName) ||
    (round.teeName != null && tee?.name !== round.teeName);
  return {
    courseName: round.courseName || course?.name || "Deleted course",
    teeName: round.teeName || tee?.name || "Removed tee",
    yardages:
      renamed || !tee
        ? round.teeYardages
        : tee.yardages?.slice(
            round.startHole ?? 0,
            (round.startHole ?? 0) + round.pars.length,
          ),
  };
}
