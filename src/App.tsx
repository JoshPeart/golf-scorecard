import { useEffect, useState } from "react";
import type { Course, Round } from "./types";
import {
  load,
  save,
  loadActiveRound,
  saveActiveRound,
  defaultRoundLocation,
} from "./storage";
import { relative, segment } from "./scoring";
import { roundDetails } from "./roundDetails";
import { CourseEditor } from "./CourseEditor";
import { Scorecard } from "./Scorecard";
import { NewRound } from "./CourseSearch";
import { CourseBadges } from "./CourseBadges";
import { importCourse } from "./courseSearch";
import "./App.css";

export default function App() {
  const [data, setData] = useState(load);
  const [active, setActive] = useState(() => loadActiveRound(data));
  const [screen, setScreen] = useState<
    "home" | "course" | "new" | "round" | "credits"
  >(active ? "round" : "home");
  const [courseId, setCourseId] = useState("");
  const [editorReturn, setEditorReturn] = useState<"home" | "new">("home");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    setStorageError(!save(data));
  }, [data]);
  const round = data.rounds.find((r) => r.id === active?.roundId);
  useEffect(() => {
    saveActiveRound(screen === "round" && round ? active : null);
  }, [active, screen, round]);
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
          <button
            className="primary wide"
            onClick={() => {
              setCourseId("");
              setScreen("new");
            }}
          >
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
            const details = roundDetails(r, c);
            return (
              <button
                className="list-card"
                key={r.id}
                onClick={() => {
                  setActive(defaultRoundLocation(r));
                  setScreen("round");
                }}
              >
                <span>
                  <strong>{details.courseName}</strong>
                  <small>
                    {details.teeName} · {new Date(r.date).toLocaleDateString()}{" "}
                    · {s.played}/{r.pars.length} holes
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
                setEditorReturn("home");
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
                setEditorReturn("home");
                setScreen("course");
              }}
            >
              <span>
                <strong>{c.name}</strong>
                <CourseBadges course={c} />
                <small>
                  {c.holes} holes · {c.tees.map((t) => t.name).join(" / ")}
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
          <footer>
            Made for the walk. Saved on this device.
            <br />
            <button
              className="text-button"
              onClick={() => setScreen("credits")}
            >
              About &amp; credits
            </button>
          </footer>
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
            setCourseId(c.id);
            setScreen(editorReturn);
          }}
          onCancel={() => setScreen(editorReturn)}
          onDelete={() => {
            setData((d) => ({
              ...d,
              courses: d.courses.filter((c) => c.id !== courseId),
            }));
            setCourseId("");
            setScreen(editorReturn);
          }}
        />
      )}
      {screen === "new" && (
        <NewRound
          courses={data.courses}
          rounds={data.rounds}
          selectedId={courseId}
          onSelect={setCourseId}
          onFavourite={(c) => updateCourse({ ...c, favourite: !c.favourite })}
          onEdit={(id) => {
            setCourseId(id);
            setEditorReturn("new");
            setScreen("course");
          }}
          onImport={(c) => {
            const existing = data.courses.find(
              (old) => old.source === c.source && old.sourceId === c.sourceId,
            );
            setData((d) => ({ ...d, courses: importCourse(d.courses, c) }));
            setCourseId(existing?.id ?? c.id);
          }}
          onBack={() => setScreen("home")}
          onAdd={() => {
            setCourseId("");
            setEditorReturn("new");
            setScreen("course");
          }}
          onStart={(r) => {
            setData((d) => ({ ...d, rounds: [...d.rounds, r] }));
            setActive(defaultRoundLocation(r));
            setScreen("round");
          }}
        />
      )}
      {screen === "credits" && (
        <main className="credits">
          <button className="text-button" onClick={() => setScreen("home")}>
            ← Home
          </button>
          <div className="eyebrow">MADE FOR THE WALK</div>
          <h1>About Fairway.</h1>
          <p>
            A simple golf notebook for the course. Choose your tee, keep score
            with friends, and keep your rounds on this device.
          </p>
          <p>
            No account required. Your courses, favourites and scores stay in
            this browser's localStorage. Clearing browser data removes your
            notebook.
          </p>
          <h2>Course data &amp; credits</h2>
          <p>
            Course data ©{" "}
            <a href="https://www.golfcore.org" target="_blank" rel="noreferrer">
              GolfCore
            </a>{" "}
            and{" "}
            <a
              href="https://golfcourseapi.com"
              target="_blank"
              rel="noreferrer"
            >
              GolfCourseAPI
            </a>
            .
          </p>
          <p className="muted">
            Each imported course links to its source where supplied. Data can be
            incomplete or out of date: check it against the club's scorecard
            before playing. Edits you make stay yours.
          </p>
        </main>
      )}
      {screen === "round" && round && active && (
        <Scorecard
          hole={active.hole}
          summary={active.summary}
          onNavigate={(hole, summary) =>
            setActive({ ...active, hole, summary })
          }
          round={round}
          course={data.courses.find((c) => c.id === round.courseId)}
          onChange={updateRound}
          onCourseChange={updateCourse}
          onBack={() => setScreen("home")}
          saved={!storageError}
          onDelete={() => {
            setData((d) => ({
              ...d,
              rounds: d.rounds.filter((r) => r.id !== round.id),
            }));
            setScreen("home");
          }}
        />
      )}
    </div>
  );
}
