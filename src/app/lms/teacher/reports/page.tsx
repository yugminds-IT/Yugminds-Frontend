"use client";

import { REPORT_SUBJECTS } from "@/lib/report-subjects";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, RefreshCw, Send } from "lucide-react";
import { useTeacherSchool } from "../context";
import { WEEKDAY_NAMES } from "@/lib/weekday-utils";
import {
  useTeacherReports,
  useSubmitReport,
  useTeacherPeriods,
  useTeacherDayStatus,
  useTodayAttendanceStatus,
} from "@/hooks/useTeacherData";
import { useSmartRefresh } from "@/hooks/useSmartRefresh";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { loadFormData, clearFormData } from "@/lib/form-persistence";
import { toast } from "@/components/ui/toast";
import { requestClose, useBeforeUnloadWhenDirty } from "@/hooks/useUnsavedCloseGuard";
import ReportRun, { type RunSlot } from "@/components/teacher/reports/ReportRun";
import RecentReports from "@/components/teacher/reports/RecentReports";
import { errorText, isRejected, periodClass, periodSpan, subjectOf, type PeriodRow, type ReportRow } from "@/components/teacher/reports/utils";
import "@/components/school-admin/overview.css"; // hero meta, rows
import "@/components/teacher/overview/overview.css"; // day track, status chips
import "@/components/teacher/reports/reports.css";

const NOTES_MAX = 1000;
type FormState = {
  period_id: string;
  subject: string;
  grade: string;
  section: string;
  date: string;
  start_time: string;
  end_time: string;
  topics_taught: string;
  activities: string;
  notes: string;
  student_count: string;
};
const localToday = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
const blank = (date: string): FormState => ({ period_id: "", subject: "", grade: "", section: "", date, start_time: "", end_time: "", topics_taught: "", activities: "", notes: "", student_count: "" });

/**
 * Submit report. One report per class per day. Submitting every class before 8 PM IST marks the day present,
 * and a rejected report can be sent again (the server updates the same one).
 */
