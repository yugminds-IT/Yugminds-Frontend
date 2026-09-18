"use client";

import { useState } from "react";
import {
  ClipboardList,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { RankingTable, type RankingRow } from "@/components/ui/ranking-table";

/* Analytics tab of the teacher assignments page — extracted from the
 * ~1500-line page file. Pure display over the analytics payload; the sub-tab
 * selection is local UI state and lives here. */

export type AssignmentAnalyticsSummary = {
  assignments_count: number;
  total_submissions: number;
  graded_count: number;
  avg_score: number;
  retake_count: number;
};

export type AssignmentAnalyticsRow = {
  assignment_id: string;
  title: string;
  subject: string | null;
  assignment_type: string;
  retake_enabled: boolean;
  total_submissions: number;
  graded_count: number;
  retake_count: number;
  avg_score_percentage: number;
  highest_score: number;
  lowest_score: number;
};

export type AssignmentStudentRank = {
  rank: number;
  school_rank?: number;
  grade_rank?: number;
  section_rank?: number;
  student_id: number;
  student_name: string;
  grade?: string;
  section?: string;
  course_score: number;
  daily_score: number;
  overall_score: number;
};

export type AssignmentSubjectStat = { subject: string; avg_score: number; submissions: number };

export type AssignmentAnalyticsData = {
  summary: AssignmentAnalyticsSummary;
  assignments: AssignmentAnalyticsRow[];
  top_students: AssignmentStudentRank[];
  subject_breakdown: AssignmentSubjectStat[];
};

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function AssignmentAnalyticsPanel({
  loading,
  data,
}: {
  loading: boolean;
  data: AssignmentAnalyticsData | null;
}) {
  const [subTab, setSubTab] = useState<"leaderboard" | "assignments" | "subjects">("leaderboard");

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-sm font-medium text-gray-500">No analytics data yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Data appears once assignments have submissions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Assignments", value: data.summary.assignments_count },
          { label: "Submissions", value: data.summary.total_submissions },
          { label: "Graded", value: data.summary.graded_count },
          {
            label: "Avg score",
            value: `${(data.summary.avg_score ?? 0).toFixed(1)}%`,
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-gray-200 px-4 py-3"
          >
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {(
          [
            { key: "leaderboard", label: "Leaderboard", icon: Trophy },
            { key: "assignments", label: "Assignments", icon: ClipboardList },
            { key: "subjects", label: "Subjects", icon: TrendingUp },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              subTab === key
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {subTab === key && (
              <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {subTab === "leaderboard" && (
        <div className="border border-gray-200 rounded-lg p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">
              Student rankings
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Overall = Course (60%) + Daily (40%)
            </p>
          </div>
          {(data.top_students ?? []).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No ranking data yet</p>
            </div>
          ) : (
            <RankingTable
              rows={(data.top_students ?? []).map(
                (s): RankingRow => ({
                  student_id: s.student_id,
                  student_name: s.student_name,
                  grade: s.grade,
                  section: s.section,
                  course_score: s.course_score,
                  daily_score: s.daily_score,
                  overall_score: s.overall_score,
                  rank: s.school_rank ?? s.rank,
                  school_rank: s.school_rank ?? s.rank,
                  grade_rank: s.grade_rank,
                  section_rank: s.section_rank,
                }),
              )}
              showRanks={["school", "grade", "section"]}
              showGrade
              showScoreBreakdown
            />
          )}
        </div>
      )}

      {/* Assignments performance */}
      {subTab === "assignments" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">
              Assignment performance
            </h3>
          </div>
          {(data.assignments ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              No assignment data yet
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-3 px-5 text-left">Assignment</th>
                  <th className="py-3 px-4 text-center hidden sm:table-cell">
                    Type
                  </th>
                  <th className="py-3 px-4 text-right">Submissions</th>
                  <th className="py-3 px-4 text-right hidden lg:table-cell">
                    Graded
                  </th>
                  <th className="py-3 px-5 text-right">Avg score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.assignments.map((row) => (
                  <tr
                    key={row.assignment_id}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <p className="font-medium text-gray-900 truncate max-w-52">
                        {row.title}
                      </p>
                      {row.subject && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {row.subject}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center hidden sm:table-cell text-xs text-gray-500">
                      {row.assignment_type === "COURSE" ? "Course" : "Daily"}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-700 font-medium">
                      {row.total_submissions}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-gray-500 hidden lg:table-cell">
                      {row.graded_count}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          row.avg_score_percentage >= 75
                            ? "text-emerald-600"
                            : row.avg_score_percentage >= 50
                              ? "text-amber-600"
                              : "text-red-500"
                        }`}
                      >
                        {row.avg_score_percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Subject breakdown */}
      {subTab === "subjects" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">
              Subject performance
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {(data.subject_breakdown ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No subject data yet
              </p>
            ) : (
              data.subject_breakdown.map((row) => (
                <div key={row.subject}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-800">
                      {row.subject}
                    </span>
                    <span className="text-xs text-gray-400">
                      {row.submissions} submissions
                    </span>
                  </div>
                  <ScoreBar pct={row.avg_score} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
