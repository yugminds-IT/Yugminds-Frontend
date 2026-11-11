import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementLive, changesFrom } from '../components/admin/controls/changes.ts';

const base = {
  maintenance_mode: false,
  maintenance_message: 'Back soon',
  announcement: { enabled: false, text: '', level: 'info' as const },
  feature_flags: { beta: true, alpha: false },
};

test('sends nothing when nothing changed', () => {
  assert.deepEqual(changesFrom(base, { ...base }), {});
});

test('editing only the banner sends only the banner, so it cannot undo maintenance mode', () => {
  const next = { ...base, announcement: { enabled: true, text: 'Hello', level: 'warning' as const } };
  assert.deepEqual(changesFrom(base, next), { announcement: next.announcement });
});

test('switching maintenance on sends only that', () => {
  assert.deepEqual(changesFrom(base, { ...base, maintenance_mode: true }), { maintenance_mode: true });
});

test('a changed message is sent on its own', () => {
  assert.deepEqual(changesFrom(base, { ...base, maintenance_message: 'Back at 6' }), { maintenance_message: 'Back at 6' });
});

test('adding, switching and removing flags send the full flag list', () => {
  assert.deepEqual(changesFrom(base, { ...base, feature_flags: { ...base.feature_flags, gamma: false } }), { feature_flags: { beta: true, alpha: false, gamma: false } });
  assert.deepEqual(changesFrom(base, { ...base, feature_flags: { beta: false, alpha: false } }), { feature_flags: { beta: false, alpha: false } });
  assert.deepEqual(changesFrom(base, { ...base, feature_flags: { beta: true } }), { feature_flags: { beta: true } });
});

test('the order flags were added in is not a change', () => {
  assert.deepEqual(changesFrom(base, { ...base, feature_flags: { alpha: false, beta: true } }), {});
});

test('several sections changed at once are all sent', () => {
  const next = { ...base, maintenance_mode: true, announcement: { enabled: true, text: 'x', level: 'critical' as const } };
  assert.deepEqual(Object.keys(changesFrom(base, next)).sort(), ['announcement', 'maintenance_mode']);
});

test('an announcement only counts as live with text', () => {
  assert.equal(announcementLive({ enabled: true, text: 'Hi', level: 'info' }), true);
  assert.equal(announcementLive({ enabled: true, text: '   ', level: 'info' }), false);
  assert.equal(announcementLive({ enabled: false, text: 'Hi', level: 'info' }), false);
});
