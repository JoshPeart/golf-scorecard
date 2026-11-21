import { useEffect, useRef, useState } from "react";
import type { Course, Round, Tee } from "./types";
import { createRound, teeHoleCount, type RoundLength } from "./rounds";
import {
  needsChecking,
  searchCourses,
  searchLocal,
  distanceMiles,
} from "./courseSearch";
import {
  GolfCoreProvider,
  GolfCourseAPIProvider,
  type CourseProvider,
  type CourseSummary,
  type Location,
} from "./providers";
import { CourseBadges, SourceLink } from "./CourseBadges";
import {
  debounceSearch,
  savedCourseGroups,
  teeTotals,
} from "./courseSelection";

const defaultProviders: CourseProvider[] = [
  new GolfCoreProvider(),
  new GolfCourseAPIProvider(),
];
const sourceLabel = (source: string) =>
  source === "golfcore"
    ? "GolfCore"
    : source === "golfcourseapi"
      ? "GolfCourseAPI"
      : "Manual";
const cachedCourse = (courses: Course[], result: CourseSummary) =>
  courses.find((c) =>
    result.provider === "local"
      ? c.id === result.sourceId
      : c.source === result.provider && c.sourceId === result.sourceId,
  );

export function TeeCard({
  tee,
  selected,
  onSelect,
}: {
  tee: Tee;
  selected: boolean;
  onSelect: () => void;
}) {
  const totals = teeTotals(tee);
  return (
    <button
      type="button"
      className={`tee-card${selected ? " selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <strong>
        <span
          className="tee-swatch"
          style={{ backgroundColor: tee.color ?? "#ccd3c4" }}
        />
        {tee.name}
      </strong>
      <small>
        {tee.gender ?? "Mixed"} · Par {totals.par}
        {totals.yards != null
          ? ` · ${totals.yards.toLocaleString()} yds`
          : " · Yardage unavailable"}
      </small>
      {(tee.courseRating != null || tee.slope != null) && (
        <small>
          Rating {tee.courseRating ?? "—"} · Slope {tee.slope ?? "—"}
        </small>
      )}
    </button>
  );
}

export function NewRound({
  courses,
  rounds,
  selectedId,
  onSelect,
  onImport,
  onFavourite,
  onEdit,
  onStart,
  onBack,
  onAdd,
  providers = defaultProviders,
}: {
  courses: Course[];
  rounds: Round[];
  selectedId: string;
  onSelect: (id: string) => void;
  onImport: (course: Course) => void;
  onFavourite: (course: Course) => void;
  onEdit: (id: string) => void;
  onStart: (round: Round) => void;
  onBack: () => void;
  onAdd: () => void;
  providers?: CourseProvider[];
}) {
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [location, setLocation] = useState<Location>();
  const [geoError, setGeoError] = useState("");
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState<
    Awaited<ReturnType<typeof searchCourses>>
  >({ results: [], errors: {} });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [teeId, setTeeId] = useState("");
  const [names, setNames] = useState("");
  const [length, setLength] = useState<RoundLength>("18");
  const picking = useRef({ id: 0 });
  const course = courses.find((c) => c.id === selectedId);
  const tee = course?.tees.find((t) => t.id === teeId) ?? course?.tees[0];
  const holes = course && tee ? teeHoleCount(course, tee) : course?.holes;
  const searching = !!query.trim() || !!location;
  useEffect(() => {
    const pending = picking.current;
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      pending.id++;
    };
  }, []);
  useEffect(() => {
    let current = true;
    const cancel = debounceSearch(() => {
      if (!searching) {
        setSearch({ results: [], errors: {} });
        setLoading(false);
        return;
      }
      setLoading(true);
      searchCourses(query, { courses, location, providers, online }).then(
        (result) => {
          if (current) {
            setSearch(result);
            setLoading(false);
          }
        },
      );
    });
    return () => {
      current = false;
      cancel();
    };
  }, [query, location, courses, providers, online, searching]);
  const local = searchLocal(courses, query);
  const localIds = new Set(
    local.map(
      (c) =>
        `${c.source === "golfcore" || c.source === "golfcourseapi" ? c.source : "local"}:${c.sourceId ?? c.id}`,
    ),
  );
  const results = search.results.filter(
    (r) => !localIds.has(`${r.provider}:${r.sourceId}`),
  );
  const ordered = [
    ...local.map(
      (c) =>
        ({
          provider:
            c.source === "golfcore" || c.source === "golfcourseapi"
              ? c.source
              : "local",
          sourceId: c.sourceId ?? c.id,
          name: c.name,
          postcode: c.postcode,
          country: c.country,
          lat: c.lat,
          lng: c.lng,
        }) as CourseSummary,
    ),
    ...results,
  ];
  if (location)
    ordered.sort((a, b) => {
      const distance = (r: CourseSummary) =>
        r.lat != null && r.lng != null
          ? distanceMiles(location, { lat: r.lat, lng: r.lng })
          : (r.distanceMiles ?? Infinity);
      return distance(a) - distance(b);
    });
  async function pick(result: CourseSummary) {
    const cached = cachedCourse(courses, result);
    setFetchError("");
    setTeeId("");
    if (cached) {
      onSelect(cached.id);
      return;
    }
    if (!online) {
      setFetchError("This course is not saved offline yet.");
      return;
    }
    const provider = providers.find((p) => p.id === result.provider);
    if (!provider) return;
    const token = ++picking.current.id;
    setFetching(true);
    try {
      const fetched = await provider.getCourse(result.sourceId);
      if (token === picking.current.id) onImport(fetched);
    } catch (error) {
      if (token === picking.current.id)
        setFetchError(
          error instanceof Error
            ? error.message
            : "Could not load course. Try again.",
        );
    } finally {
      if (token === picking.current.id) setFetching(false);
    }
  }
  function nearMe() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Location is unavailable on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setQuery("");
        onSelect("");
        setLocating(false);
      },
      (error) => {
        setGeoError(
          error.code === 1
            ? "Location permission denied. Search by course name instead."
            : "Could not find your location. Search by course name instead.",
        );
        setLocating(false);
      },
      { timeout: 10_000 },
    );
  }
  function courseRow(c: Course) {
    return (
      <div className="search-result" key={c.id}>
        <button
          className="result-main"
          onClick={() => {
            onSelect(c.id);
            setTeeId("");
          }}
        >
          <strong>{c.name}</strong>
          <small>
            {[c.postcode, sourceLabel(c.source ?? "manual")]
              .filter(Boolean)
              .join(" · ")}
          </small>
          <CourseBadges course={c} cached />
        </button>
        <button
          className="star"
          aria-label={`${c.favourite ? "Unfavourite" : "Favourite"} ${c.name}`}
          aria-pressed={!!c.favourite}
          onClick={() => onFavourite(c)}
        >
          {c.favourite ? "★" : "☆"}
        </button>
      </div>
    );
  }
  return (
    <main>
      <button className="text-button" onClick={onBack}>
        ← Back
      </button>
      <div className="eyebrow">FIRST TEE</div>
      <h1>Let's play.</h1>
      <label className="search-label">
        Find a course
        <input
          type="search"
          placeholder="Course name, e.g. Kedleston"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLocation(undefined);
            onSelect("");
            setFetchError("");
            setSearch({ results: [], errors: {} });
            setLoading(online && !!e.target.value.trim());
          }}
        />
      </label>
      <button
        className="near-button"
        disabled={locating || fetching}
        onClick={nearMe}
      >
        {locating ? "Finding your location…" : "◎ Courses near me"}
      </button>
      {geoError && (
        <p role="alert" className="warning">
          {geoError}
        </p>
      )}
      {!online && (
        <p role="status" className="offline-note">
          Offline: showing saved courses
        </p>
      )}
      {fetchError && (
        <p role="alert" className="warning">
          {fetchError}
        </p>
      )}
      {fetching && (
        <p role="status" className="muted">
          Loading course…
        </p>
      )}
      {!course ? (
        <>
          {searching ? (
            <section aria-label="Course results" aria-busy={loading}>
              {loading && online && (
                <p role="status" className="muted">
                  Searching courses…
                </p>
              )}
              {online &&
                Object.entries(search.errors).map(([provider, error]) => (
                  <p role="alert" className="warning" key={provider}>
                    {sourceLabel(provider)}: {error?.message}. Saved courses are
                    still available.
                  </p>
                ))}
              {ordered.map((r) => {
                const cached = cachedCourse(courses, r);
                const miles =
                  location && r.lat != null && r.lng != null
                    ? distanceMiles(location, { lat: r.lat, lng: r.lng })
                    : r.distanceMiles;
                return (
                  <div
                    className="search-result"
                    key={`${r.provider}:${r.sourceId}`}
                  >
                    <button
                      className="result-main"
                      disabled={fetching || (!online && !cached)}
                      onClick={() => pick(r)}
                    >
                      <strong>{r.name}</strong>
                      <small>
                        {[
                          r.town ?? cached?.address,
                          r.postcode,
                          miles != null
                            ? `${miles.toFixed(1)} miles`
                            : undefined,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      <small>{sourceLabel(r.provider)}</small>
                      {cached && <CourseBadges course={cached} cached />}
                    </button>
                    {cached && (
                      <button
                        className="star"
                        aria-label={`${cached.favourite ? "Unfavourite" : "Favourite"} ${cached.name}`}
                        aria-pressed={!!cached.favourite}
                        onClick={() => onFavourite(cached)}
                      >
                        {cached.favourite ? "★" : "☆"}
                      </button>
                    )}
                  </div>
                );
              })}
              {!loading && !ordered.length && (
                <p className="empty">No courses found</p>
              )}
            </section>
          ) : (
            savedCourseGroups(courses, rounds).map(
              (group) =>
                !!group.courses.length && (
                  <section key={group.name}>
                    <h2>{group.name}</h2>
                    {group.courses.map(courseRow)}
                  </section>
                ),
            )
          )}
          {!searching && !courses.length && (
            <p className="empty">
              Find your course, or add your own scorecard.
            </p>
          )}
        </>
      ) : (
        <section className="tee-picker">
          <div className="section-heading">
            <h2>{course.name}</h2>
            <button className="text-button" onClick={() => onSelect("")}>
              Change
            </button>
          </div>
          <CourseBadges course={course} cached />
          {!!needsChecking(course).length && (
            <div className="warning">
              <strong>Check this scorecard</strong>
              <ul>
                {needsChecking(course).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <SourceLink course={course} />
          <button className="text-button" onClick={() => onEdit(course.id)}>
            Edit course
          </button>
          <h2>Choose your tee</h2>
          {course.tees.map((t) => (
            <TeeCard
              key={t.id}
              tee={t}
              selected={tee?.id === t.id}
              onSelect={() => setTeeId(t.id)}
            />
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!tee || tee.pars.length !== holes || tee.pars.some((p) => !p))
                return;
              onStart(
                createRound(
                  course,
                  tee,
                  [
                    "Me",
                    ...names
                      .split(",")
                      .map((n) => n.trim())
                      .filter(Boolean),
                  ],
                  length,
                ),
              );
            }}
          >
            {holes === 18 && (
              <label>
                Holes to play
                <select
                  value={length}
                  onChange={(e) => setLength(e.target.value as RoundLength)}
                >
                  <option value="18">18 holes</option>
                  <option value="front">Front 9 (1–9)</option>
                  <option value="back">Back 9 (10–18)</option>
                </select>
              </label>
            )}
            <label>
              Playing partners <span className="muted">(optional)</span>
              <input
                maxLength={200}
                value={names}
                onChange={(e) => setNames(e.target.value)}
                placeholder="Alex, Sam"
              />
            </label>
            <p className="muted">
              Separate names with commas. You're already in as “Me”.
            </p>
            <button
              className="primary wide"
              disabled={
                !tee || tee.pars.length !== holes || tee.pars.some((p) => !p)
              }
            >
              Start round ↗
            </button>
          </form>
        </section>
      )}
      <button className="text-button manual-link" onClick={onAdd}>
        Can't find it? Add it manually
      </button>
    </main>
  );
}
