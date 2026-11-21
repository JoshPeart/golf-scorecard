import { pathToFileURL } from 'node:url';

// Contracts: https://www.golfcore.org/openapi.json and
// https://api.golfcourseapi.com/docs/api/openapi.yml.
export const targets = [
  ['St Andrews Old Course', 'St Andrews', ['old']],
  ['Royal Birkdale', 'Birkdale'],
  ['Kedleston Park', 'Kedleston'],
  ['Willesley Park', 'Willesley'],
  ['Carnoustie Championship', 'Carnoustie', ['championship']],
  ['Wentworth West', 'Wentworth', ['west']],
  ['Allestree Park (Derby)', 'Allestree'],
  ['Lickey Hills (Birmingham)', 'Lickey'],
  ['Brent Valley (London)', 'Brent Valley'],
  ['Bramcote Hills (Nottingham)', 'Bramcote', ['hills']],
];

const words = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
const positive = value => typeof value === 'number' && value > 0;
const uk = course => {
  const country = String(course.country ?? course.location?.country ?? '').toUpperCase();
  if (country) return ['GB', 'GBR', 'UK', 'UNITED KINGDOM', 'ENGLAND', 'SCOTLAND', 'WALES', 'NORTHERN IRELAND'].includes(country);
  return false;
};

export function selectCourse(courses, target) {
  const [, query, extra = []] = target;
  const required = [...words(query), ...extra];
  const matches = courses.filter(c => uk(c) && required.every(w => words(`${c.club_name ?? ''} ${c.course_name ?? c.name}`).includes(w)));
  if (matches.length > 1) throw new Error(`ambiguous UK matches: ${matches.map(c => c.course_name ?? c.name).join(', ')}`);
  return matches[0];
}

export function metrics(course, provider) {
  let layouts;
  if (provider === 'GolfCore') {
    layouts = course.layouts ?? [];
  } else if (provider === 'GolfCourseAPI') {
    const groups = course.tees ?? {};
    if (!groups || Array.isArray(groups) || typeof groups !== 'object') throw new Error('invalid tees response');
    const tees = Object.values(groups).flatMap(group => {
      if (!Array.isArray(group)) throw new Error('invalid tees response');
      return group.map(t => ({ ...t, holes: t.holes?.map((h, i) => ({ position: i + 1, par: h.par, yards: h.yardage, stroke_index: h.handicap })), count: t.number_of_holes }));
    });
    layouts = [{ tees }];
  } else {
    throw new Error('unknown provider');
  }
  if (!Array.isArray(layouts)) throw new Error('invalid layouts response');
  const all = [];
  let differs = false;
  let known = layouts.length > 0;
  for (const layout of layouts) {
    if (!Array.isArray(layout.tees)) throw new Error('invalid tees response');
    const tees = layout.tees.map(t => {
      const holes = t.holes ?? [];
      if (!Array.isArray(holes)) throw new Error('invalid holes response');
      const count = t.count ?? (layout.holes?.length || course.hole_count);
      const positions = holes.map(h => h.position);
      const full = positive(count) && holes.length === count && new Set(positions).size === count && positions.every(p => Number.isInteger(p) && p >= 1 && p <= count);
      return { holes, count, full };
    });
    all.push(...tees);
    known &&= tees.length >= 2 && tees.every(t => t.full && t.holes.every(h => positive(h.par))) && new Set(tees.map(t => t.count)).size === 1;
    const pars = new Map();
    for (const t of tees) for (const h of t.holes) {
      if (!positive(h.position) || !positive(h.par)) continue;
      const key = `${t.count}:${h.position}`;
      const values = pars.get(key) ?? new Set();
      values.add(h.par); pars.set(key, values);
      if (values.size > 1) differs = true;
    }
  }
  const completeness = field => `${all.filter(t => t.full && t.holes.every(h => positive(h[field]))).length}/${all.length} full; ${all.filter(t => t.holes.some(h => positive(h[field]))).length} any`;
  return { holes: [...new Set(all.map(t => t.count ?? '?'))].join('/') || course.hole_count || '?', tees: all.length, yardages: completeness('yards'), si: completeness('stroke_index'), parDiff: differs ? 'yes' : known ? 'no' : 'unknown' };
}

