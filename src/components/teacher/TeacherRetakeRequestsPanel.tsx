"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teacherApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw, CheckCircle2, XCircle, Clock } from "lucide-react";

interface RetakeRequestRow {
  id: string;
  assignment_id: string;
  assignment_title: string;
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
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export default function TeacherRetakeRequestsPanel() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "retake-requests", statusFilter],
    queryFn: async () => {
      const { data } = await teacherApi.retakeRequests.list({ status: statusFilter });
      return ((data as { requests?: RetakeRequestRow[] })?.requests ?? []) as RetakeRequestRow[];
    },
  });

  // Pending count independent of the active filter, for the tab badge.
  const { data: pendingCount } = useQuery({
    queryKey: ["teacher", "retake-requests", "pending-count"],
    queryFn: async () => {
      const { data } = await teacherApi.retakeRequests.list({ status: "pending" });
      return ((data as { requests?: RetakeRequestRow[] })?.requests ?? []).length;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action, remarks }: { id: string; action: "approve" | "reject"; remarks?: string }) =>
      teacherApi.retakeRequests.decide(id, { action, remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "retake-requests"] });
    },
  });

  const handleDecide = async (id: string, action: "approve" | "reject") => {
    setDecidingId(id);
    try {
      await decide.mutateAsync({ id, action, remarks: remarksById[id]?.trim() || undefined });
      toast.success(action === "approve" ? "Retake approved." : "Request declined.");
      setRemarksById((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setDecidingId(null);
    }
  };

  const requests = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              statusFilter === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.key === "pending" && !!pendingCount && (
              <span className="bg-amber-500 text-white rounded-full text-[10px] px-1.5 py-0.5 leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <RotateCcw className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No {statusFilter} retake requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{r.student_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.assignment_title}
                    {r.course_title ? ` · ${r.course_title}` : ""}
                    {(r.grade || r.section) && (
                      <> · {r.grade ?? ""}{r.grade && r.section ? " " : ""}{r.section ? `Sec ${r.section}` : ""}</>
                    )}
                  </p>
                  {r.reason && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
                      &ldquo;{r.reason}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>

              {r.status === "pending" ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={remarksById[r.id] ?? ""}
                    onChange={(e) => setRemarksById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Optional note to the student…"
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecide(r.id, "approve")}
                      disabled={decidingId === r.id}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                    >
                      {decidingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecide(r.id, "reject")}
                      disabled={decidingId === r.id}
                      className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`mt-3 flex items-center gap-2 text-xs font-medium ${r.status === "approved" ? "text-emerald-600" : "text-red-500"}`}>
                  {r.status === "approved" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {r.status === "approved" ? "Approved" : "Declined"}
                  {r.decided_at && (
                    <span className="text-gray-400 font-normal">
                      · {new Date(r.decided_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {r.teacher_remarks && <span className="text-gray-500 font-normal">— &ldquo;{r.teacher_remarks}&rdquo;</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
