"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Pencil, RefreshCw } from "lucide-react";
import AddSchoolDialog from "@/components/AddSchoolDialog";
import JoiningCodesDialog from "@/components/JoiningCodesDialog";
import { initialsOf } from "@/components/portal/notifications";
import SetupRun, { type SetupStep } from "@/components/admin/schools/SetupRun";
import { STAGE_LABEL, mapApiSchoolToSchool, placeOf, stageOf } from "@/components/admin/schools/utils";
import { adminApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";
import { useInvalidateAdminSchools } from "@/hooks/useAdminSchools";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/admin/schools/schools.css";

async function ensureAccessToken(): Promise<void> {
  const { data } = await getSession();
  const token = data.session?.access_token ?? null;
  if (token) setAuthToken(token);
}

interface TeacherRow {
  id?: string;
  name?: string;
  full_name?: string;
  fullName?: string;
  email?: string;
}

interface StudentRow {
  id?: string;
  grade?: string;
}

interface LeaveRow {
  id: string;
  status: string;
  reason?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  profiles?: { full_name?: string };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function useSchoolDetail(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<Record<string, unknown>> => {
      await ensureAccessToken();
      const { data } = await adminApi.schools.get(schoolId);
      return data as Record<string, unknown>;
    },
  });
}

function useSchoolTeachers(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "teachers"],
    enabled: !!schoolId,
    queryFn: async (): Promise<TeacherRow[]> => {
      await ensureAccessToken();
      const { data } = await adminApi.teachers.list({ school_id: schoolId });
      const raw = (data as Record<string, unknown>).teachers ?? (data as Record<string, unknown>).data ?? data ?? [];
      return (Array.isArray(raw) ? raw : []) as TeacherRow[];
    },
  });
}

function useSchoolStudents(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "students"],
    enabled: !!schoolId,
    queryFn: async (): Promise<StudentRow[]> => {
      await ensureAccessToken();
      const { data } = await adminApi.students.list({ school_id: schoolId, limit: 1000 });
      const raw = (data as Record<string, unknown>).students ?? (data as Record<string, unknown>).data ?? data ?? [];
      return (Array.isArray(raw) ? raw : []) as StudentRow[];
    },
  });
}

function useSchoolLeaves(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "leaves"],
    enabled: !!schoolId,
    queryFn: async (): Promise<LeaveRow[]> => {
      await ensureAccessToken();
      const { data } = await adminApi.leaves.list({ school_id: schoolId });
      const raw = (data as { leaves?: LeaveRow[] })?.leaves ?? (Array.isArray(data) ? (data as LeaveRow[]) : []);
      return raw.filter((l) => l.status === "Pending");
    },
  });
}

function useSchoolLicenses(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "licenses"],
    enabled: !!schoolId,
    queryFn: async (): Promise<Array<{ isActive?: boolean; is_active?: boolean }>> => {
      await ensureAccessToken();
      try {
        const { data } = await adminApi.licenses.list({ schoolId });
        return ((data as { licenses?: Array<{ isActive?: boolean; is_active?: boolean }> })?.licenses ?? []);
      } catch {
        return [];
      }
    },
  });
}