export function providers(env = process.env) {
  return [
    { name: 'GolfCore', base: 'https://api.golfcore.org/v1', key: env.GOLFCORE_API_KEY, env: 'GOLFCORE_API_KEY', scheme: 'Bearer' },
    { name: 'GolfCourseAPI', base: 'https://api.golfcourseapi.com/v1', key: env.GOLFCOURSEAPI_KEY, env: 'GOLFCOURSEAPI_KEY', scheme: 'Key' },
  ];
}

export async function searchCourses(provider, get, target) {
  if (provider === 'GolfCourseAPI') {
    const result = await get(`/search?${new URLSearchParams({ search_query: target[1] })}`);
    if (!Array.isArray(result?.courses)) throw new Error('invalid search response');
    if (result.metadata?.last_page > result.metadata?.current_page) throw new Error('search truncated');
    return result.courses;
  }
  const courses = [];
  let total;
  do {
    const result = await get(`/courses?${new URLSearchParams({ q: target[1], country: 'gb', limit: '200', offset: String(courses.length) })}`);
    if (!Array.isArray(result?.courses) || !Number.isInteger(result.total) || result.total < 0) throw new Error('invalid search response');
    total = result.total;
    if (result.offset !== courses.length || (!result.courses.length && courses.length < total)) throw new Error('invalid pagination');
    courses.push(...result.courses);
  } while (courses.length < total);
  return courses;
}

export async function request(url, headers, fetcher = fetch) {
  const response = await fetcher(url, { headers, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}${response.headers.get('Retry-After') ? `; Retry-After ${response.headers.get('Retry-After')}s` : ''}`);
  const data = await response.json();
  if (data?.error || data?.message) throw new Error(`API error response (see provider status/docs)`);
  return data;
}

export async function main(env = process.env, fetcher = fetch, log = console.log) {
  const rows = [];
  const sources = new Set();
  for (const p of providers(env)) {
    let stopped;
    let requests = 0;
    if (!p.key) log(`${p.name}: missing key (${p.env}); ${p.name === 'GolfCore' ? 'reads are keyless, continuing' : 'skipping provider'}.`);
    const headers = p.key ? { Authorization: `${p.scheme} ${p.key}` } : {};
    const get = async path => { requests++; return request(p.base + path, headers, fetcher); };
    for (const target of targets) {
      const row = { course: target[0], provider: p.name, result: '-', matched: '-', holes: '-', tees: '-', yardages: '-', si: '-', parDiff: '-' };
      rows.push(row);
      if (p.name === 'GolfCourseAPI' && !p.key) { row.result = 'missing key'; continue; }
      if (stopped) { row.result = 'skipped (provider error)'; continue; }
      try {
        const match = selectCourse(await searchCourses(p.name, get, target), target);
        if (!match) { row.result = 'not found'; continue; }
        const id = match.slug ?? match.id;
        if (!id) throw new Error('missing course identifier');
        row.result = 'found'; row.matched = `${match.course_name ?? match.name} [${id}]`;
        const detail = await get(`/courses/${encodeURIComponent(id)}`);
        if (!detail) throw new Error('detail returned null');
        Object.assign(row, metrics(detail, p.name));
        if (p.name === 'GolfCore') {
          sources.add(detail.url ?? match.url);
          log(`GolfCore layouts: ${id}: ${detail.layouts?.length ?? 0} (${detail.layouts?.map(l => l.name).join('; ') ?? ''})`);
        }
      } catch (error) {
        row.result = `error: ${error.message}`;
        // No automatic retries or further requests after errors/quota failures.
        stopped = true;
        process.exitCode = 1;
      }
    }
    const own = rows.filter(r => r.provider === p.name);
    log(`${p.name}: ${own.filter(r => r.result === 'found').length}/10 found; ${own.filter(r => r.result === 'not found').length} not found; ${own.filter(r => !['found', 'not found'].includes(r.result)).length} unchecked/error; ${requests} requests.`);
  }
  log(['course | provider | result | matched | holes | tees | yardages | SI | parDiff', ...rows.map(r => Object.values(r).join(' | '))].join('\n'));
  log('Yardages/SI: full = all holes populated for a tee; any = at least one hole. No reference-card fallback. Unknown is not no.');
  log('All layouts included; par differences compared only within each layout and equal hole counts. Name + UK country required.');
  log('Data: GolfCore; source course links:');
  for (const url of sources) if (url) log(url);
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
