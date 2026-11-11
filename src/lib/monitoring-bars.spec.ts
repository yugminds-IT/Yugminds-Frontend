import test from 'node:test';
import assert from 'node:assert/strict';
import { bars } from '../components/admin/monitoring/bars.ts';

// The page groups saved hours by the viewer's own clock. Run this file with TZ=Asia/Kolkata and TZ=UTC.
const point = (iso: string, requests = 10, extra: Record<string, number> = {}) => ({
  hour: iso, requests, ok: requests, client_errors: 0, server_errors: 0, avg_ms: 100, slow: 0, over_1s: 0, max_ms: 100, ...extra,
});
/** One point per hour between two instants, like the server sends. */
const hours = (fromIso: string, count: number, make = (iso: string) => point(iso)) =>
  Array.from({ length: count }, (_, i) => make(new Date(new Date(fromIso).getTime() + i * 3_600_000).toISOString()));

test('24 hours: one bar per hour, labelled on the viewer\'s clock', () => {
  const b = bars(hours('2026-11-11T00:00:00Z', 24), '24');
  assert.equal(b.length, 24);
  assert.ok(new Set(b.map((x) => x.label)).size === 24, 'every hour has its own label');
});

test('7 days: one bar per calendar day, not 24-hour blocks counted from the first hour', () => {
  // 7 days of traffic that start in the middle of a day (10:00 UTC)
  const series = hours('2026-11-05T10:00:00Z', 168);
  const b = bars(series, '168');
  // every full bar covers exactly one local calendar day, so the day names are all different and in order
  assert.equal(new Set(b.map((x) => x.label)).size, b.length);
  const total = b.reduce((a, x) => a + x.requests, 0);
  assert.equal(total, 168 * 10, 'nothing is lost or counted twice');
  // 168 hours that start mid-day span 8 local days: a partial first day, six full days, a partial last day
  assert.equal(b.length, 8);
  const full = b.slice(1, -1);
  assert.ok(full.every((x) => x.requests === 24 * 10), 'the middle days are whole days');
  assert.ok(b[0].requests < 24 * 10 && b[b.length - 1].requests < 24 * 10, 'the first and last days are partial');
});

test('3 days: blocks of 3 hours on the clock, named by where the block starts', () => {
  const b = bars(hours('2026-11-08T00:00:00Z', 72), '72');
  assert.equal(b.reduce((a, x) => a + x.requests, 0), 72 * 10);
  // a full block holds 3 hours; only the first and last block can be partial
  assert.ok(b.slice(1, -1).every((x) => x.requests === 30));
  assert.ok(b.every((x) => /^[A-Z][a-z]{2} \d{1,2}(:\d{2})? (am|pm)$/i.test(x.label)), 'labels look like "Mon 3 pm"');
});

test('averages are weighted by traffic, so a busy hour counts more than a quiet one', () => {
  const series = [point('2026-11-11T08:00:00Z', 90, { avg_ms: 100 }), point('2026-11-11T09:00:00Z', 10, { avg_ms: 1000 })];
  const [b] = bars(series, '168');
  assert.equal(b.requests, 100);
  assert.equal(b.avg, 190); // (90*100 + 10*1000) / 100
});

test('quiet hours stay empty, with no invented traffic', () => {
  const b = bars(hours('2026-11-11T00:00:00Z', 24, (iso) => point(iso, 0)), '24');
  assert.ok(b.every((x) => x.requests === 0 && x.avg === 0 && x.slowShare === 0));
});

test('errors and slow requests add up per bar', () => {
  const series = [point('2026-11-11T08:00:00Z', 10, { server_errors: 2, over_1s: 1, slow: 3 }), point('2026-11-11T09:00:00Z', 10, { server_errors: 1, over_1s: 0, slow: 2 })];
  const [b] = bars(series, '168');
  assert.equal(b.server, 3);
  assert.equal(b.over1s, 1);
  assert.equal(b.slowShare, 5 / 20);
});
