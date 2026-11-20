import { useEffect, useRef, useState } from "react";
import type { Course, Round } from "./types";
import { relative, segment } from "./scoring";
import { switchTee } from "./rounds";
import { roundDetails } from "./roundDetails";
export function Scorecard({
  round,
  course,
  onChange,
  onCourseChange,
  onBack,
  onDelete,
  saved,
  hole,
  summary,
  onNavigate,
}: {
  round: Round;
  course?: Course;
  onChange: (r: Round) => void;
  onCourseChange: (c: Course) => void;
  onBack: () => void;
  onDelete: () => void;
  saved: boolean;
  hole: number;
  summary: boolean;
  onNavigate: (hole: number, summary: boolean) => void;
}) {
  const heroRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (summary) window.scrollTo(0, 0);
    else heroRef.current?.scrollIntoView({ block: "start" });
  }, [hole, summary]);
  const startHole = round.startHole ?? 0;
  const courseHole = startHole + hole;
  const [editing, setEditing] = useState(false);
  const [par, setPar] = useState(4);
  const [also, setAlso] = useState(false);
  const tee = course?.tees.find((t) => t.id === round.teeId);
  const complete = round.pars.filter((_, h) =>
    round.scores.every((s) => s[h] != null),
  ).length;
  const standings = round.players
    .map((name, p) => ({ name, p, ...segment(round.scores[p], round.pars) }))
    .sort(
      (a, b) => (b.played ? 1 : 0) - (a.played ? 1 : 0) || a.toPar - b.toPar,
    );
  const details = roundDetails(round, course);
  const canUpdateTee =
    !!course && courseHole < course.holes && tee?.pars[courseHole] != null;
  function navigate(nextHole: number, nextSummary: boolean) {
    moved.current = nextHole !== hole || nextSummary !== summary;
    setEditing(false);
    setPar(round.pars[nextHole]);
    setAlso(false);
    onNavigate(nextHole, nextSummary);
  }
  function stroke(player: number, delta: number) {
    onChange({
      ...round,
      scores: round.scores.map((s, p) =>
        p !== player
          ? s
          : s.map((n, h) =>
              h === hole ? Math.max(1, (n ?? round.pars[hole]) + delta) : n,
            ),
      ),
    });
  }
  return (
    <main className={`scorecard${!summary ? " playing" : ""}`}>
      <div className="round-top">
        <button className="text-button" onClick={onBack}>
          ← Rounds
        </button>
        <span className="save-status">
          {saved ? "● Auto-saved" : "Not saved"}
        </span>
      </div>
      <div className="eyebrow">
        {new Date(round.date).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
        })}{" "}
        ·{" "}
        {course && course.tees.length > 1 ? (
          <select
            className="tee-select"
            aria-label="Round tee"
            value={round.teeId}
            onChange={(e) => {
              const next = course.tees.find((t) => t.id === e.target.value);
              if (
                next &&
                confirm(
                  "Switch tees? New pars apply to the current and later holes only if no player has scored them. Scored holes and earlier holes keep their par.",
                )
              ) {
                const updated = switchTee(round, next, hole, course);
                onChange(updated);
                setEditing(false);
                setPar(updated.pars[hole]);
                setAlso(false);
              }
            }}
          >
            {!tee && <option value={round.teeId}>{details.teeName}</option>}
            {course.tees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === round.teeId ? details.teeName : t.name}
              </option>
            ))}
          </select>
        ) : (
          details.teeName
        )}{" "}
        tees
      </div>
      <h1 className="course-title">{details.courseName}</h1>
      <div className="tabs">
        <button
          className={!summary ? "active" : ""}
          onClick={() => navigate(hole, false)}
        >
          Play hole
        </button>
        <button
          className={summary ? "active" : ""}
          onClick={() => navigate(hole, true)}
        >
          Scorecard
        </button>
      </div>
      {!summary ? (
        <>
          <div className="hole-hero" ref={heroRef}>
            <div className="eyebrow">
              {courseHole < 9 ? "FRONT NINE" : "BACK NINE"}{" "}
              <span> / {round.pars.length} HOLES</span>
            </div>
            <div className="hole-number">
              <span>Hole</span>
              <strong>{String(courseHole + 1).padStart(2, "0")}</strong>
            </div>
            <div className="hole-meta">
              <button
                onClick={() => {
                  setPar(round.pars[hole]);
                  setAlso(false);
                  setEditing(true);
                }}
              >
                PAR <b>{round.pars[hole]}</b> <span>✎</span>
              </button>
              <span className="yardage">
                {details.yardages?.[hole] ?? "—"} <small>YDS</small>
              </span>
            </div>
          </div>
          {editing && (
            <form
              className="par-editor"
              onSubmit={(e) => {
                e.preventDefault();
                onChange({
                  ...round,
                  pars: round.pars.map((p, i) => (i === hole ? par : p)),
                });
                if (also && canUpdateTee && course && tee)
                  onCourseChange({
                    ...course,
                    tees: course.tees.map((t) =>
                      t.id === tee.id
                        ? {
                            ...t,
                            pars: t.pars.map((p, i) =>
                              i === courseHole ? par : p,
                            ),
                          }
                        : t,
                    ),
                  });
                setEditing(false);
              }}
            >
              <label>
                Par for hole {courseHole + 1}
                <select
                  value={par}
                  onChange={(e) => setPar(Number(e.target.value))}
                >
                  {[3, 4, 5, 6].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              {canUpdateTee && (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={also}
                    onChange={(e) => setAlso(e.target.checked)}
                  />
                  Also update the course's tee par
                </label>
              )}
              <button className="primary">Save par</button>{" "}
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </form>
          )}
          <div className="section-heading">
            <h2>Strokes</h2>
            <span className="muted">Make every shot count.</span>
          </div>
          {round.players.map((name, p) => {
            const score = round.scores[p][hole];
            const s = segment(round.scores[p], round.pars);
            return (
              <section className="player-card" key={p}>
                <div className="player-heading">
                  <strong>
                    <span className="avatar">{name[0]?.toUpperCase()}</span>
                    <span className="player-name">{name}</span>
                  </strong>
                  <span>
                    {s.played
                      ? `${s.total} · ${relative(s.toPar)} thru ${s.played}`
                      : "Ready to tee off"}
                  </span>
                  {score == null ? (
                    <button
                      className="text-button mark-par"
                      onClick={() =>
                        onChange({
                          ...round,
                          scores: round.scores.map((s, i) =>
                            i === p
                              ? s.map((v, h) =>
                                  h === hole ? round.pars[hole] : v,
                                )
                              : s,
                          ),
                        })
                      }
                    >
                      Mark par ({round.pars[hole]})
                    </button>
                  ) : (
                    <button
                      className="text-button mark-par"
                      onClick={() =>
                        onChange({
                          ...round,
                          scores: round.scores.map((s, i) =>
                            i === p
                              ? s.map((v, h) => (h === hole ? null : v))
                              : s,
                          ),
                        })
                      }
                    >
                      Clear score
                    </button>
                  )}
                </div>
                <div className="stepper">
                  <button
                    onClick={() => stroke(p, -1)}
                    aria-label={`Decrease strokes for ${name}`}
                  >
                    −
                  </button>
                  <div>
                    <strong>{score ?? "—"}</strong>
                    <small>
                      {score == null
                        ? "NOT SCORED"
                        : `${relative(score - round.pars[hole])} TO PAR`}
                    </small>
                  </div>
                  <button
                    onClick={() => stroke(p, 1)}
                    aria-label={`Increase strokes for ${name}`}
                  >
                    +
                  </button>
                </div>
              </section>
            );
          })}
          <div className="hole-nav">
            <button
              disabled={hole === 0}
              onClick={() => navigate(hole - 1, false)}
            >
              ← Previous
            </button>
            <span>
              {hole + 1} / {round.pars.length}
            </span>
            <button
              className="primary"
              onClick={() => {
                if (hole === round.pars.length - 1) navigate(hole, true);
                else navigate(hole + 1, false);
              }}
            >
              {hole === round.pars.length - 1 ? "Summary ↗" : "Next hole →"}
            </button>
          </div>
          <div className="round-progress">
            <div
              style={{ width: `${(complete / round.pars.length) * 100}%` }}
            />
          </div>
          <p className="progress-label">
            {complete} OF {round.pars.length} HOLES SCORED
          </p>
        </>
      ) : (
        <>
          {round.players.length > 1 && (
            <ol className="standings" aria-label="Totals">
              {standings.map((s) => (
                <li
                  key={s.p}
                  className={
                    s.played && s.toPar === standings[0].toPar ? "leader" : ""
                  }
                >
                  <span className="player-name">{s.name}</span>
                  <b>{s.played ? s.total : "—"}</b>
                  <small>
                    {s.played
                      ? `${relative(s.toPar)} · ${s.played === round.pars.length ? "F" : `thru ${s.played}`}`
                      : "Not started"}
                  </small>
                </li>
              ))}
            </ol>
          )}
          <h2>Round overview</h2>
          <p className="muted">
            To-par counts only scored holes. Tap a hole to play it.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hole</th>
                  <th>Par</th>
                  {round.players.map((n, p) => (
                    <th key={p} className="player-col" title={n}>
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {round.pars.map((par, h) => (
                  <tr key={h}>
                    <th>
                      <button
                        className="text-button"
                        onClick={() => {
                          navigate(h, false);
                        }}
                      >
                        {startHole + h + 1} ↗
                      </button>
                    </th>
                    <td>{par}</td>
                    {round.scores.map((s, p) => (
                      <td key={p}>{s[h] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
                {[
                  [startHole === 9 ? "In" : "Out", 0, 9],
                  ...(round.pars.length > 9 ? [["In", 9, 18]] : []),
                  ["Total", 0, round.pars.length],
                ].map(([label, start, end]) => (
                  <tr className="subtotal" key={label}>
                    <th>{label}</th>
                    <td>
                      {round.pars
                        .slice(Number(start), Number(end))
                        .reduce((a, b) => a + b, 0)}
                    </td>
                    {round.scores.map((s, p) => {
                      const n = segment(
                        s,
                        round.pars,
                        Number(start),
                        Number(end),
                      );
                      return (
                        <td key={p}>
                          {n.played ? (
                            <>
                              {n.total}
                              <small>{relative(n.toPar)}</small>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            Round notes
            <textarea
              value={round.notes || ""}
              onChange={(e) => onChange({ ...round, notes: e.target.value })}
              placeholder="A great day on the course…"
            />
          </label>
          <button
            className="danger wide"
            onClick={() => {
              if (confirm("Delete this round? This cannot be undone."))
                onDelete();
            }}
          >
            Delete round
          </button>
        </>
      )}
    </main>
  );
}
