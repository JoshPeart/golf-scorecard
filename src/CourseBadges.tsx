import type { Course } from "./types";
import { needsChecking } from "./courseSearch";

export function CourseBadges({
  course,
  cached = false,
}: {
  course: Course;
  cached?: boolean;
}) {
  return (
    <span className="badges">
      {course.customised && <span className="badge">Customised</span>}
      {!!needsChecking(course).length && (
        <span className="badge checking">Needs checking</span>
      )}
      {cached && <span className="badge">Saved offline</span>}
    </span>
  );
}

export function SourceLink({ course }: { course: Course }) {
  if (!course.sourceUrl || !/^https?:\/\//i.test(course.sourceUrl)) return null;
  return (
    <p className="muted attribution">
      Course data:{" "}
      <a href={course.sourceUrl} target="_blank" rel="noreferrer">
        {course.source === "golfcore" ? "GolfCore" : "GolfCourseAPI"} · source
        course ↗
      </a>
    </p>
  );
}
