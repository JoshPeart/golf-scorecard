import { useEffect, useState } from "react";
import type { Course, Round } from "./types";
import { load, save } from "./storage";
import { relative, segment } from "./scoring";
import { CourseEditor } from "./CourseEditor";
import { Scorecard } from "./Scorecard";
import "./App.css";

export default function App() {
  const [data, setData] = useState(load);
  const [screen, setScreen] = useState<"home" | "course" | "new" | "round">(
    "home",
  );
  const [courseId, setCourseId] = useState("");
  const [roundId, setRoundId] = useState("");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    setStorageError(!save(data));
  }, [data]);
  const round = data.rounds.find((r) => r.id === roundId);
  function updateRound(next: Round) {
    setData((d) => ({
      ...d,
      rounds: d.rounds.map((r) => (r.id === next.id ? next : r)),
    }));
  }
  function updateCourse(next: Course) {
    setData((d) => ({
      ...d,
      courses: [...d.courses.filter((c) => c.id !== next.id), next],
    }));
  }
  return (
    <div className="app">
      <header>
        <button
          className="brand"
          onClick={() => setScreen("home")}
          aria-label="Go home"
        >
          <span className="brand-icon">⚑</span> FAIRWAY
          <span className="brand-light"> / scorecard</span>
        </button>
        <span className="local">ON YOUR DEVICE</span>
      </header>
      {storageError && (
        <p role="alert" className="warning">
          Could not save. Device storage may be full or disabled. Keep this page
          open.
        </p>
      )}
      {screen === "home" && (
        <main>
          <div className="eyebrow">LESS TAPPING. MORE GOLF.</div>
          <h1>
            Your next round
            <br />
            starts here.
          </h1>
          <p className="muted">A simple scorecard. Just you and the course.</p>
          <button className="primary wide" onClick={() => setScreen("new")}>
            New round <span>↗</span>
          </button>
          <div className="section-heading">
            <h2>Your rounds</h2>
            <span>{data.rounds.length}</span>
          </div>
          {!data.rounds.length && (
            <p className="empty">
              No rounds yet. Your first fairway is waiting.
            </p>
          )}
          {[...data.rounds].reverse().map((r) => {
            const c = data.courses.find((c) => c.id === r.courseId);
            const s = segment(r.scores[0], r.pars);
            return (
              <button
                className="list-card"
                key={r.id}
                onClick={() => {
                  setRoundId(r.id);
                  setScreen("round");
                }}
              >
                <span>
                  <strong>{c?.name || "Deleted course"}</strong>
                  <small>
                    {c?.tees.find((t) => t.id === r.teeId)?.name ||
                      "Removed tee"}{" "}
                    · {new Date(r.date).toLocaleDateString()} · {s.played}/
                    {r.pars.length} holes
                  </small>
                  {r.players.length > 1 && (
                    <small>with {r.players.slice(1).join(", ")}</small>
                  )}
                </span>
                <b>{s.played ? `${s.total} (${relative(s.toPar)})` : "—"} →</b>
              </button>
            );
          })}
          <div className="section-heading">
            <h2>Your courses</h2>
            <button
              className="text-button"
              onClick={() => {
                setCourseId("");
                setScreen("course");
              }}
            >
              + Add course
            </button>
          </div>
          {!data.courses.length && (
            <p className="empty">Add a course and make each tee your own.</p>
          )}
          {data.courses.map((c) => (
            <button
              className="list-card"
              key={c.id}
              onClick={() => {
                setCourseId(c.id);
                setScreen("course");
              }}
            >
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.holes} holes · {c.tees.map((t) => t.name).join(" / ")}
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
          <footer>Made for the walk. Saved on this device.</footer>
        </main>
      )}
      {screen === "course" && (
        <CourseEditor
          key={courseId}
          course={data.courses.find((c) => c.id === courseId)}
          usedTeeIds={data.rounds
            .filter((r) => r.courseId === courseId)
            .map((r) => r.teeId)}
          onSave={(c) => {
            updateCourse(c);
            setScreen("home");
          }}
          onCancel={() => setScreen("home")}
          onDelete={() => {
            setData((d) => ({
              ...d,
              courses: d.courses.filter((c) => c.id !== courseId),
            }));
            setScreen("home");
          }}
        />
      )}
      {screen === "new" && (
        <NewRound
          courses={data.courses}
          onBack={() => setScreen("home")}
          onAdd={() => {
            setCourseId("");
            setScreen("course");
          }}
          onStart={(r) => {
            setData((d) => ({ ...d, rounds: [...d.rounds, r] }));
            setRoundId(r.id);
            setScreen("round");
          }}
        />
      )}
      {screen === "round" && round && (
        <Scorecard
          round={round}
          course={data.courses.find((c) => c.id === round.courseId)}
          onChange={updateRound}
          onCourseChange={updateCourse}
          onBack={() => setScreen("home")}
          saved={!storageError}
          onDelete={() => {
            setData((d) => ({
              ...d,
              rounds: d.rounds.filter((r) => r.id !== roundId),
            }));
            setScreen("home");
          }}
        />
      )}
    </div>
  );
}

function NewRound({
  courses,
  onStart,
  onBack,
  onAdd,
}: {
  courses: Course[];
  onStart: (r: Round) => void;
  onBack: () => void;
  onAdd: () => void;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const course = courses.find((c) => c.id === courseId);
  const [teeId, setTeeId] = useState(course?.tees[0]?.id || "");
  const [names, setNames] = useState("");
  return (
    <main>
      <button className="text-button" onClick={onBack}>
        ← Back
      </button>
      <div className="eyebrow">FIRST TEE</div>
      <h1>Let's play.</h1>
      {!courses.length ? (
        <>
          <p>Add a course before starting your round.</p>
          <button className="primary" onClick={onAdd}>
            Add course
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const tee = course?.tees.find((t) => t.id === teeId);
            if (!course || !tee) return;
            const players = [
              "Me",
              ...names
                .split(",")
                .map((n) => n.trim())
                .filter(Boolean),
            ];
            onStart({
              id: crypto.randomUUID(),
              courseId,
              teeId,
              date: new Date().toISOString(),
              players,
              pars: [...tee.pars],
              scores: players.map(() => Array(course.holes).fill(null)),
            });
          }}
        >
          <label>
            Course
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setTeeId(
                  courses.find((c) => c.id === e.target.value)!.tees[0].id,
                );
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tee
            <select value={teeId} onChange={(e) => setTeeId(e.target.value)}>
              {course?.tees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · Par {t.pars.reduce((a, b) => a + b, 0)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Playing partners <span className="muted">(optional)</span>
            <input
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder="Alex, Sam"
            />
          </label>
          <p className="muted">
            Separate names with commas. You're already in as “Me”.
          </p>
          <button className="primary wide">Start round ↗</button>
        </form>
      )}
    </main>
  );
}
