import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main, metrics, request, searchCourses, selectCourse, targets } from './coverage-test.mjs';

const hole = (position = 1, par = 4) => ({ position, par, yards: 400, stroke_index: 1 });
const tee = holes => ({ name: 'White', holes });
const card = tees => ({ hole_count: 1, layouts: [{ holes: [hole()], tees }] });

test('matches UK names/layouts from both providers, rejects US namesakes and ambiguity', () => {
  const core = { slug: 'west', name: 'Wentworth West', country: 'gb' };
  const secondary = { id: 'west', club_name: 'Wentworth Club', course_name: 'West', location: { country: 'England' } };
  assert.equal(selectCourse([core], targets[5]), core);
  assert.equal(selectCourse([secondary], targets[5]), secondary);
  for (const country of ['US', '', undefined]) assert.equal(selectCourse([{ ...core, country }], targets[5]), undefined);
  assert.equal(selectCourse([{ ...core, name: 'Wentworth East' }], targets[5]), undefined);
  assert.equal(selectCourse([], targets[0]), undefined);
  assert.equal(selectCourse([{ name: 'Bramcote Waters Golf Course', country: 'gb' }], targets[9]), undefined);
  assert.throws(() => selectCourse([core, core], targets[5]), /ambiguous/);
});

test('GolfCore completeness uses tee holes, never reference-card fallbacks', () => {
  const c = card([tee([hole()]), tee([hole(1, 5)]), tee([])]);
  assert.deepEqual(metrics(c, 'GolfCore'), { holes: '1', tees: 3, yardages: '2/3 full; 2 any', si: '2/3 full; 2 any', parDiff: 'yes' });
  c.layouts[0].tees[1].holes[0] = { ...hole(), stroke_index: null, yards: 0 };
  assert.equal(metrics(c, 'GolfCore').parDiff, 'unknown');
  assert.equal(metrics(c, 'GolfCore').si, '1/3 full; 1 any');
  c.layouts[0].tees.pop();
  assert.equal(metrics(c, 'GolfCore').parDiff, 'no');
  c.layouts[0].tees[1].holes[0].par = null;
  assert.equal(metrics(c, 'GolfCore').parDiff, 'unknown');
  assert.equal(metrics({}, 'GolfCore').yardages, '0/0 full; 0 any');
  assert.equal(metrics({}, 'GolfCore').parDiff, 'unknown');
});

test('aligns par comparisons by position and keeps layouts separate', () => {
  const c = { hole_count: 2, layouts: [{ holes: [hole(1), hole(2)], tees: [tee([hole(1, 4), hole(2, 5)]), tee([hole(2, 5), hole(1, 4)])] }] };
  assert.equal(metrics(c, 'GolfCore').parDiff, 'no');
  c.layouts.push({ holes: [hole(1)], tees: [tee([hole(1, 3)]), tee([hole(1, 3)])] });
  assert.equal(metrics(c, 'GolfCore').parDiff, 'no');
  c.layouts[0].tees[1].holes = [hole(1), hole(1)];
  assert.equal(metrics(c, 'GolfCore').yardages, '3/4 full; 4 any');
  assert.equal(metrics(c, 'GolfCore').parDiff, 'unknown');
});

test('GolfCourseAPI maps gender groups, hole yardage and handicap', () => {
  const t = par => ({ number_of_holes: 1, holes: [{ par, yardage: 350, handicap: 2 }] });
  const c = { tees: { male: [t(4)], female: [t(5)] } };
  assert.deepEqual(metrics(c, 'GolfCourseAPI'), { holes: '1', tees: 2, yardages: '2/2 full; 2 any', si: '2/2 full; 2 any', parDiff: 'yes' });
  c.tees.female[0].holes[0].par = 4;
  assert.equal(metrics(c, 'GolfCourseAPI').parDiff, 'no');
  c.tees.female[0].holes = [];
  assert.equal(metrics(c, 'GolfCourseAPI').parDiff, 'unknown');
  assert.equal(metrics({}, 'GolfCourseAPI').si, '0/0 full; 0 any');
  assert.throws(() => metrics({ tees: { male: {} } }, 'GolfCourseAPI'), /invalid tees/);
  assert.throws(() => metrics({ layouts: {} }, 'GolfCore'), /invalid layouts/);
  assert.throws(() => metrics({ layouts: [{ tees: {} }] }, 'GolfCore'), /invalid tees/);
  assert.throws(() => metrics(card([tee({})]), 'GolfCore'), /invalid holes/);
  assert.throws(() => metrics({}, 'invalid'), /unknown provider/);
});

