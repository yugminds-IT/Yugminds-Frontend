"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Check, GraduationCap, Loader2, X } from "lucide-react";
import { teacherApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { classLabel } from "./overview/utils";

interface RetakeRequestRow {
  id: string;
  assignment_id: string;
  assignment_title: string;
  assignment_type: "DAILY" | "COURSE" | "EXAM" | null;
  course_title: string | null;
  student_id: number;
  student_name: string;
  grade: string | null;
  section: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  teacher_remarks: string | null;
  created_at: string;
  decided_at: string | null;
}

const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Declined" },
] as const;
const TYPES = {
  DAILY: { label: "Daily", Icon: CalendarDays },
  COURSE: { label: "Course", Icon: BookOpen },
  EXAM: { label: "Exam", Icon: GraduationCap },
} as const;
type TypeKey = keyof typeof TYPES;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Students asking for another try. Approve to let them retake, or decline with a note. */
export default function TeacherRetakeRequestsPanel({ schoolId }: { schoolId?: string }) {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | TypeKey>("all");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["teacher", "retake-requests", statusFilter, schoolId ?? "all"],
    queryFn: async () => {
      const { data } = await teacherApi.retakeRequests.list({ status: statusFilter, school_id: schoolId });
      return ((data as { requests?: RetakeRequestRow[] })?.requests ?? []) as RetakeRequestRow[];
    },
  });

  // Waiting count independent of the active filter, for the tab badge.
  const { data: pendingCount } = useQuery({
    queryKey: ["teacher", "retake-requests", "pending-count", schoolId ?? "all"],
    queryFn: async () => {
      const { data } = await teacherApi.retakeRequests.list({ status: "pending", school_id: schoolId });
      return ((data as { requests?: RetakeRequestRow[] })?.requests ?? []).length;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action, remarks }: { id: string; action: "approve" | "reject"; remarks?: string }) =>
      teacherApi.retakeRequests.decide(id, { action, remarks }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["teacher", "retake-requests"] }); },
  });

  const handleDecide = async (id: string, action: "approve" | "reject") => {
    setDecidingId(id);
    try {
      await decide.mutateAsync({ id, action, remarks: remarksById[id]?.trim() || undefined });
      toast.success(action === "approve" ? "Retake approved." : "Request declined.");
      setRemarksById((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The request could not be updated.");
    } finally {
      setDecidingId(null);
    }
  };

  const all = data ?? [];
  const requests = typeFilter === "all" ? all : all.filter((r) => r.assignment_type === typeFilter);
  const countOf = (t: TypeKey) => all.filter((r) => r.assignment_type === t).length;

  return (
    <div className="tg-detail" style={{ gap: "1rem" }}>
      <div className="mc-tabs" role="tablist" aria-label="Retake requests" style={{ justifySelf: "start" }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={statusFilter === t.key} className="mc-tab" onClick={() => setStatusFilter(t.key)}>
            {t.label}
            {t.key === "pending" && !!pendingCount && <span className="tg-dot">{pendingCount}</span>}
          </button>
        ))}
      </div>

      <div className="rq-types" role="group" aria-label="Assignment type">
        <button type="button" className="rq-type" data-on={typeFilter === "all"} aria-pressed={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All types<b>{all.length}</b></button>
        {(Object.keys(TYPES) as TypeKey[]).map((t) => {
          const { label, Icon } = TYPES[t];
          return (
            <button key={t} type="button" className="rq-type" data-t={t} data-on={typeFilter === t} aria-pressed={typeFilter === t} onClick={() => setTypeFilter(t)}>
              <Icon aria-hidden="true" />{label}<b>{countOf(t)}</b>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : isError ? (
        <div className="sd-panel"><div className="sd-empty"><b>Could not load requests</b><p>Check your connection and try again.</p><button className="sd-btn sd-btn--ink" onClick={() => void refetch()}>Try again</button></div></div>
      ) : requests.length === 0 ? (
        <div className="sd-panel"><div className="sd-empty"><b>{typeFilter !== "all" ? `No ${TYPES[typeFilter].label.toLowerCase()} requests here` : statusFilter === "pending" ? "No retake requests waiting" : `No ${statusFilter === "approved" ? "approved" : "declined"} requests`}</b><p>{statusFilter === "pending" ? "When a student asks for another try, it shows up here." : "Nothing here yet."}</p></div></div>
      ) : (
        <div className="sd-panel as-list tg-line">
          {requests.map((r) => (
            <article key={r.id} className="tg-req" data-t={r.assignment_type ?? undefined}>
              <div className="tg-req-top">
                <div>
                  {r.assignment_type && (() => { const { label, Icon } = TYPES[r.assignment_type]; return <span className="rq-badge" data-t={r.assignment_type}><Icon aria-hidden="true" />{label}</span>; })()}
                  <b>{r.student_name}</b>
                  <small>{[r.assignment_title, r.course_title, classLabel(r.grade, r.section)].filter(Boolean).join(", ")}</small>
                </div>
                <small style={{ whiteSpace: "nowrap", color: "var(--sd-ink-soft)" }}>{day(r.created_at)}</small>
              </div>
              {r.reason && <p className="tg-quote">{r.reason}</p>}

              {r.status === "pending" ? (
                <>
                  <textarea className="sd-field" rows={2} placeholder="A note for the student (optional)" aria-label={`Note for ${r.student_name}`} value={remarksById[r.id] ?? ""} onChange={(e) => setRemarksById((prev) => ({ ...prev, [r.id]: e.target.value }))} />
                  <div className="tg-req-acts">
                    <button type="button" className="sd-btn sd-btn--ink tg-btn" onClick={() => void handleDecide(r.id, "approve")} disabled={decidingId === r.id}>
                      {decidingId === r.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}Approve retake
                    </button>
                    <button type="button" className="sd-btn sd-btn--line tg-btn" onClick={() => void handleDecide(r.id, "reject")} disabled={decidingId === r.id}><X aria-hidden="true" />Decline</button>
                  </div>
                </>
              ) : (
                <p className="tg-note" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                  <span className="tg-chip" data-s={r.status === "approved" ? "granted" : "rejected"}>{r.status === "approved" ? "Approved" : "Declined"}</span>
                  {r.decided_at && <span>{day(r.decided_at)}</span>}
                  {r.teacher_remarks && <span>Your note: {r.teacher_remarks}</span>}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
