"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, RefreshCw } from "lucide-react";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import CodeRun from "@/components/admin/joining-codes/CodeRun";
import CodesPanel from "@/components/admin/joining-codes/CodesPanel";
import { useCodes } from "@/components/admin/joining-codes/useCodes";
import { STATE_LABEL, plural, stateOf, type CodeState } from "@/components/admin/joining-codes/utils";
import { mapApiSchoolToSchool, placeOf } from "@/components/admin/schools/utils";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/joining-codes/codes.css";

const GUIDE: [string, string][] = [
  ["One student", "A single-use code works for one student, then stops. Good for a student you want to enroll yourself."],
  ["Many students", "One code works for everyone in a grade or section. Hand it out in class, with an optional limit."],
  ["Switched on or off", "Only a switched-on code lets someone join. Switch one off to stop it without deleting it."],
  ["Expiry", "A code stops working a year after it was made. Make a new one when it runs out."],
];

function JoiningCodesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { schools: raw, isLoading: schoolsLoading, error: schoolsError, refetch: refetchSchools } = useAdminSchools();
  const [schoolId, setSchoolId] = useState(() => params.get("school") ?? "");
  const [filter, setFilter] = useState<CodeState | null>(null);
  const [now] = useState(() => Date.now());

  const schools = useMemo(() => (raw ?? []).map((s) => mapApiSchoolToSchool(s as Record<string, unknown>)).filter((s) => s.id).sort((a, b) => a.name.localeCompare(b.name)), [raw]);
  const school = schools.find((s) => s.id === schoolId);
  const { codes, loading, error, refetch, changed } = useCodes(schoolId);

  const counts: Record<CodeState, number> = { active: 0, full: 0, expired: 0, off: 0 };
  codes.forEach((c) => { counts[stateOf(c, now)] += 1; });
  const gradesCovered = new Set(codes.filter((c) => stateOf(c, now) === "active").map((c) => c.grade)).size;
  const gradesOffered = school?.grades_offered?.length ?? 0;
  const pick = (id: string) => { setSchoolId(id); setFilter(null); };
  // Back to the list of schools. Also drops ?school= from the address so a reload does not reopen it.
  const backToSchools = () => { pick(""); if (params.get("school")) router.replace("/lms/admin/joining-codes"); };

  let status: React.ReactNode;
  if (schoolsLoading) status = "Loading schools…";
  else if (schools.length === 0 && schoolsError) status = "The schools did not load. Try again.";
  else if (schools.length === 0) status = "No schools yet. Add a school, then make its joining codes.";
  else if (!school) status = <>Pick a school to see and manage its codes. <strong>{plural(schools.filter((s) => (s.join_code_count ?? 0) === 0).length, "school")}</strong> still {schools.filter((s) => (s.join_code_count ?? 0) === 0).length === 1 ? "has" : "have"} none.</>;
  else if (loading) status = `Loading the codes for ${school.name}…`;
  else if (codes.length === 0) status = <><strong>{school.name} has no codes yet.</strong> Make one per grade or section so people can join.</>;
  else status = <><strong>{plural(counts.active, "code")}</strong> {counts.active === 1 ? "is" : "are"} working at {school.name}{gradesOffered > 0 ? `, covering ${gradesCovered} of ${plural(gradesOffered, "grade")}` : ""}.</>;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="jc-title">
        <div className="sd-hero-copy">
          <h1 id="jc-title" className="mc-hero-title">Joining codes</h1>
          <p className="sd-where">How people get into the right class</p>
          <p className="sd-status">{status}</p>
          {school && (
            <div className="sd-hero-actions">
              <button className="sd-btn sd-btn--ghost-dark" onClick={backToSchools}><ArrowLeft aria-hidden="true" />Back to all schools</button>
              <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void refetch()} aria-label="Refresh" title="Refresh"><RefreshCw aria-hidden="true" /></button>
            </div>
          )}
        </div>
        {school ? (
          <CodeRun counts={counts} selected={filter} onSelect={setFilter} caption={school.name} />
        ) : (
          <div className="sd-run-card"><p style={{ color: "var(--sd-paper)", padding: "1rem 0.25rem" }}>Choose a school and its codes appear here, grouped by whether they still work.</p></div>
        )}
      </section>

      <div className="jc-bar">
        <select className="sd-field" aria-label="School" value={schoolId} onChange={(e) => pick(e.target.value)} disabled={schoolsLoading}>
          <option value="">{schoolsLoading ? "Loading schools…" : "Choose a school"}</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {school ? (
        <CodesPanel
          schoolId={school.id}
          schoolName={school.name}
          codes={codes}
          loading={loading}
          error={error}
          onRetry={() => void refetch()}
          onChanged={changed}
          filter={filter}
          onFilter={setFilter}
          showChips={false}
          now={now}
        />
      ) : schools.length > 0 ? (
        <section className="sd-panel jc-schools mc-swap" aria-label="Schools">
          {schools.map((s) => (
            <div key={s.id} className="jc-school">
              <span><b>{s.name}</b><small>{[placeOf(s), s.grades_offered?.length ? plural(s.grades_offered.length, "grade") : ""].filter(Boolean).join(" · ") || "No location yet"}</small></span>
              <span className="jc-chip" data-s={(s.join_code_count ?? 0) > 0 ? "active" : "off"}>{(s.join_code_count ?? 0) > 0 ? plural(s.join_code_count ?? 0, "code") : "No codes"}</span>
              <button className="sd-btn sd-btn--line" onClick={() => pick(s.id)}><KeyRound aria-hidden="true" />{(s.join_code_count ?? 0) > 0 ? "Manage codes" : "Make codes"}</button>
            </div>
          ))}
        </section>
      ) : schoolsError && !schoolsLoading ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the schools</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void refetchSchools()}>Try again</button>
          </div>
        </section>
      ) : null}

      <section className="sd-panel" aria-labelledby="jc-guide-h">
        <div className="sd-panel-head"><div><h2 id="jc-guide-h">How codes work</h2><p>States a code can be in: {Object.values(STATE_LABEL).join(", ").toLowerCase()}.</p></div></div>
        <ul className="jc-guide">{GUIDE.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>
      </section>
    </div>
  );
}

export default function JoiningCodesPage() {
  return <Suspense fallback={<div className="sd-page"><div className="sd-skel" style={{ height: "18rem", borderRadius: "1.75rem" }} /></div>}><JoiningCodesInner /></Suspense>;
}
