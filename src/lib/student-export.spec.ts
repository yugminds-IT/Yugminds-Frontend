import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classKey, exportClassOptions, matchingEnrollment } from './student-export.ts';

const students = [
  { student_schools: [{ school_id: 'a', grade: 'Grade 1', section: 'A' }] },
  { student_schools: [{ school_id: 'a', grade: 'Grade 1', section: 'B' }] },
  { student_schools: [{ school_id: 'a', grade: 'Grade 10', section: 'A' }] },
  { student_schools: [{ school_id: 'b', grade: 'Grade 4', section: 'A' }] },
  { student_schools: [{ school_id: 'b', grade: 'Grade 2', section: 'A', is_active: false }] },
];

test('lists only the selected school’s grades, sorted numerically, with section counts', () => {
  const opts = exportClassOptions(students, ['a']);
  assert.deepEqual(opts.map((o) => o.grade), ['Grade 1', 'Grade 10']);
  assert.deepEqual(
    opts[0].sections.map((s) => [s.section, s.count]),
    [['A', 1], ['B', 1]],
  );
  assert.equal(opts[0].count, 2);
});

test('all schools when none selected; inactive enrollments ignored', () => {
  assert.deepEqual(
    exportClassOptions(students, []).map((o) => o.grade),
    ['Grade 1', 'Grade 4', 'Grade 10'],
  );
});

test('school and class must match on the same enrollment', () => {
  const multi = {
    student_schools: [
      { school_id: 'a', grade: 'Grade 3', section: 'A' },
      { school_id: 'b', grade: 'Grade 5', section: 'A' },
    ],
  };
  assert.equal(matchingEnrollment(multi, ['b'], [classKey('Grade 3', 'A')]), null);
  assert.equal(matchingEnrollment(multi, ['b'], [classKey('Grade 5', 'A')])?.school_id, 'b');
  assert.equal(matchingEnrollment(multi, [], [])?.school_id, 'a');
});
