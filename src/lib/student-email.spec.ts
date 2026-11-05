import test from 'node:test';
import assert from 'node:assert/strict';
import { studentEmailLocal, uniqueStudentEmail } from './student-email.ts';

test('local part is firstname.initial', () => {
  assert.equal(studentEmailLocal('DEEKSHITHA M'), 'deekshitha.m');
  assert.equal(studentEmailLocal('ADWAITH REDDY G'), 'adwaith.g');
  assert.equal(studentEmailLocal('GUDI ASHWITH KUMAR'), 'gudi.k');
  assert.equal(studentEmailLocal('ANIRUDH REDDY.S'), 'anirudh.s');
  assert.equal(studentEmailLocal('José Núñez'), 'jose.n');
  assert.equal(studentEmailLocal('Aarav'), 'aarav');
  assert.equal(studentEmailLocal('  '), 'student');
});

test('clashes are numbered', () => {
  const taken = new Set<string>();
  assert.equal(uniqueStudentEmail('AKHIL G', 'sthsc.edu', taken), 'akhil.g@sthsc.edu');
  assert.equal(uniqueStudentEmail('AKHIL GUPTA', 'sthsc.edu', taken), 'akhil.gupta@sthsc.edu');
  assert.equal(uniqueStudentEmail('AKHIL GUPTA', 'sthsc.edu', taken), 'akhil.g2@sthsc.edu');
});

test('common surnames get longer forms before numbers', () => {
  const taken = new Set<string>();
  const got = ['RAVI KUMAR', 'RAVI KISHORE', 'RAVI KUMAR REDDY', 'RAVI KUMAR REDDY', 'RAVI KUMAR REDDY'].map((n) =>
    uniqueStudentEmail(n, 'x.edu', taken),
  );
  assert.deepEqual(got, ['ravi.k@x.edu', 'ravi.kishore@x.edu', 'ravi.r@x.edu', 'ravi.reddy@x.edu', 'ravi.kumar.reddy@x.edu']);
});
