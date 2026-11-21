import { useState } from "react";
import type { Course, Tee } from "./types";
import { CourseBadges, SourceLink } from "./CourseBadges";
import {
  copyVisiblePars,
  courseToSave,
  isCourseDirty,
  resizeDraft,
} from "./courseDraft";
const newTee = (holes: number): Tee => ({
  id: crypto.randomUUID(),
  name: "Yellow",
  pars: Array(holes).fill(4),
  yardages: Array(holes).fill(null),
});
export function CourseEditor({
  course,
  onSave,
  onCancel,
  onDelete,
  usedTeeIds = [],
}: {
  course?: Course;
  onSave: (c: Course) => void;
  onCancel: () => void;
  onDelete: () => void;
  usedTeeIds?: string[];
}) {
  const [initialDraft] = useState<Course>(() =>
    course
      ? structuredClone(course)
      : {
          id: crypto.randomUUID(),
          name: "",
          holes: 18,
          tees: [newTee(18)],
          source: "manual",
        },
  );
  const [draft, setDraft] = useState(initialDraft);
  const dirty = isCourseDirty(draft, initialDraft);
  function teeChange(id: string, patch: Partial<Tee>) {
    setDraft((d) => ({
      ...d,
      tees: d.tees.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }
  return (
    <main>
      <button
        className="text-button"
        onClick={() => {
          if (!dirty || confirm("Discard unsaved course changes?")) onCancel();
        }}
      >
        ← Cancel
      </button>
      <div className="eyebrow">COURSE NOTEBOOK</div>
      <h1>{course ? "Edit course." : "Make it yours."}</h1>
      <CourseBadges
        course={{
          ...draft,
          customised:
            draft.customised ||
            (!!draft.source && draft.source !== "manual" && dirty),
        }}
      />
      <SourceLink course={draft} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const course = courseToSave(draft, initialDraft);
          if (course) onSave(course);
        }}
      >
        <label>
          Course name
          <input
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Meadowbrook Golf Club"
            pattern=".*\S.*"
          />
        </label>
        <label>
          Holes
          <select
            value={draft.holes}
            onChange={(e) => {
              const holes = Number(e.target.value) as 9 | 18;
              setDraft(resizeDraft(draft, holes));
            }}
          >
            <option>9</option>
            <option>18</option>
          </select>
        </label>
        <div className="section-heading">
          <h2>Tees</h2>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setDraft({
                ...draft,
                tees: [
                  ...draft.tees,
                  {
                    ...newTee(draft.holes),
                    name: `Tee ${draft.tees.length + 1}`,
                  },
                ],
              })
            }
          >
            + Add tee
          </button>
        </div>
        {draft.tees.map((t) => (
          <fieldset key={t.id}>
            <legend>Tee settings</legend>
            <label>
              Name
              <input
                required
                pattern=".*\S.*"
                maxLength={40}
                value={t.name}
                onChange={(e) => teeChange(t.id, { name: e.target.value })}
              />
            </label>
            <label>
              Copy pars from
              <select
                aria-label={`Copy pars to ${t.name}`}
                value=""
                onChange={(e) =>
                  teeChange(t.id, {
                    pars: copyVisiblePars(
                      t,
                      draft.tees.find((x) => x.id === e.target.value)!,
                      draft.holes,
                    ),
                  })
                }
              >
                <option value="">Choose tee…</option>
                {draft.tees
                  .filter((x) => x.id !== t.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="danger text-button"
              disabled={draft.tees.length === 1}
              onClick={() => {
                if (
                  usedTeeIds.includes(t.id) &&
                  !confirm("Remove this tee? Existing rounds use it.")
                )
                  return;
                setDraft({
                  ...draft,
                  tees: draft.tees.filter((x) => x.id !== t.id),
                });
              }}
            >
              Remove tee
            </button>
          </fieldset>
        ))}
        <h2>Hole details</h2>
        <p className="muted">
          Pars belong to each tee. Yardages and stroke indexes (SI) are
          optional.
        </p>
        {draft.tees.length > 1 && (
          <p className="muted tee-scroll-hint">More tees? Scroll the table →</p>
        )}
        <div className="table-scroll hole-grid">
          <table>
            <thead>
              <tr>
                <th>Hole</th>
                {draft.tees.map((t) => (
                  <th key={t.id}>
                    {t.name}
                    <small>Par / yards / SI</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: draft.holes }, (_, i) => (
                <tr key={i}>
                  <th>{i + 1}</th>
                  {draft.tees.map((t) => (
                    <td key={t.id}>
                      <div className="hole-inputs">
                        <select
                          aria-label={`Hole ${i + 1} ${t.name} par`}
                          value={t.pars[i]}
                          onChange={(e) =>
                            teeChange(t.id, {
                              pars: t.pars.map((p, h) =>
                                h === i ? Number(e.target.value) : p,
                              ),
                            })
                          }
                        >
                          {[3, 4, 5, 6].map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="1500"
                          aria-label={`Hole ${i + 1} ${t.name} yardage`}
                          placeholder="—"
                          value={t.yardages?.[i] ?? ""}
                          onChange={(e) =>
                            teeChange(t.id, {
                              yardages: Array.from(
                                {
                                  length: Math.max(
                                    draft.holes,
                                    t.yardages?.length ?? 0,
                                  ),
                                },
                                (_, h) =>
                                  h === i
                                    ? e.target.value
                                      ? Number(e.target.value)
                                      : null
                                    : (t.yardages?.[h] ?? null),
                              ),
                            })
                          }
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="18"
                          step="1"
                          aria-label={`Hole ${i + 1} ${t.name} SI`}
                          placeholder="SI"
                          value={t.strokeIndexes?.[i] ?? ""}
                          onChange={(e) =>
                            teeChange(t.id, {
                              strokeIndexes: Array.from(
                                {
                                  length: Math.max(
                                    draft.holes,
                                    t.strokeIndexes?.length ?? 0,
                                  ),
                                },
                                (_, h) =>
                                  h === i
                                    ? e.target.value
                                      ? Number(e.target.value)
                                      : null
                                    : (t.strokeIndexes?.[h] ?? null),
                              ),
                            })
                          }
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="primary wide">Save course</button>
        {course && (
          <button
            type="button"
            className="danger wide"
            onClick={() => {
              if (
                confirm(
                  "Delete this course? Existing rounds and their scores will be kept.",
                )
              )
                onDelete();
            }}
          >
            Delete course
          </button>
        )}
      </form>
    </main>
  );
}