test('search pagination, empty results and malformed/truncated responses', async () => {
  const calls = [];
  const rows = await searchCourses('GolfCore', async path => {
    calls.push(path);
    return { courses: [{ slug: String(calls.length) }], total: 2, offset: calls.length - 1 };
  }, targets[0]);
  assert.equal(rows.length, 2);
  assert.match(calls[0], /country=gb/);
  assert.match(calls[1], /offset=1/);
  assert.deepEqual(await searchCourses('GolfCore', async () => ({ courses: [], total: 0, offset: 0 }), targets[0]), []);
  await assert.rejects(searchCourses('GolfCore', async () => ({ courses: [], total: 1, offset: 0 }), targets[0]), /invalid pagination/);
  await assert.rejects(searchCourses('GolfCore', async () => ({}), targets[0]), /invalid search/);
  assert.deepEqual(await searchCourses('GolfCourseAPI', async path => {
    assert.match(path, /^\/search\?search_query=St\+Andrews$/);
    return { courses: [] };
  }, targets[0]), []);
  await assert.rejects(searchCourses('GolfCourseAPI', async () => ({ courses: [], metadata: { current_page: 1, last_page: 2 } }), targets[0]), /truncated/);
});

test('HTTP quota, API errors and malformed JSON remain errors', async () => {
  assert.deepEqual(await request('https://example.test', {}, async () => new Response('{"courses":[]}')), { courses: [] });
  await assert.rejects(request('https://example.test', {}, async () => new Response('', { status: 429, headers: { 'Retry-After': '60' } })), /HTTP 429; Retry-After 60s/);
  await assert.rejects(request('https://example.test', {}, async () => new Response('{"error":"backend unavailable"}')), /API error/);
  await assert.rejects(request('https://example.test', {}, async () => new Response('not JSON')), SyntaxError);
});

test('main skips missing secondary key; uses Bearer/Key; stops each provider after error', async () => {
  let calls = 0;
  const rows = await main({}, async (_url, options) => {
    calls++;
    assert.deepEqual(options.headers, {});
    return new Response('{"courses":[],"total":0,"offset":0}');
  }, () => {});
  assert.equal(calls, 10);
  assert.equal(rows.filter(r => r.result === 'missing key').length, 10);
  const originalExitCode = process.exitCode;
  const seen = [];
  try {
    const keyed = await main({ GOLFCORE_API_KEY: 'test-core', GOLFCOURSEAPI_KEY: 'test-secondary' }, async (url, options) => {
      seen.push(options.headers.Authorization);
      if (url.includes('golfcore.org')) return new Response('', { status: 429 });
      if (url.includes('/search?')) return new Response(JSON.stringify({ courses: [{ id: 'example1', course_name: 'St Andrews Old Course', location: { country: 'Scotland' } }] }));
      return new Response('null');
    }, () => {});
    assert.equal(process.exitCode, 1);
    assert.equal(keyed[0].result, 'error: HTTP 429');
    assert.equal(keyed[1].result, 'skipped (provider error)');
    assert.equal(keyed[10].result, 'error: detail returned null');
    assert.deepEqual(seen, ['Bearer test-core', 'Key test-secondary', 'Key test-secondary']);
  } finally {
    process.exitCode = originalExitCode;
  }
});
