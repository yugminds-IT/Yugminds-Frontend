import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowPendingReportsPopup } from './pending-reports-popup.ts';

const pending = [{ period_id: 'p1' }];

test('shows when on duty with reports still pending', () => {
  assert.equal(shouldShowPendingReportsPopup({ pendingPeriods: pending, attendance: { status: 'Unreported' } }), true);
  assert.equal(shouldShowPendingReportsPopup({ pendingPeriods: pending, attendance: { status: 'Absent' } }), true); // after cutoff, still nudge
});

test('hidden once every report is submitted (nothing pending)', () => {
  assert.equal(shouldShowPendingReportsPopup({ pendingPeriods: [], attendance: { status: 'Present' } }), false);
  assert.equal(shouldShowPendingReportsPopup({ pendingPeriods: [] }), false);
});

test('hidden on holidays, off days, approved leave', () => {
  assert.equal(shouldShowPendingReportsPopup({ notScheduledToday: true, pendingPeriods: pending }), false);
  assert.equal(shouldShowPendingReportsPopup({ pendingPeriods: pending, attendance: { status: 'Holiday' } }), false);
  assert.equal(shouldShowPendingReportsPopup({ pendingPeriods: pending, attendance: { status: 'Leave-Approved' } }), false);
});

test('hidden while data is not loaded', () => {
  assert.equal(shouldShowPendingReportsPopup(undefined), false);
  assert.equal(shouldShowPendingReportsPopup(null), false);
});
