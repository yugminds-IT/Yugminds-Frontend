/**
 * Frontend-side mirror of Yugminds Backend/test/admin/support/fixtures.ts —
 * creates/tears down a disposable `__qa_test_<runid>__` school directly
 * against the live backend via plain HTTP (no supertest, this isn't a Nest
 * test process). Kept structurally identical to the backend version so the
 * two suites exercise the same admin endpoints the same way.
 */

export const BACKEND_URL = process.env.BACKEND_URL_FOR_E2E || 'http://localhost:3001';

export interface QaUser {
  id: number;
  email: string;
  password: string;
}

export interface QaFixture {
  admin: { token: string };
  schoolId: string;
  schoolAdmin: QaUser;
  teachers: QaUser[];
  students: QaUser[];
  courseId: string;
  grade: string;
  section: string;
  runId: string;
}

async function json(res: Response, label: string) {
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body as Record<string, unknown>;
}

function pickId(body: Record<string, unknown>): string {
  const data = body?.data as Record<string, unknown> | undefined;
  const nestedId =
    (data?.school as { id?: string })?.id ?? (data as { id?: string })?.id;
  const id = nestedId ?? (body as { id?: string }).id;
  if (!id) throw new Error(`Could not read id from response: ${JSON.stringify(body)}`);
  return String(id);
}

export async function createQaFixture(): Promise<QaFixture> {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set in env for global-setup');
  }

  const loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const loginBody = await json(loginRes, 'admin login');
  const adminToken = (loginBody.tokens as { accessToken?: string })?.accessToken;
  if (!adminToken) throw new Error(`No access token in admin login response: ${JSON.stringify(loginBody)}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const QA_PREFIX = `__qa_test_${runId}__`;
  const grade = 'Grade 1';
  const section = 'Section A';
  // NOTE: teachers.service.ts#checkDuplicateSectionAssignments hard-rejects two
  // teachers sharing a section in the same school (regardless of subject) — the
  // backend's own test/admin/support/fixtures.ts assigns both QA teachers to the
  // same single section, which this endpoint would now reject. Provisioning a
  // second section here and giving each teacher its own section works around
  // that mismatch without touching backend logic. Flagged as a found bug in the
  // final report; students/course still use `section` (Section A) throughout.
  const secondSection = 'Section B';
  const schoolAdminEmail = `${QA_PREFIX}_school_admin@example.test`;
  const schoolAdminPassword = 'QaTest123!';

  const schoolRes = await fetch(`${BACKEND_URL}/admin/schools`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `${QA_PREFIX} School`,
      grades_offered: [grade],
      number_of_sections: 2,
      school_admin_email: schoolAdminEmail,
      school_admin_temp_password: schoolAdminPassword,
      school_admin_name: 'QA School Admin',
    }),
  });
  const schoolBody = await json(schoolRes, 'create school');
  const schoolId = pickId(schoolBody);

  const teacherSections = [section, secondSection];
  const teachers: QaUser[] = [];
  for (let i = 0; i < 2; i++) {
    const email = `${QA_PREFIX}_teacher${i}@example.test`;
    const password = 'QaTest123!';
    const res = await fetch(`${BACKEND_URL}/admin/teachers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email,
        password,
        full_name: `QA Teacher ${i}`,
        school_assignments: [
          {
            school_id: schoolId,
            grade_sections_assigned: [{ grade, sections: [teacherSections[i]] }],
            subjects: ['General'],
          },
        ],
      }),
    });
    const body = await json(res, `create teacher ${i}`);
    const id = Number(pickId(body));
    teachers.push({ id, email, password });
  }

  const students: QaUser[] = [];
  for (let i = 0; i < 3; i++) {
    const email = `${QA_PREFIX}_student${i}@example.test`;
    const password = 'QaTest123!';
    const res = await fetch(`${BACKEND_URL}/admin/students`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email,
        password,
        full_name: `QA Student ${i}`,
        school_id: schoolId,
        grade,
        section,
      }),
    });
    const body = await json(res, `create student ${i}`);
    const id = Number(pickId(body));
    students.push({ id, email, password });
  }

  const courseRes = await fetch(`${BACKEND_URL}/admin/courses`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `${QA_PREFIX} Course`,
      description: 'QA fixture course',
      school_ids: [schoolId],
      grades: [grade],
    }),
  });
  const courseBody = await json(courseRes, 'create course');
  const courseId = pickId(courseBody);

  return {
    admin: { token: adminToken },
    schoolId,
    schoolAdmin: { id: 0, email: schoolAdminEmail, password: schoolAdminPassword },
    teachers,
    students,
    courseId,
    grade,
    section,
    runId,
  };
}

export async function teardownQaFixture(fixture: QaFixture): Promise<void> {
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${fixture.admin.token}`,
  };

  const safeDelete = async (url: string) => {
    try {
      await fetch(url, { method: 'DELETE', headers: authHeaders });
    } catch {
      /* ignore — mirrors backend teardownQaFixture's .catch(() => undefined) */
    }
  };

  // Course: soft-delete then purge (trash purge requires deletedAt set first).
  await safeDelete(`${BACKEND_URL}/admin/courses/${fixture.courseId}`);
  await safeDelete(`${BACKEND_URL}/admin/trash?entity_type=courses&id=${fixture.courseId}`);

  // School purge cascades to its users (school-admin/teachers/students).
  await safeDelete(`${BACKEND_URL}/admin/schools/${fixture.schoolId}`);
  await safeDelete(`${BACKEND_URL}/admin/trash?entity_type=schools&id=${fixture.schoolId}`);
}
