import { useState } from "react";
import type { Course, Tee } from "./types";
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
}: {
  course?: Course;
  onSave: (c: Course) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Course>(() =>
    course
      ? structuredClone(course)
      : { id: crypto.randomUUID(), name: "", holes: 18, tees: [newTee(18)] },
  );
  function teeChange(id: string, patch: Partial<Tee>) {
    setDraft((d) => ({
      ...d,
      tees: d.tees.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }
  return (
    <main>
      <button className="text-button" onClick={onCancel}>
        ← Cancel
      </button>
      <div className="eyebrow">COURSE NOTEBOOK</div>
      <h1>{course ? "Edit course." : "Make it yours."}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...draft, name: draft.name.trim() });
        }}
      >
        <label>
          Course name
          <input
            required
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
              setDraft({
                ...draft,
                holes,
                tees: draft.tees.map((t) => ({
                  ...t,
                  pars: Array.from({ length: holes }, (_, i) => t.pars[i] ?? 4),
                  yardages: Array.from(
                    { length: holes },
                    (_, i) => t.yardages?.[i] ?? null,
                  ),
                })),
              });
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
                    pars: [
                      ...draft.tees.find((x) => x.id === e.target.value)!.pars,
                    ],
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
              onClick={() =>
                setDraft({
                  ...draft,
                  tees: draft.tees.filter((x) => x.id !== t.id),
                })
              }
            >
              Remove tee
            </button>
          </fieldset>
        ))}
        <h2>Hole details</h2>
        <p className="muted">Pars belong to each tee. Yardages are optional.</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hole</th>
                {draft.tees.map((t) => (
                  <th key={t.id}>
                    {t.name}
                    <small>Par / yards</small>
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
                          min="1"
                          max="1500"
                          aria-label={`Hole ${i + 1} ${t.name} yardage`}
                          placeholder="—"
                          value={t.yardages?.[i] ?? ""}
                          onChange={(e) =>
                            teeChange(t.id, {
                              yardages: Array.from(
                                { length: draft.holes },
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
