"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Users } from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/teacher/assignments/assignments-shared";

type MarksStudent = {
  student_id: number;
  student_name: string;
  grade: string | null;
  section: string | null;
  attempts: number;
  score: number | null;
  max_score: number | null;
  percent: number | null;
  status: "graded" | "pending";
  submitted_at: string;
};

type MarksData = {
  assignment: {
    id: string;
    title: string;
    assignment_type: string;
    subject: string | null;
    total_marks: number | null;
    scoring_rule: string;
  };
  students: MarksStudent[];
};

type Filter = "all" | "graded" | "pending";

const classLabel = (s: MarksStudent) =>
  [s.grade, s.section].filter(Boolean).join("-") || "—";

function scoreColor(pct: number | null) {
  if (pct == null) return "text-gray-400";
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

export function AssignmentMarksPanel({
  assignmentId,
  onBack,
}: {
  assignmentId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<MarksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    schoolAdminApi.stats
      .assignmentMarks(assignmentId)
      .then(({ data: res }) => {
        if (!cancelled) setData(res as MarksData);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const students = useMemo(() => data?.students ?? [], [data]);
  const classes = useMemo(
    () => [...new Set(students.map(classLabel))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [students],
  );
  const gradedCount = students.filter((s) => s.status === "graded").length;
  const pendingCount = students.length - gradedCount;
  const graded = students.filter((s) => s.percent != null);
  const avgPercent = graded.length
    ? Math.round(graded.reduce((sum, s) => sum + (s.percent ?? 0), 0) / graded.length)
    : null;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (classFilter === "all" || classLabel(s) === classFilter) &&
        (!q || s.student_name.toLowerCase().includes(q) || classLabel(s).toLowerCase().includes(q)),
    );
  }, [students, filter, classFilter, search]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: students.length },
    { id: "graded", label: "Graded", count: gradedCount },
    { id: "pending", label: "Pending", count: pendingCount },
  ];

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="px-5 py-3 border-b border-gray-100 space-y-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All assignments
        </button>
        {data && (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">{data.assignment.title}</h2>
            <Badge
              className={`border-0 text-xs ${
                data.assignment.assignment_type === "COURSE"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {data.assignment.assignment_type === "COURSE" ? "Course" : "Daily"}
            </Badge>
            {data.assignment.subject && (
              <span className="text-xs text-gray-500">{data.assignment.subject}</span>
            )}
            {data.assignment.total_marks != null && (
              <span className="text-xs text-gray-500">· {data.assignment.total_marks} marks</span>
            )}
            {avgPercent != null && (
              <span className={`text-xs font-semibold ${scoreColor(avgPercent)}`}>
                · Avg {avgPercent}%
              </span>
            )}
          </div>
        )}
        {data?.assignment.scoring_rule === "highest" && (
          <p className="text-[11px] text-gray-400">Score shown is each student&apos;s highest graded attempt.</p>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : error || !data ? (
          <p className="text-sm text-gray-400 text-center py-8">Could not load marks for this assignment.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students..."
                  className="h-8 pl-8 text-sm"
                />
              </div>
              {classes.length > 1 && (
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700"
                >
                  <option value="all">All classes</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`h-8 px-3 rounded-md text-xs font-medium border transition-colors ${
                    filter === f.id
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {f.label} {f.count}
                </button>
              ))}
            </div>

            {students.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No students from your school have submitted this yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="py-2.5 px-4 text-left">Student</th>
                      <th className="py-2.5 px-3 text-left">Class</th>
                      <th className="py-2.5 px-3 text-center">Attempts</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((s) => (
                      <tr key={s.student_id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={s.student_name} />
                            <span className="font-medium text-gray-900">{s.student_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-500">{classLabel(s)}</td>
                        <td className="py-2.5 px-3 text-center text-xs text-gray-700">{s.attempts}</td>
                        <td className="py-2.5 px-3 text-right">
                          {s.score != null ? (
                            <span className={`text-sm font-semibold ${scoreColor(s.percent)}`}>
                              {s.score}/{s.max_score ?? "—"}
                              {s.percent != null && (
                                <span className="text-xs font-normal text-gray-400 ml-1">({s.percent}%)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span
                            className={`text-xs font-medium ${
                              s.status === "graded" ? "text-emerald-700" : "text-amber-600"
                            }`}
                          >
                            {s.status === "graded" ? "Graded" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                          No students match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
