"use client";

import LastSignIn from "@/components/portal/LastSignIn";
import { useState, useEffect, useCallback, useMemo } from "react";
import { CalendarOff, Check, Download, X } from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { toast } from "@/components/ui/toast";
import ConfirmModal from "@/components/portal/ConfirmModal";
import { ChipGroup, Pager, initialsOf } from "@/components/portal/notifications";
import AttendanceRun from "@/components/school-admin/AttendanceRun";
import EmergencyLeaveModal from "@/components/school-admin/EmergencyLeaveModal";
import LeaveStages from "@/components/school-admin/LeaveStages";
import TeacherDetailModal from "@/components/school-admin/TeacherDetailModal";
import { csvCell, downloadText } from "@/components/school-admin/student-utils";
import {
  attendanceBand,
  BAND_LABEL,
  classGroups,
  classLabel,
  normalizeTeacher,
  shortDate,
  teacherSubjects,
  type AttendanceBand,
  type LeaveRequest,
  type Teacher,
} from "@/components/school-admin/teacher-utils";
import "@/components/school-admin/students.css";
import "@/components/school-admin/teachers.css";

const PAGE_SIZE = 25;
const MAX_CHIPS = 3;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
type Tab = "teachers" | "leaves";
type StatusFilter = "all" | "active" | "on leave" | "inactive";
type LeaveFilter = "all" | "Pending" | "Approved" | "Rejected";

const serverMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
const personOf = (p?: { full_name?: string; role?: string }) => (p?.full_name ? `${p.full_name}${p.role ? ` (${p.role.replace(/_/g, " ")})` : ""}` : "");