export default function SubmitReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { selectedSchool, schools, onSchoolChange } = useTeacherSchool();

  // Links from the dashboard and My classes arrive with ?period_id= or ?grade=&section=
  const paramPeriod = searchParams.get("period_id") ?? "";
  const gradeParam = searchParams.get("grade");
  const sectionParam = searchParams.get("section");

  // A draft kept on this device wins over the link, so a half-written report is never lost
  const [saved] = useState(() => (typeof window !== "undefined" ? loadFormData<FormState>("teacher-report-form") : null));
  const [formData, setFormData] = useState<FormState>(() => ({ ...blank(localToday()), ...(saved ?? {}), period_id: saved?.period_id || paramPeriod }));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const { isDirty: isFormDirty, clearSavedData } = useAutoSaveForm({
    formId: "teacher-report-form",
    formData,
    autoSave: true,
    autoSaveInterval: 2000,
    debounceDelay: 500,
    useSession: false,
    onLoad: (data) => {
      if (data && (!saved || Object.keys(saved).length === 0)) setFormData(data as FormState);
    },
    markDirty: true,
  });
  const hasContent = formData.period_id !== "" || formData.topics_taught !== "" || formData.activities !== "" || formData.notes !== "";
  const reportIsDirty = isFormDirty && hasContent;
  useBeforeUnloadWhenDirty(reportIsDirty);

  /* ───────── today, as the server sees it ───────── */
  // The server's IST date is the only "today"; the device clock or an old draft never decides the day.
  const { data: serverDay } = useTeacherDayStatus();
  const serverToday = serverDay?.date;
  const today = serverToday ?? formData.date;
  const staleDraft = !!serverToday && formData.date !== serverToday; // a draft from another day keeps its text but not its class

  const { data: dayStatus } = useTeacherDayStatus(today);
  const closedRow = selectedSchool?.id ? dayStatus?.schools?.find((s) => s.school_id === selectedSchool.id) : undefined;
  const closedDay = closedRow?.status === "holiday" ? closedRow.holiday ?? { name: "Holiday", type: "Holiday" } : null;
  const { data: todayStatus } = useTodayAttendanceStatus(selectedSchool?.id);
  const cutoffPassed = (todayStatus as { before_cutoff?: boolean } | undefined)?.before_cutoff === false;

  const dayDate = new Date(`${today}T00:00:00`);
  const dayName = WEEKDAY_NAMES[(Number.isNaN(dayDate.getTime()) ? new Date() : dayDate).getDay()];
  const dateLabel = Number.isNaN(dayDate.getTime()) ? "" : dayDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  const { data: periodData, isLoading: periodsLoading, refetch: refetchPeriods } = useTeacherPeriods(selectedSchool?.id, dayName);
  const { data: reportData, refetch: refetchReports } = useTeacherReports(selectedSchool?.id, { date: today });
  const { data: recentData, isLoading: recentLoading, refetch: refetchRecent } = useTeacherReports(selectedSchool?.id, { limit: 10 });
  const submitReport = useSubmitReport();

  // Fresh periods whenever the school or day changes
  useEffect(() => {
    if (selectedSchool?.id && dayName) void refetchPeriods();
  }, [selectedSchool?.id, dayName, refetchPeriods]);

  const periods = useMemo(
    () => [...((periodData ?? []) as PeriodRow[])].sort((a, b) => String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""))),
    [periodData],
  );
  const reportsToday = useMemo(() => ((reportData ?? []) as ReportRow[]).filter((r) => r.date === today), [reportData, today]);
  const recent = (recentData ?? []) as ReportRow[];

  // Uniqueness is class + date. Rejected reports stay open so they can be sent again.
  const doneIds = useMemo(() => new Set(reportsToday.filter((r) => r.period_id && !isRejected(r)).map((r) => r.period_id as string)), [reportsToday]);
  const redoIds = useMemo(() => new Set(reportsToday.filter((r) => r.period_id && isRejected(r)).map((r) => r.period_id as string)), [reportsToday]);

  /* ───────── which class the form is for ───────── */
  const typed = staleDraft ? paramPeriod : formData.period_id;
  const fromGrade = useMemo(() => {
    if (typed || !gradeParam || periods.length === 0) return "";
    const matches = periods.filter((p) => p.grade === gradeParam && (!sectionParam || (p.section ?? "") === sectionParam));
    return (matches.find((p) => !doneIds.has(p.id)) ?? matches[0])?.id ?? "";
  }, [typed, gradeParam, sectionParam, periods, doneIds]);
  const periodId = doneIds.has(typed || fromGrade) ? "" : typed || fromGrade;
  const selected = periods.find((p) => p.id === periodId) ?? null;

  // The subject starts as the timetable's subject for this period; the teacher confirms it or changes it.
  const timetableSubject = selected?.subject ?? "";
  const subject = formData.subject || timetableSubject;

  // Picking another class resets the subject to that class's timetable subject.
  const pick = (id: string) => setFormData((prev) => ({ ...prev, period_id: id, subject: "", date: today }));
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setFormData((prev) => ({ ...prev, [k]: e.target.value }));

  const slots: RunSlot[] = periods.map((p) => ({
    id: p.id,
    title: subjectOf(p),
    detail: periodClass(p),
    start: p.start_time,
    state: doneIds.has(p.id) ? "done" : redoIds.has(p.id) ? "redo" : "todo",
  }));
  const doneCount = slots.filter((s) => s.state === "done").length;
  const remaining = periods.length - doneCount;

  /* ───────── what is still missing ───────── */
  const missing: string[] = [];
  if (!selected) missing.push("pick a class");
  else if (!selected.grade) missing.push("this class has no grade on the timetable, ask your admin");
  if (selected && !subject) missing.push("pick the subject");
  if (!formData.topics_taught.trim()) missing.push("say what you taught");
  const canSend = missing.length === 0 && !closedDay && !!serverToday && !submitReport.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool || !selected || !canSend) return;
    try {
      const result = await submitReport.mutateAsync({
        school_id: selectedSchool.id!,
        period_id: selected.id,
        subject,
        grade: selected.grade!,
        section: selected.section || undefined,
        date: serverToday!,
        start_time: selected.start_time || undefined,
        end_time: selected.end_time || undefined,
        topics_taught: formData.topics_taught.trim(),
        activities: formData.activities || undefined,
        notes: formData.notes || undefined,
        student_count: formData.student_count.trim() ? Number(formData.student_count) : undefined,
      });
      await Promise.all([refetchReports(), refetchRecent()]);
      setFormData(blank(serverToday!));
      clearFormData("teacher-report-form");
      clearSavedData();
      const marked = (result as { attendance_marked_present?: boolean })?.attendance_marked_present;
      toast.success(marked ? "Report submitted. Your attendance is marked present." : "Report submitted.");
    } catch (error) {
      toast.error(`The report was not submitted. ${await errorText(error)}`);
    }
  };

  const handleCancel = () => {
    void requestClose(reportIsDirty, () => {
      clearSavedData();
      router.push("/lms/teacher");
    });
  };

  const refreshing = queryClient.isFetching({ queryKey: ["teacher"] }) > 0;
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["teacher", "periods", selectedSchool?.id] }),
    queryClient.invalidateQueries({ queryKey: ["teacher", "schedules", selectedSchool?.id] }),
    queryClient.invalidateQueries({ queryKey: ["teacher", "reports", selectedSchool?.id] }),
    queryClient.invalidateQueries({ queryKey: ["teacher", "today-attendance"] }),
  ]);
  useSmartRefresh({
    queryKeys: [["teacher", "periods", selectedSchool?.id, dayName], ["teacher", "schedules", selectedSchool?.id], ["teacher", "reports", selectedSchool?.id]],
    hasUnsavedData: () => reportIsDirty,
    minRefreshInterval: 60000,
  });

  if (!selectedSchool) {
    return (
      <div className="sd-page">
        <section className="sd-panel">
          <div className="sd-empty">
            <b>Pick a school to report for</b>
            <p>A report belongs to one school. Choose where you taught, or use the school menu at the top.</p>
            <div className="sr-schools">
              {schools.map((s) => <button key={s.id} className="sd-btn sd-btn--line" onClick={() => onSchoolChange(s)}>{s.name}</button>)}
            </div>
          </div>
        </section>
      </div>
    );
  }

  let status: React.ReactNode;
  if (closedDay) status = <>{selectedSchool.name} is closed today: {closedDay.name}. No reports are due.</>;
  else if (periodsLoading) status = "Checking today's classes…";
  else if (periods.length === 0) status = "You have no classes today, so nothing is due.";
  else if (remaining === 0) status = <><strong>All {periods.length} {periods.length === 1 ? "report is" : "reports are"} in.</strong> You are done for the day.</>;
  else status = <><strong>{doneCount} of {periods.length}</strong> classes reported. {cutoffPassed ? "The 8 PM cutoff has passed, but please still submit." : "Submit the rest before 8 PM."}</>;

  const caption = selected ? `${subjectOf(selected)} picked` : remaining === 0 && periods.length > 0 ? "All reports are in" : "Pick a class to start";

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="sr-title">
        <div className="sd-hero-copy">
          <h1 id="sr-title" className="mc-hero-title">Submit report</h1>
          <p className="sd-where">{selectedSchool.name}{dateLabel ? `, ${dateLabel}` : ""}</p>
          <p className="sd-status">{status}</p>
          <div className="so-meta">
            <button className="so-refresh" onClick={() => void refresh()} disabled={refreshing || periodsLoading} aria-label={refreshing ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {periodsLoading ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <ReportRun slots={slots} selectedId={periodId} onSelect={pick} caption={caption} />
        )}
      </section>

      <div className="sr-grid">
        <section className="sd-panel sr-formpanel" aria-labelledby="sr-form-title">
          <form className="sr-form" onSubmit={handleSubmit} noValidate>
            <div className="sd-panel-head" style={{ margin: 0 }}>
              <div>
                <h2 id="sr-form-title">{selected ? `${subjectOf(selected)}${periodClass(selected) ? `, ${periodClass(selected)}` : ""}` : "Daily teaching report"}</h2>
                <p>{selected ? periodSpan(selected) : "One report for each class you taught today."}</p>
              </div>
            </div>

            <p className="sr-note" data-warn={cutoffPassed || !!closedDay}>
              {closedDay
                ? `${selectedSchool.name} is closed today (${closedDay.name}). Reports cannot be submitted.`
                : cutoffPassed
                ? "The 8 PM IST cutoff has passed, so today is marked absent. Reports are still saved."
                : "Report every class before 8 PM IST and your attendance is marked present. After that the day is marked absent."}
            </p>

            <fieldset disabled={!!closedDay}>
              <div className="sr-step" role="radiogroup" aria-labelledby="sr-which">
                <h3 id="sr-which">Which class?</h3>
                {periodsLoading ? (
                  <><div className="sd-skel" /><div className="sd-skel" /></>
                ) : periods.length === 0 ? (
                  <p className="sr-hint">You have no classes scheduled today. Your timetable is under My classes.</p>
                ) : (
                  <div className="sr-picks">
                    {periods.map((p) => {
                      const st = doneIds.has(p.id) ? "done" : redoIds.has(p.id) ? "redo" : "todo";
                      return (
                        <label key={p.id} className="sr-pick">
                          <input type="radio" name="period" value={p.id} checked={periodId === p.id} disabled={st === "done"} onChange={() => pick(p.id)} />
                          <span className="sr-dot" aria-hidden="true" />
                          <span className="sr-pick-time">{periodSpan(p).split(" to ")[0]}</span>
                          <span className="sr-pick-main">
                            <b>{subjectOf(p)}</b>
                            <small>{[periodClass(p), p.period_number ? `Period ${p.period_number}` : ""].filter(Boolean).join(" · ")}</small>
                          </span>
                          {st !== "todo" && (
                            <span className="to-chip" data-s={st === "done" ? "done" : "rejected"}>
                              {st === "done" && <Check aria-hidden="true" />}
                              {st === "done" ? "Reported" : "Rejected, send again"}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="sd-field-wrap">
                <label htmlFor="report_subject">Subject</label>
                <select id="report_subject" className="sd-field" value={subject} onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))} aria-required="true">
                  <option value="" disabled>Pick the subject you taught</option>
                  {REPORT_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {timetableSubject && subject !== timetableSubject && <small className="sr-hint">The timetable has {timetableSubject} for this class.</small>}
              </div>

              <div className="sd-field-wrap">
                <label htmlFor="topics_taught">What did you teach?</label>
                <textarea id="topics_taught" className="sd-field" rows={4} maxLength={NOTES_MAX} placeholder="For example: fractions, adding unlike denominators" value={formData.topics_taught} onChange={set("topics_taught")} aria-required="true" />
              </div>

              <div className="sd-field-wrap sr-small">
                <label htmlFor="student_count">Students present <small>(optional)</small></label>
                <input id="student_count" className="sd-field" type="number" inputMode="numeric" min={0} value={formData.student_count} onChange={set("student_count")} />
              </div>

              <div className="sd-field-wrap">
                <label htmlFor="activities">Activities <small>(optional)</small></label>
                <textarea id="activities" className="sd-field" rows={3} maxLength={NOTES_MAX} placeholder="Group work, a demo, a quiz" value={formData.activities} onChange={set("activities")} />
              </div>

              <div className="sd-field-wrap">
                <label htmlFor="notes">Notes for your admin <small>(optional)</small></label>
                <textarea id="notes" className="sd-field" rows={3} maxLength={NOTES_MAX} placeholder="Anything worth knowing about this class" value={formData.notes} onChange={set("notes")} />
              </div>
            </fieldset>

            <div className="sr-foot">
              <p data-warn={missing.length > 0 && hasContent}>
                {closedDay ? "No reports are due on a holiday." : missing.length > 0 ? `Still needed: ${missing.join(", ")}.` : reportIsDirty ? "Your draft is kept on this device until you submit." : "Ready to submit."}
              </p>
              <div className="sr-foot-acts">
                <button type="button" className="sd-btn sd-btn--line" onClick={handleCancel}>Cancel</button>
                <button type="submit" className="sd-btn sd-btn--amber" disabled={!canSend}>
                  {submitReport.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {submitReport.isPending ? "Submitting" : "Submit report"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="sd-panel" aria-labelledby="sr-recent">
          <div className="sd-panel-head"><div><h2 id="sr-recent">Recent reports</h2><p>Your latest, and where each one stands</p></div><Link href="/lms/teacher/reports/history" className="sd-btn sd-btn--line">View all</Link></div>
          {recentLoading ? (
            <><div className="sd-skel" /><div className="sd-skel" /></>
          ) : recent.length === 0 ? (
            <div className="sd-empty"><b>No reports yet</b><p>Your first report will show up here, with its review status.</p></div>
          ) : (
            <RecentReports reports={recent} now={now} todayStr={today} limit={10} />
          )}
        </section>
      </div>
    </div>
  );
}
