import { useEffect, useRef, useState } from "react";
import type { Course, Round } from "./types";
import { relative, segment } from "./scoring";
export function Scorecard({
  round,
  course,
  onChange,
  onCourseChange,
  onBack,
  saved,
}: {
  round: Round;
  course?: Course;
  onChange: (r: Round) => void;
  onCourseChange: (c: Course) => void;
  onBack: () => void;
  saved: boolean;
}) {
  const [hole, setHole] = useState(() => {
    const next = round.pars.findIndex((_, h) =>
      round.scores.some((s) => s[h] == null),
    );
    return next === -1 ? round.pars.length - 1 : next;
  });
  const [summary, setSummary] = useState(() =>
    round.scores.every((s) => s.every((n) => n != null)),
  );
  const heroRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (summary) window.scrollTo(0, 0);
    else heroRef.current?.scrollIntoView({ block: "start" });
  }, [hole, summary]);
  const [editing, setEditing] = useState(false);
  const [par, setPar] = useState(4);
  const [also, setAlso] = useState(false);
  const tee = course?.tees.find((t) => t.id === round.teeId);
  const canUpdateTee =
    !!course && hole < course.holes && tee?.pars[hole] != null;
  const first = segment(round.scores[0], round.pars);
  function navigate(nextHole: number, nextSummary: boolean) {
    moved.current = nextHole !== hole || nextSummary !== summary;
    setEditing(false);
    setPar(round.pars[nextHole]);
    setAlso(false);
    setHole(nextHole);
    setSummary(nextSummary);
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
    <main className="scorecard">
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
        · {tee?.name || "Removed tee"} tees
      </div>
      <h1 className="course-title">{course?.name || "Deleted course"}</h1>
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
              {hole < 9 ? "FRONT NINE" : "BACK NINE"}{" "}
              <span> / {round.pars.length} HOLES</span>
            </div>
            <div className="hole-number">
              <span>Hole</span>
              <strong>{String(hole + 1).padStart(2, "0")}</strong>
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
                {tee?.yardages?.[hole] ?? "—"} <small>YDS</small>
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
                            pars: t.pars.map((p, i) => (i === hole ? par : p)),
                          }
                        : t,
                    ),
                  });
                setEditing(false);
              }}
            >
              <label>
                Par for hole {hole + 1}
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
              style={{ width: `${(first.played / round.pars.length) * 100}%` }}
            />
          </div>
          <p className="progress-label">
            {first.played} OF {round.pars.length} HOLES SCORED · ME
          </p>
        </>
      ) : (
        <>
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
                    <th key={p}>{n}</th>
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
                        {h + 1} ↗
                      </button>
                    </th>
                    <td>{par}</td>
                    {round.scores.map((s, p) => (
                      <td key={p}>{s[h] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
                {[
                  ["Out", 0, 9],
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
        </>
      )}
    </main>
  );
}