export default function TeachersManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [band, setBand] = useState<AttendanceBand | "all">("all");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("teachers");
  const [viewing, setViewing] = useState<Teacher | null>(null);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [leaveFilter, setLeaveFilter] = useState<LeaveFilter>("all");
  const [pendingCount, setPendingCount] = useState(0);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [busyLeave, setBusyLeave] = useState(false);

  const [emOpen, setEmOpen] = useState(false);
  const [emKey, setEmKey] = useState(0);
  const [emTeacher, setEmTeacher] = useState("");
  const [emSaving, setEmSaving] = useState(false);

  // ?tab=leaves is linked from the dashboard; read it on mount (window is not there during SSR)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "leaves") {
      setTab("leaves");
    }
  }, []);
  const switchTab = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "leaves" ? "?tab=leaves" : window.location.pathname);
  };

  /* ───────── data ───────── */
  const loadTeachers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [schoolRes, listRes] = await Promise.all([
        schoolAdminApi.school.get(),
        // the backend defaults to 50; this page filters the whole roster itself
        schoolAdminApi.teachers.list({ limit: 500 }),
      ]);
      const school = ((schoolRes.data ?? {}) as { school?: { id?: string } }).school;
      if (!school?.id) {
        setError("No school is assigned to your account. Contact support.");
        setTeachers([]);
        return;
      }
      const result = (listRes.data ?? {}) as { teachers?: Record<string, unknown>[] };
      const rows = result.teachers ?? (Array.isArray(listRes.data) ? (listRes.data as Record<string, unknown>[]) : []);
      setTeachers(rows.map(normalizeTeacher).filter((t) => Boolean(t.id) || Boolean(t.email)));
    } catch (e) {
      console.error("Error loading teachers:", e);
      setError(e instanceof Error ? e.message : "The teachers did not load.");
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaves = useCallback(async () => {
    setLeavesLoading(true);
    const [list, pending] = await Promise.allSettled([
      schoolAdminApi.leaves.list(leaveFilter === "all" ? {} : { status: leaveFilter }),
      schoolAdminApi.leaves.list({ status: "Pending" }),
    ]);
    const pick = (r: PromiseSettledResult<{ data?: unknown }>) => {
      if (r.status !== "fulfilled") return null;
      const d = (r.value.data ?? {}) as { leaves?: LeaveRequest[] };
      return d.leaves ?? ((Array.isArray(r.value.data) ? r.value.data : []) as LeaveRequest[]);
    };
    const all = pick(list);
    const pend = pick(pending);
    // pending requests first, so what needs a decision is at the top
    setLeaves(all ? [...all].sort((a, b) => Number(b.status === "Pending") - Number(a.status === "Pending")) : []);
    setPendingCount(pend ? pend.length : 0);
    setLeavesLoading(false);
  }, [leaveFilter]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);
  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  /* ───────── filtering and counts ───────── */
  const statusOf = (t: Teacher) => (t.status || "Active").toLowerCase();
  const counts = useMemo(
    () => ({
      all: teachers.length,
      active: teachers.filter((t) => statusOf(t) === "active").length,
      "on leave": teachers.filter((t) => statusOf(t) === "on leave").length,
      inactive: teachers.filter((t) => statusOf(t) === "inactive").length,
    }),
    [teachers],
  );
  const bandCounts = useMemo(() => {
    const c: Record<AttendanceBand, number> = { low: 0, watch: 0, good: 0, none: 0 };
    teachers.forEach((t) => { c[attendanceBand(t)] += 1; });
    return c;
  }, [teachers]);
  const average = useMemo(() => {
    const withData = teachers.filter((t) => attendanceBand(t) !== "none");
    return withData.length ? Math.round(withData.reduce((n, t) => n + (t.attendance_percentage ?? 0), 0) / withData.length) : null;
  }, [teachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (statusFilter !== "all" && statusOf(t) !== statusFilter) return false;
      if (band !== "all" && attendanceBand(t) !== band) return false;
      if (!q) return true;
      const hay = [t.full_name, t.email, t.qualification, t.specialization, ...teacherSubjects(t), ...classGroups(t).map(classLabel)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [teachers, search, statusFilter, band]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, band]);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = !!search.trim() || statusFilter !== "all" || band !== "all";
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setBand("all"); };

  /* ───────── actions ───────── */
  const handleExport = () => {
    if (filtered.length === 0) {
      toast.warning("There are no teachers to export.");
      return;
    }
    const headers = ["Name", "Email", "Phone", "Qualification", "Specialization", "Classes", "Subjects", "Leave taken (days)", "Attendance (30 days)", "Status"];
    const rows = filtered.map((t) => [
      t.full_name || "",
      t.email || "",
      t.phone || "",
      t.qualification || "",
      t.specialization || "",
      classGroups(t).map(classLabel).join("; "),
      teacherSubjects(t).join("; "),
      t.leaves_taken || 0,
      attendanceBand(t) === "none" ? "" : `${t.attendance_percentage}%`,
      t.status || "Active",
    ]);
    downloadText(`teachers_export_${new Date().toISOString().split("T")[0]}.csv`, [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n"));
    toast.success(`Exported ${plural(filtered.length, "teacher")} to CSV.`);
  };

  const openEmergency = (teacherId = "") => {
    setViewing(null);
    setEmTeacher(teacherId);
    setEmKey((k) => k + 1);
    setEmOpen(true);
  };

  const submitEmergency = async (v: { teacher_id: string; start_date: string; end_date: string; reason: string }) => {
    setEmSaving(true);
    try {
      await schoolAdminApi.leaves.createEmergency(v);
      toast.success("Emergency leave recorded and approved by you. It needs the main admin's approval before attendance changes.");
      setEmOpen(false);
      await Promise.all([loadLeaves(), loadTeachers()]);
    } catch (e) {
      toast.error(serverMessage(e) || "Could not record the emergency leave. Check the dates and try again.");
    } finally {
      setEmSaving(false);
    }
  };

  const decide = async (leave: LeaveRequest, action: "approve" | "reject") => {
    setBusyLeave(true);
    try {
      await schoolAdminApi.leaves.update(leave.id, { action });
      setPendingCount((n) => Math.max(0, n - 1));
      await Promise.all([loadLeaves(), loadTeachers()]);
      if (action === "reject") toast.success("Leave request rejected.");
      else if (leave.is_emergency) {
        toast.success(
          leave.admin_status === "approved"
            ? "Emergency leave approved. Both approvals are done and attendance is updated."
            : "Emergency leave approved by you. It needs the main admin's approval before attendance changes.",
        );
      } else toast.success("Leave request approved. Attendance is updated.");
      setRejecting(null);
    } catch (e) {
      toast.error(serverMessage(e) || `Could not ${action} the leave request. Try again.`);
    } finally {
      setBusyLeave(false);
    }
  };

  /* ───────── copy ───────── */
  let status: React.ReactNode;
  if (error) status = "The teachers did not load. Try again.";
  else if (loading) status = "Loading teachers…";
  else if (tab === "leaves") {
    status = pendingCount > 0
      ? <><strong>{plural(pendingCount, "leave request")}</strong> {pendingCount === 1 ? "is" : "are"} waiting for you.</>
      : "No leave requests are waiting for you.";
  } else if (hasFilters) {
    status = <><strong>{filtered.length} of {plural(teachers.length, "teacher")}</strong> match your filters.</>;
  } else {
    status = <><strong>{plural(teachers.length, "teacher")}</strong> in your school{counts["on leave"] > 0 ? `, ${counts["on leave"]} on leave` : ""}.</>;
  }

  const statusButtons: { id: StatusFilter; label: string; hint: string }[] = [
    { id: "all", label: "All teachers", hint: "Everyone assigned to your school" },
    { id: "active", label: "Active", hint: "Teaching now" },
    { id: "on leave", label: "On leave", hint: "Away right now" },
    { id: "inactive", label: "Inactive", hint: "Not teaching" },
  ];
  const leaveDates = (l: LeaveRequest) => `${shortDate(l.start_date)}${l.end_date && l.end_date !== l.start_date ? ` to ${shortDate(l.end_date)}` : ""}`;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="tm-title">
        <div className="sd-hero-copy">
          <h1 id="tm-title" className="mc-hero-title">Teachers</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {pendingCount > 0 && tab === "teachers" ? (
              <button className="sd-btn sd-btn--amber" onClick={() => switchTab("leaves")}><CalendarOff aria-hidden="true" />Review {plural(pendingCount, "leave request")}</button>
            ) : (
              <button className="sd-btn sd-btn--amber" onClick={() => openEmergency()}><CalendarOff aria-hidden="true" />Record emergency leave</button>
            )}
            {pendingCount > 0 && tab === "teachers" && (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => openEmergency()}>Record emergency leave</button>
            )}
            <button className="sd-btn sd-btn--ghost-dark" onClick={handleExport}><Download aria-hidden="true" />Export</button>
          </div>
        </div>
        <AttendanceRun
          counts={bandCounts}
          selected={band}
          average={average}
          onSelect={(b) => { setBand(b); if (b !== "all") switchTab("teachers"); }}
        />
      </section>

      <div className="mc-tabs" role="tablist" aria-label="Teachers and leave" style={{ justifySelf: "start" }}>
        <button role="tab" className="mc-tab" aria-selected={tab === "teachers"} onClick={() => switchTab("teachers")}>Teachers<b>{teachers.length}</b></button>
        <button role="tab" className="mc-tab" aria-selected={tab === "leaves"} onClick={() => switchTab("leaves")}>Leave requests{pendingCount > 0 && <b>{pendingCount}</b>}</button>
      </div>

      {tab === "teachers" ? (
        <>
          <div className="sd-ledger" role="group" aria-label="Show teachers by status">
            {statusButtons.map((b) => (
              <button key={b.id} type="button" aria-pressed={statusFilter === b.id} onClick={() => setStatusFilter(b.id)}>
                <span className="sd-l">{b.label}</span>
                {loading ? <span className="sd-skel" style={{ height: "2.2rem", width: "3.5rem" }} /> : <b className="sd-n">{counts[b.id]}</b>}
                <small>{b.hint}</small>
              </button>
            ))}
          </div>

          <div className="nt-bar">
            <input
              type="search"
              className="sd-field"
              placeholder="Search by name, email, subject or class"
              aria-label="Search teachers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {band !== "all" && <span className="sm-chip" data-class="true">Attendance: {BAND_LABEL[band]}</span>}
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
          </div>

          {loading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : error ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>We could not load your teachers</b>
                <p>{error}</p>
                <button className="sd-btn sd-btn--amber" onClick={() => void loadTeachers()}>Try again</button>
              </div>
            </section>
          ) : filtered.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{teachers.length === 0 ? "No teachers yet" : "No teachers match"}</b>
                <p>{teachers.length === 0 ? "The main admin adds teachers and assigns them to your school. They will show up here once that is done." : "Try a different search, or clear the filters."}</p>
                {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
              </div>
            </section>
          ) : (
            <section className="sd-panel as-list mc-swap" aria-label="Teachers">
              <div className="tm-head">
                <span />
                <span>Teacher</span>
                <span>Qualification</span>
                <span>Classes</span>
                <span>Attendance</span>
                <span>Status</span>
                <span>Last sign-in</span>
              </div>
              {shown.map((t) => {
                const groups = classGroups(t);
                const subjects = teacherSubjects(t);
                const b = attendanceBand(t);
                const leaveDays = t.leaves_taken ?? 0;
                return (
                  <article key={t.id ?? t.teacher_id} className="tm-row">
                    <span className="sd-avatar" aria-hidden="true">{initialsOf(t.full_name || t.email)}</span>
                    <button className="sm-who" onClick={() => setViewing(t)}>
                      <b>{t.full_name || "Unnamed teacher"}</b>
                      <small>{t.email || "No email"}</small>
                    </button>
                    <div className="tm-qual">
                      {t.qualification || t.specialization ? (
                        <>
                          <span>{t.qualification || t.specialization}</span>
                          {t.qualification && t.specialization && <small>{t.specialization}</small>}
                        </>
                      ) : <span className="sm-muted">Not provided</span>}
                    </div>
                    <div className="tm-classes">
                      {groups.length > 0 ? (
                        <div className="tm-chips">
                          {groups.slice(0, MAX_CHIPS).map((g) => <span key={g.grade} className="sm-chip" data-class="true">{classLabel(g)}</span>)}
                          {groups.length > MAX_CHIPS && (
                            <button className="sm-chip" onClick={() => setViewing(t)} title={groups.slice(MAX_CHIPS).map(classLabel).join(", ")} style={{ cursor: "pointer" }}>
                              +{groups.length - MAX_CHIPS} more
                            </button>
                          )}
                        </div>
                      ) : <span className="sm-muted">No classes yet</span>}
                      {subjects.length > 0 && <small>{subjects.join(", ")}</small>}
                    </div>
                    <div className="tm-att" data-band={b}>
                      {b === "none" ? <span className="sm-muted">No data</span> : (
                        <>
                          <b>{t.attendance_percentage}%</b>
                          <i className="tm-bar" aria-hidden="true"><u style={{ width: `${Math.min(100, t.attendance_percentage ?? 0)}%` }} /></i>
                        </>
                      )}
                      <small>{leaveDays} {leaveDays === 1 ? "day" : "days"} leave</small>
                    </div>
                    <span className="tm-status"><span className="sm-chip" data-on={statusOf(t) === "active"}>{t.status || "Active"}</span></span>
                    <span className="tm-seen"><LastSignIn at={t.last_login} /></span>
                  </article>
                );
              })}
              <Pager
                offset={(page - 1) * PAGE_SIZE}
                count={shown.length}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            </section>
          )}
        </>
      ) : (
        <>
          <div className="nt-bar">
            <ChipGroup
              label="Show leave requests"
              value={leaveFilter}
              options={[["all", "All"], ["Pending", pendingCount > 0 ? `Pending (${pendingCount})` : "Pending"], ["Approved", "Approved"], ["Rejected", "Rejected"]] as const}
              onChange={setLeaveFilter}
            />
          </div>

          {leavesLoading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : leaves.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{leaveFilter === "all" ? "No leave requests yet" : `No ${leaveFilter.toLowerCase()} leave requests`}</b>
                <p>{leaveFilter === "Pending" ? "Every request has been decided." : "Leave requests from your teachers will show up here."}</p>
                {leaveFilter !== "all" && <button className="sd-btn sd-btn--line" onClick={() => setLeaveFilter("all")}>See all requests</button>}
              </div>
            </section>
          ) : (
            <section className="sd-panel as-list mc-swap" aria-label="Leave requests">
              {leaves.map((l) => {
                const name = l.profiles?.full_name || "Unknown teacher";
                const pending = l.status === "Pending";
                const waitingOnMain = l.is_emergency && pending && l.school_admin_status === "approved";
                const reviewer = l.status === "Approved" ? personOf(l.approver) || personOf(l.reviewer) : personOf(l.reviewer);
                return (
                  <article key={l.id} className="tm-leave" data-pending={pending} data-emergency={!!l.is_emergency}>
                    <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>
                    <div className="tm-leave-main">
                      <div className="tm-leave-who"><b>{name}</b><small>{l.profiles?.email || ""}</small></div>
                      <div className="tm-leave-dates">
                        <b>{leaveDates(l)}</b>
                        <span className="sm-muted">{plural(l.total_days || 0, "day")}</span>
                        <span className="sm-chip">{l.leave_type || "Personal"}</span>
                        {l.is_emergency && <span className="sm-chip" data-tone="red">Emergency</span>}
                        {l.substitute_required && <span className="sm-chip">Needs a substitute</span>}
                      </div>
                      {l.reason && <p className="tm-leave-reason">{l.reason}</p>}
                      <LeaveStages leave={l} />
                      {(l.status === "Approved" || l.status === "Rejected") && (
                        <p className="tm-leave-by">
                          {l.status === "Approved" ? "Approved by" : "Reviewed by"} {reviewer || "an admin"}
                          {l.reviewed_at ? ` on ${shortDate(l.reviewed_at)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="tm-leave-act">
                      {waitingOnMain && <span className="tm-wait">Waiting for the main admin</span>}
                      {pending && !waitingOnMain && (
                        <>
                          <button className="sd-btn sd-btn--line tm-reject" onClick={() => setRejecting(l)} disabled={busyLeave}><X aria-hidden="true" />Reject</button>
                          <button className="sd-btn sd-btn--amber" onClick={() => void decide(l, "approve")} disabled={busyLeave}><Check aria-hidden="true" />Approve</button>
                        </>
                      )}
                      {l.status === "Approved" && <span className="sm-chip" data-tone="done">Approved</span>}
                      {l.status === "Rejected" && <span className="sm-chip" data-tone="red">Rejected</span>}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}

      <TeacherDetailModal
        teacher={viewing}
        onClose={() => setViewing(null)}
        onRecordLeave={() => openEmergency(String(viewing?.id ?? ""))}
      />

      <EmergencyLeaveModal
        key={emKey}
        open={emOpen}
        teachers={teachers}
        initialTeacherId={emTeacher}
        busy={emSaving}
        onClose={() => setEmOpen(false)}
        onSubmit={(v) => void submitEmergency(v)}
      />

      <ConfirmModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        busy={busyLeave}
        danger
        title="Reject this leave request?"
        subtitle={rejecting ? `${rejecting.profiles?.full_name || "The teacher"}'s leave on ${leaveDates(rejecting)} will be rejected.` : undefined}
        confirmLabel="Reject leave"
        onConfirm={() => rejecting && void decide(rejecting, "reject")}
      >
        <p>They will see that it was rejected.</p>
      </ConfirmModal>
    </div>
  );
}
