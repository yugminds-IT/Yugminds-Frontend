"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Copy, KeyRound, UserCheck, UserX } from "lucide-react";
import { academy, formatINR, type CourseRow, type LearnerRow } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { DashboardPage, StatusBadge } from "@/components/academy/ui";
import { ManagementTable, type ManagementTableColumn } from "@/components/ui/management-table";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const COLUMNS: ManagementTableColumn<LearnerRow>[] = [
  {
    id: "name",
    header: "Learner",
    sortable: true,
    sortValue: (l) => l.fullName,
    searchValue: (l) => `${l.fullName} ${l.parentName ?? ""}`,
    render: (l) => (
      <div>
        <p className="font-medium text-gray-900">{l.fullName}</p>
        {l.parentName && <p className="text-xs text-muted-foreground">Parent: {l.parentName}</p>}
      </div>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    searchValue: (l) => `${l.email} ${l.phone ?? ""}`,
    render: (l) => (
      <div>
        <p>{l.email}</p>
        <p className="text-xs text-muted-foreground">{l.phone}</p>
      </div>
    ),
  },
  { id: "courses", header: "Courses", align: "right", sortable: true, sortValue: (l) => l.courseCount, render: (l) => <span className="tabular-nums">{l.courseCount}</span> },
  { id: "spent", header: "Spent", align: "right", sortable: true, sortValue: (l) => l.spentInPaise, render: (l) => <span className="tabular-nums">{formatINR(l.spentInPaise)}</span> },
  {
    id: "joined",
    header: "Joined",
    sortable: true,
    sortValue: (l) => l.createdAt,
    render: (l) => <span className="whitespace-nowrap">{new Date(l.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>,
  },
  {
    id: "status",
    header: "Status",
    filterable: true,
    filterValue: (l) => (l.isActive ? "active" : "disabled"),
    filterPlaceholder: "active / disabled",
    render: (l) => <StatusBadge status={l.isActive ? "ACTIVE" : "DISABLED"} />,
  },
];

export default function LearnersPage() {
  const [rows, setRows] = useState<LearnerRow[] | null>(null);
  const [error, setError] = useState("");
  const [granting, setGranting] = useState<LearnerRow | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [courseId, setCourseId] = useState("");
  const [msg, setMsg] = useState("");
  const [issued, setIssued] = useState<{ email: string; tempPassword: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    academy.admin.learners().then(setRows).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    load();
    academy.admin.courses().then(setCourses).catch(() => {});
  }, [load]);

  const grant = async () => {
    if (!granting || !courseId) return;
    setMsg("");
    try {
      await academy.admin.grant(granting.id, courseId);
      setGranting(null);
      setCourseId("");
      load();
    } catch (e) {
      setMsg(errorText(e));
    }
  };

  const reset = async (l: LearnerRow) => {
    const ok = await confirmDialog({
      title: `Reset ${l.fullName}'s password?`,
      description: "They get a one-time password (shown once, here) and must choose a new one when they sign in. Their other sessions are signed out.",
      confirmText: "Reset password",
    });
    if (!ok) return;
    try {
      setIssued(await academy.admin.resetPassword(l.id));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const toggleActive = async (l: LearnerRow) => {
    setBusyId(l.id);
    try {
      await academy.admin.setActive(l.id, !l.isActive);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardPage title="Learners" subtitle="Everyone with an Academy learner account (newest 200).">
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {issued && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">One-time password — share it with the learner now; it won&apos;t be shown again:</p>
          <p className="mt-2 font-mono">
            {issued.email} / {issued.tempPassword}
            <button onClick={() => navigator.clipboard.writeText(`${issued.email} / ${issued.tempPassword}`)} className="ml-2 inline-flex align-middle text-emerald-700" aria-label="Copy"><Copy className="h-4 w-4" /></button>
          </p>
        </div>
      )}
      <ManagementTable
        rows={rows ?? []}
        loading={rows === null}
        columns={COLUMNS}
        entityName="learner"
        searchPlaceholder="Search name, email or phone…"
        emptyMessage="No learners yet."
        enableSelection={false}
        actionLoadingId={busyId}
        getRowLabel={(l) => l.fullName}
        rowActions={[
          { id: "grant", label: "Give a course", icon: <BookOpen className="h-4 w-4" />, onClick: (l) => { setMsg(""); setGranting(l); } },
          { id: "reset", label: "Reset password", icon: <KeyRound className="h-4 w-4" />, onClick: reset },
          {
            id: "active",
            label: "Disable",
            getLabel: (l) => (l.isActive ? "Disable account" : "Enable account"),
            icon: <UserX className="h-4 w-4" />,
            destructive: true,
            separatorBefore: true,
            onClick: toggleActive,
          },
        ]}
      />

      <Dialog open={!!granting} onOpenChange={(o) => !o && setGranting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Give a course for free</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{granting?.fullName} gets access without paying (e.g. scholarship or support case).</p>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" aria-label="Course">
            <option value="">Pick a course…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}{c.isPublished ? "" : " (draft)"}</option>)}
          </select>
          {msg && <p className="text-sm text-rose-600">{msg}</p>}
          <button onClick={grant} disabled={!courseId} className="flex items-center justify-center gap-2 rounded-md bg-ac-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-50">
            <UserCheck className="h-4 w-4" /> Give access
          </button>
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