export default function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = use(params);
  const router = useRouter();
  const invalidateSchools = useInvalidateAdminSchools();
  const [editing, setEditing] = useState(false);
  const [codesOpen, setCodesOpen] = useState(false);

  const { data: raw, isLoading: schoolLoading, error, refetch } = useSchoolDetail(schoolId);
  const { data: teachers = [], isLoading: teachersLoading } = useSchoolTeachers(schoolId);
  const { data: students = [], isLoading: studentsLoading } = useSchoolStudents(schoolId);
  const { data: pendingLeaves = [] } = useSchoolLeaves(schoolId);
  const { data: licenses = [] } = useSchoolLicenses(schoolId);

  const school = useMemo(() => (raw ? mapApiSchoolToSchool(raw) : null), [raw]);
  const activeLicenses = licenses.filter((l) => l.isActive ?? l.is_active).length;

  const grades = useMemo(() => {
    const by = students.reduce<Record<string, number>>((acc, s) => {
      const key = s.grade || "No grade";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(by).sort((a, b) => b[1] - a[1]);
  }, [students]);
  const topGrade = grades[0]?.[1] ?? 1;

  if (schoolLoading) {
    return (
      <div className="sd-page">
        <div className="sd-skel" style={{ height: "22rem", borderRadius: "1.75rem" }} />
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="sd-page">
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load this school</b>
            <p>It may have been deleted, or the connection dropped.</p>
            <div className="sc-links" style={{ marginTop: 0 }}>
              <button className="sd-btn sd-btn--amber" onClick={() => void refetch()}><RefreshCw aria-hidden="true" />Try again</button>
              <button className="sd-btn sd-btn--line" onClick={() => router.push("/lms/admin/schools")}>Back to schools</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const stage = stageOf(school);
  const hasAdminNow = !!(school.school_admin_name || school.school_admin_email || school.school_admin_id);
  const codeCount = school.join_code_count ?? 0;
  const steps: SetupStep[] = [
    { id: "admin", label: "School admin", done: hasAdminNow, detail: hasAdminNow ? "A school admin is assigned" : "No school admin yet" },
    { id: "codes", label: "Joining codes", done: codeCount > 0, detail: codeCount > 0 ? `${plural(codeCount, "code")} created` : "No joining codes yet" },
    { id: "teachers", label: "Teachers", done: teachers.length > 0, detail: teachers.length > 0 ? `${plural(teachers.length, "teacher")} joined` : "No teachers yet" },
    { id: "students", label: "Students", done: students.length > 0, detail: students.length > 0 ? `${plural(students.length, "student")} joined` : "No students yet" },
  ];
  const next = steps.find((s) => !s.done);
  const stepsReady = !teachersLoading && !studentsLoading;

  let status: React.ReactNode;
  if (!school.is_active) status = <><strong>This school is inactive.</strong> People here cannot sign in until you make it active again.</>;
  else if (!stepsReady) status = "Checking this school…";
  else if (!next) status = <><strong>{school.name} is up and running.</strong> {plural(teachers.length, "teacher")} and {plural(students.length, "student")} have joined.</>;
  else if (next.id === "admin") status = <><strong>Next: assign a school admin.</strong> They run the school day to day.</>;
  else if (next.id === "codes") status = <><strong>Next: create joining codes.</strong> Teachers and students sign up with them.</>;
  else if (next.id === "teachers") status = <><strong>Waiting for teachers.</strong> Share a joining code with them.</>;
  else status = <><strong>Waiting for students.</strong> Share a joining code with them.</>;

  const place = placeOf(school);
  const facts: [string, string | undefined][] = [
    ["Principal", school.principal_name],
    ["Email", school.contact_email || school.school_email],
    ["Phone", school.contact_phone],
    ["Location", place],
    ["Address", school.address],
    ["School type", school.school_type],
    ["Affiliation", school.affiliation_type],
    ["Established", school.established_year ? String(school.established_year) : undefined],
    ["Grades offered", school.grades_offered?.length ? school.grades_offered.join(", ") : undefined],
  ];
  const shown = facts.filter(([, v]) => v && v.trim());

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="sd-school-title">
        <div className="sd-hero-copy">
          <Link href="/lms/admin/schools" className="sd-btn sd-btn--ghost-dark" style={{ justifySelf: "start", minHeight: "2.25rem", padding: "0.3rem 1rem" }}>
            <ArrowLeft aria-hidden="true" />All schools
          </Link>
          <h1 id="sd-school-title" className="mc-hero-title">{school.name}</h1>
          <p className="sd-where">{[school.school_code && `Code ${school.school_code}`, place, STAGE_LABEL[stage]].filter(Boolean).join(" · ")}</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => setCodesOpen(true)}><KeyRound aria-hidden="true" />Joining codes</button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Edit details</button>
            {!hasAdminNow && <Link href="/lms/admin/school-admins" className="sd-btn sd-btn--ghost-dark">Assign a school admin</Link>}
          </div>
        </div>
        {stepsReady ? (
          <SetupRun steps={steps} caption={next ? `Next: ${next.label.toLowerCase()}` : "Every step is done"} />
        ) : (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="This school in numbers">
        <Link href="/lms/admin/teachers"><span className="sd-l">Teachers</span>{teachersLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "3.5rem" }} /> : <b className="sd-n">{teachers.length}</b>}<small>Open the teachers list</small></Link>
        <Link href="/lms/admin/students"><span className="sd-l">Students</span>{studentsLoading ? <span className="sd-skel" style={{ height: "2.2rem", width: "3.5rem" }} /> : <b className="sd-n">{students.length}</b>}<small>Open the students list</small></Link>
        <Link href="/lms/admin/teachers?tab=leaves" data-hot={pendingLeaves.length > 0}><span className="sd-l">Pending leaves</span><b className="sd-n">{pendingLeaves.length}</b><small>{pendingLeaves.length > 0 ? "Waiting for review" : "Nothing waiting"}</small></Link>
        <Link href="/lms/admin/licenses"><span className="sd-l">Active licenses</span><b className="sd-n">{activeLicenses}</b><small>RoboCoders desktop keys</small></Link>
      </div>

      <div className="sc-two">
        <div className="sc-col">
          <section className="sd-panel" aria-labelledby="sc-about">
            <div className="sd-panel-head"><div><h2 id="sc-about">About this school</h2><p>Contact details and who looks after it.</p></div></div>
            <div className="sc-person" style={{ paddingTop: 0 }}>
              <span className="sd-avatar" aria-hidden="true">{initialsOf(school.school_admin_name || school.school_admin_email || "?")}</span>
              <span>
                <b>{school.school_admin_name || school.school_admin_email || "No school admin yet"}</b>
                <small>{hasAdminNow ? `School admin${school.school_admin_name && school.school_admin_email ? ` · ${school.school_admin_email}` : ""}` : "Assign one so someone can run this school."}</small>
              </span>
            </div>
            {shown.length > 0 ? (
              <dl className="sc-facts" style={{ marginTop: "1rem" }}>
                {shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            ) : (
              <p style={{ marginTop: "1rem", color: "var(--sd-ink-soft)" }}>No contact details yet. Use Edit details to add them.</p>
            )}
          </section>

          <section className="sd-panel" aria-labelledby="sc-teachers">
            <div className="sd-panel-head"><div><h2 id="sc-teachers">Teachers</h2><p>{plural(teachers.length, "teacher")} at this school.</p></div></div>
            {teachersLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : teachers.length === 0 ? (
              <div className="sd-empty"><b>No teachers yet</b><p>Share a joining code with the teachers. They join this school when they sign up.</p><button className="sd-btn sd-btn--line" onClick={() => setCodesOpen(true)}>Open joining codes</button></div>
            ) : (
              <div className="sc-scroll">
                {teachers.map((t, i) => {
                  const name = t.name ?? t.full_name ?? t.fullName ?? "Unnamed";
                  return (
                    <div key={t.id ?? i} className="sc-person">
                      <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>
                      <span><b>{name}</b>{t.email && <small>{t.email}</small>}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {teachers.length > 0 && <div className="sc-links"><Link href="/lms/admin/teachers" className="sd-btn sd-btn--line">Open teachers</Link></div>}
          </section>
        </div>

        <div className="sc-col">
          <section className="sd-panel" aria-labelledby="sc-grades">
            <div className="sd-panel-head"><div><h2 id="sc-grades">Students by grade</h2><p>{plural(students.length, "student")} enrolled.</p></div></div>
            {studentsLoading ? (
              <><div className="sd-skel" /><div className="sd-skel" /></>
            ) : grades.length === 0 ? (
              <div className="sd-empty"><b>No students yet</b><p>Students join with a joining code for their grade and section.</p></div>
            ) : (
              <div role="list">
                {grades.map(([grade, n]) => (
                  <div key={grade} role="listitem" className="sc-grade">
                    <span>{grade}</span>
                    <span className="sd-meter" role="img" aria-label={`${plural(n, "student")} in ${grade}`}><i style={{ "--p": `${Math.max(4, (n / topGrade) * 100)}%` } as React.CSSProperties} /></span>
                    <b>{n}</b>
                  </div>
                ))}
              </div>
            )}
            {students.length > 0 && <div className="sc-links"><Link href="/lms/admin/students" className="sd-btn sd-btn--line">Open students</Link></div>}
          </section>

          <section className="sd-panel" aria-labelledby="sc-leaves">
            <div className="sd-panel-head"><div><h2 id="sc-leaves">Leave requests</h2><p>Waiting for review by this school&apos;s admin.</p></div></div>
            {pendingLeaves.length === 0 ? (
              <div className="sd-empty"><b>Nothing waiting</b><p>There are no pending leave requests for this school.</p></div>
            ) : (
              <div className="sc-scroll">
                {pendingLeaves.map((l) => (
                  <div key={l.id} className="so-row">
                    <span className="so-row-text">
                      <b>{l.profiles?.full_name ?? "Teacher"}</b>
                      <small>{day(l.start_date)} to {day(l.end_date)} ({plural(l.total_days, "day")}){l.reason ? `. ${l.reason}` : ""}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <AddSchoolDialog
        isOpen={editing}
        editingSchoolId={editing ? schoolId : null}
        onClose={() => setEditing(false)}
        onSuccess={() => { void invalidateSchools(); }}
      />
      <JoiningCodesDialog isOpen={codesOpen} onClose={() => { setCodesOpen(false); void invalidateSchools(); }} schoolId={schoolId} schoolName={school.name} />
    </div>
  );
}
