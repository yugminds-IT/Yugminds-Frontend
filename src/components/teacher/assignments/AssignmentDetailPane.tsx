"use client";

import {
  Users,
  RotateCcw,
  CheckCircle,
  CheckSquare,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Search,
  Edit,
  HelpCircle,
  Lock,
  ArrowLeft,
  Zap,
} from "lucide-react";
import type { TeacherClass } from "@/components/teacher/AssignmentAudiencePicker";
import {
  StatusPill,
  Avatar,
  audienceChipLabel,
  type TeacherAssignment,
  type AssignmentDetail,
  type StudentRow,
  type DetailTab,
} from "./assignments-shared";

type Props = {
  tab: "daily" | "course";
  selectedAssignment: TeacherAssignment | null;
  assignmentDetail: AssignmentDetail | null;
  detailLoading: boolean;
  detailTab: DetailTab;
  onDetailTabChange: (t: DetailTab) => void;
  onBack?: () => void;
  loading: boolean;
  teacherClasses: TeacherClass[];
  submissionsCount: number;
  gradedCount: number;
  pendingCount: number;
  // actions
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onOpenRetakeForAll: () => void;
  onGrantRetake: (studentId: number) => void;
  onRevokeRetake: (studentId: number) => void;
  grantingStudentId: number | null;
  // submissions
  studentRows: StudentRow[];
  filteredStudentRows: StudentRow[];
  subSearch: string;
  onSubSearchChange: (v: string) => void;
  subFilter: "all" | "graded" | "pending";
  onSubFilterChange: (v: "all" | "graded" | "pending") => void;
  expanded: Set<number>;
  onToggleExpand: (studentId: number) => void;
  grading: Record<string, { score: string; feedback: string }>;
  onGradingChange: (
    id: string,
    patch: Partial<{ score: string; feedback: string }>,
  ) => void;
  onGrade: (submissionId: string) => void;
  retakeRuleLabel: string;
  // grant retake filters
  grantSearch: string;
  onGrantSearchChange: (v: string) => void;
  grantFilter: "all" | "graded" | "pending";
  onGrantFilterChange: (v: "all" | "graded" | "pending") => void;
  filteredGrantRows: StudentRow[];
};

function FilterChips({
  value,
  onChange,
  counts,
}: {
  value: "all" | "graded" | "pending";
  onChange: (v: "all" | "graded" | "pending") => void;
  counts: { all: number; graded: number; pending: number };
}) {
  return (
    <div className="flex items-center gap-1">
      {(["all", "graded", "pending"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`h-9 px-3 text-xs font-medium rounded-lg border transition-colors ${
            value === f
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          {f.charAt(0).toUpperCase() + f.slice(1)}
          <span className="ml-1.5 opacity-70">{counts[f]}</span>
        </button>
      ))}
    </div>
  );
}

export default function AssignmentDetailPane(props: Props) {
  const {
    tab,
    selectedAssignment,
    assignmentDetail,
    detailLoading,
    detailTab,
    onDetailTabChange,
    onBack,
    loading,
    teacherClasses,
    submissionsCount,
    gradedCount,
    pendingCount,
    onEdit,
    onTogglePublish,
    onDelete,
    onOpenRetakeForAll,
    onGrantRetake,
    onRevokeRetake,
    grantingStudentId,
    studentRows,
    filteredStudentRows,
    subSearch,
    onSubSearchChange,
    subFilter,
    onSubFilterChange,
    expanded,
    onToggleExpand,
    grading,
    onGradingChange,
    onGrade,
    retakeRuleLabel,
    grantSearch,
    onGrantSearchChange,
    grantFilter,
    onGrantFilterChange,
    filteredGrantRows,
  } = props;

  if (!selectedAssignment) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16 bg-white">
        <p className="text-base font-medium text-gray-700 mb-1">
          Select an assignment
        </p>
        <p className="text-sm text-gray-400 max-w-xs">
          Choose one from the list to view submissions, grade students, and
          manage retakes.
        </p>
      </div>
    );
  }

  const audience = audienceChipLabel(selectedAssignment, teacherClasses);
  const filterCounts = {
    all: studentRows.length,
    graded: studentRows.filter((r) => r.best).length,
    pending: studentRows.filter((r) => !r.best).length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="p-5 lg:p-6 max-w-4xl">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden mb-4 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </button>
        )}

        {/* Header */}
        <div className="mb-5 pb-5 border-b border-gray-100">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <StatusPill published={selectedAssignment.is_published} />
                <span className="text-[11px] text-gray-400 capitalize">
                  {selectedAssignment.assignment_type?.toLowerCase() ?? tab}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 leading-snug">
                {selectedAssignment.title}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {[
                  selectedAssignment.subject ?? "General",
                  audience,
                  selectedAssignment.total_marks
                    ? `${selectedAssignment.total_marks} marks`
                    : null,
                  selectedAssignment.due_date
                    ? `Due ${new Date(selectedAssignment.due_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tab === "daily" && (
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={onTogglePublish}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {selectedAssignment.is_published ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Unpublish
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Publish
                  </>
                )}
              </button>
              {tab === "daily" && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {submissionsCount} submission{submissionsCount !== 1 ? "s" : ""} ·{" "}
            {gradedCount} graded · {pendingCount} pending
          </p>
        </div>

        {/* Detail tabs */}
        <div className="flex gap-4 border-b border-gray-100 mb-5">
          {(
            [
              { key: "submissions" as const, label: "Submissions", icon: Users },
              { key: "questions" as const, label: "Questions", icon: HelpCircle },
              { key: "retake" as const, label: "Retakes", icon: RotateCcw },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onDetailTabChange(key)}
              className={`relative flex items-center gap-1.5 pb-2.5 text-sm font-medium transition-colors ${
                detailTab === key
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {key === "questions" && assignmentDetail?.questions?.length
                ? ` (${assignmentDetail.questions.length})`
                : ""}
              {detailTab === key && (
                <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Submissions */}
        {detailTab === "submissions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  placeholder="Search students…"
                  value={subSearch}
                  onChange={(e) => onSubSearchChange(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
              <FilterChips
                value={subFilter}
                onChange={onSubFilterChange}
                counts={filterCounts}
              />
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {studentRows.length === 0 ? (
                <div className="text-center py-14 text-gray-400">
                  <p className="text-sm font-medium text-gray-500">
                    No submissions yet
                  </p>
                  <p className="text-xs mt-1">
                    Students haven&apos;t submitted this assignment
                  </p>
                </div>
              ) : filteredStudentRows.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No students match your search
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2.5 w-8" />
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        Student
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">
                        Class
                      </th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        Attempts
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        {retakeRuleLabel}
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudentRows.map((row) => {
                      const isExpanded = expanded.has(row.student_id);
                      const best = row.best;
                      const latest = row.latest;
                      const pct =
                        best && best.max_score
                          ? Math.round((best.score! / best.max_score) * 100)
                          : null;
                      const scoreColor =
                        pct == null
                          ? ""
                          : pct >= 75
                            ? "text-emerald-700"
                            : pct >= 50
                              ? "text-amber-600"
                              : "text-red-600";

                      return [
                        <tr
                          key={`row-${row.student_id}`}
                          className="hover:bg-gray-50/80 cursor-pointer"
                          onClick={() => onToggleExpand(row.student_id)}
                        >
                          <td className="px-3 py-3 text-gray-400 text-xs">
                            {row.attempts.length > 1
                              ? isExpanded
                                ? "▾"
                                : "▸"
                              : ""}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={row.student_name}
                                color={tab === "course" ? "indigo" : "blue"}
                              />
                              <span className="font-medium text-gray-900">
                                {row.student_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell text-xs text-gray-500">
                            {[row.grade, row.section].filter(Boolean).join("-") ||
                              "—"}
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-gray-600">
                            {row.attempts.length > 1 && (
                              <RotateCcw className="h-3 w-3 text-amber-500 inline mr-1" />
                            )}
                            {row.attempts.length}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {best ? (
                              <span className={`text-sm font-semibold ${scoreColor}`}>
                                {best.score}/{best.max_score}
                                {pct != null && (
                                  <span className="text-xs font-normal text-gray-400 ml-1">
                                    ({pct}%)
                                  </span>
                                )}
                              </span>
                            ) : latest.status !== "graded" ? (
                              <span className="text-xs text-gray-400">Pending</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {best ? (
                              <span className="text-[11px] font-medium text-emerald-700">
                                Graded
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-amber-700">
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>,
                        ...(isExpanded
                          ? [
                              <tr
                                key={`exp-${row.student_id}`}
                                className="bg-gray-50/50"
                              >
                                <td colSpan={6} className="px-4 py-3">
                                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100 text-[11px] text-gray-400 uppercase tracking-wide">
                                          <th className="px-3 py-2 text-left font-semibold">
                                            Attempt
                                          </th>
                                          <th className="px-3 py-2 text-left font-semibold">
                                            Submitted
                                          </th>
                                          <th className="px-3 py-2 text-center font-semibold">
                                            Type
                                          </th>
                                          <th className="px-3 py-2 text-right font-semibold">
                                            Score
                                          </th>
                                          <th className="px-3 py-2 text-left font-semibold">
                                            Feedback
                                          </th>
                                          <th className="px-3 py-2 font-semibold">
                                            Action
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {row.attempts.map((att) => (
                                          <tr
                                            key={att.id}
                                            className={
                                              att.id === best?.id
                                                ? "bg-emerald-50/30"
                                                : ""
                                            }
                                          >
                                            <td className="px-3 py-2.5 font-medium text-gray-700">
                                              #{att.attempt_number}
                                            </td>
                                            <td className="px-3 py-2.5 text-gray-500 text-xs">
                                              {att.submitted_at
                                                ? new Date(
                                                    att.submitted_at,
                                                  ).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                  })
                                                : "—"}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-xs">
                                              {att.is_retake ? (
                                                <span className="text-amber-700 font-medium">
                                                  Retake
                                                </span>
                                              ) : (
                                                <span className="text-gray-400">
                                                  Initial
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-medium text-gray-700">
                                              {att.status === "graded"
                                                ? `${att.score}/${att.max_score}`
                                                : "—"}
                                              {att.id === best?.id && (
                                                <span className="ml-1.5 text-[10px] font-medium text-emerald-700">
                                                  {retakeRuleLabel}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[180px] truncate">
                                              {att.feedback ?? "—"}
                                            </td>
                                            <td className="px-3 py-2.5">
                                              {att.status !== "graded" ? (
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="number"
                                                    placeholder="Score"
                                                    className="w-20 h-9 px-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    value={
                                                      grading[att.id]?.score ??
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      onGradingChange(att.id, {
                                                        score: e.target.value,
                                                      })
                                                    }
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  />
                                                  <input
                                                    type="text"
                                                    placeholder="Feedback"
                                                    className="w-36 h-9 px-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    value={
                                                      grading[att.id]
                                                        ?.feedback ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      onGradingChange(att.id, {
                                                        feedback:
                                                          e.target.value,
                                                      })
                                                    }
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      onGrade(att.id);
                                                    }}
                                                    disabled={loading}
                                                    className="h-9 px-3 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                                                  >
                                                    Grade
                                                  </button>
                                                </div>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                                  <CheckCircle className="h-3.5 w-3.5" />{" "}
                                                  Graded
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>,
                            ]
                          : []),
                      ];
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Questions */}
        {detailTab === "questions" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm text-gray-500">
                {detailLoading
                  ? "Loading questions…"
                  : `${assignmentDetail?.questions?.length ?? 0} question${
                      (assignmentDetail?.questions?.length ?? 0) !== 1
                        ? "s"
                        : ""
                    }`}
                {assignmentDetail?.description && (
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {assignmentDetail.description}
                  </span>
                )}
                {tab === "daily" &&
                  !detailLoading &&
                  (selectedAssignment.is_published ||
                    (selectedAssignment.submission_count ?? 0) > 0 ||
                    (assignmentDetail?.submission_count ?? 0) > 0) && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                      <Lock className="h-3 w-3" />
                      Questions are locked
                      {(selectedAssignment.submission_count ??
                        assignmentDetail?.submission_count ??
                        0) > 0
                        ? " because students have submitted"
                        : " while published"}
                      .
                    </span>
                  )}
              </div>
              {tab === "daily" && (
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={loading || detailLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {detailLoading ? (
                <div className="text-center py-14 text-gray-400 text-sm">
                  Loading questions…
                </div>
              ) : !assignmentDetail?.questions?.length ? (
                <div className="text-center py-14 text-gray-400">
                  <p className="text-sm font-medium text-gray-500">
                    No questions yet
                  </p>
                  <p className="text-xs mt-1">
                    {tab === "daily"
                      ? "Edit this assignment to add questions."
                      : "This course assignment has no questions attached."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {assignmentDetail.questions.map((question, index) => {
                    const options = Array.isArray(question.options)
                      ? question.options
                      : [];
                    const answer = (question.correct_answer || "").trim();
                    return (
                      <div key={question.id || index} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900">
                              {question.question_text}
                            </p>
                            <p className="mt-0.5 mb-2 text-xs text-gray-500">
                              {question.question_type === "FillBlank"
                                ? "Fill in the blank"
                                : "Multiple choice"}
                              <span className="mx-1.5 text-gray-300">·</span>
                              {question.marks} mark
                              {question.marks !== 1 ? "s" : ""}
                            </p>
                            {question.question_type !== "FillBlank" &&
                              options.length > 0 && (
                                <div className="space-y-0.5">
                                  {options.map((option, optIndex) => {
                                    const isCorrect =
                                      option.trim().toLowerCase() ===
                                      answer.toLowerCase();
                                    return (
                                      <div
                                        key={optIndex}
                                        className={`text-xs ${
                                          isCorrect
                                            ? "font-medium text-green-700"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {String.fromCharCode(65 + optIndex)}.{" "}
                                        {option}
                                        {isCorrect && (
                                          <CheckSquare className="ml-1 inline h-3 w-3" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            {question.question_type === "FillBlank" && (
                              <p className="text-xs text-gray-500">
                                Answer:{" "}
                                <span className="font-medium text-green-700">
                                  {answer || "—"}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Retakes */}
        {detailTab === "retake" && (
          <div className="space-y-5">
            <div className="border border-gray-200 rounded-lg p-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Open retake for all
                  </h3>
                </div>
                <p className="text-xs text-gray-500 max-w-md">
                  Allow every student who has submitted to retake this
                  assignment.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenRetakeForAll}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Open window
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">
                  Grant to a student
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Grant an individual retake to anyone who already submitted.
                </p>
              </div>

              {studentRows.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-gray-400">
                  No submissions yet — students must submit before you can grant
                  a retake.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        placeholder="Search by name, grade or section…"
                        value={grantSearch}
                        onChange={(e) => onGrantSearchChange(e.target.value)}
                        className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
                      />
                    </div>
                    <FilterChips
                      value={grantFilter}
                      onChange={onGrantFilterChange}
                      counts={filterCounts}
                    />
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100 text-[11px] text-gray-400 uppercase tracking-wide">
                        <th className="px-4 py-2.5 text-left font-semibold">
                          Student
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold hidden sm:table-cell">
                          Class
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold">
                          Attempts
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold">
                          {retakeRuleLabel}
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold">
                          Access
                        </th>
                        <th className="px-4 py-2.5 text-right font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredGrantRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-10 text-center text-xs text-gray-400"
                          >
                            No students match your search
                          </td>
                        </tr>
                      ) : null}
                      {filteredGrantRows.map((row) => {
                        const isGranting =
                          grantingStudentId === row.student_id;
                        const pct =
                          row.best && row.best.max_score
                            ? Math.round(
                                (row.best.score! / row.best.max_score) * 100,
                              )
                            : null;
                        const scoreColor =
                          pct == null
                            ? "text-gray-400"
                            : pct >= 75
                              ? "text-emerald-600"
                              : pct >= 50
                                ? "text-amber-600"
                                : "text-red-600";

                        return (
                          <tr
                            key={row.student_id}
                            className="hover:bg-gray-50/60"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={row.student_name} />
                                <span className="font-medium text-gray-900">
                                  {row.student_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-500 hidden sm:table-cell">
                              {[row.grade, row.section]
                                .filter(Boolean)
                                .join("-") || "—"}
                            </td>
                            <td className="px-3 py-3 text-center text-xs text-gray-600">
                              {row.attempts.length}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {row.best ? (
                                <span
                                  className={`text-sm font-semibold ${scoreColor}`}
                                >
                                  {row.best.score}/{row.best.max_score}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-600">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {row.retake_granted ? (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                    Granted
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    ×{row.retake_grant_count || 1}
                                  </span>
                                </div>
                              ) : row.retake_grant_count > 0 ? (
                                <span className="text-[11px] text-gray-400">
                                  Revoked (×{row.retake_grant_count})
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {row.retake_granted ? (
                                <button
                                  type="button"
                                  onClick={() => onRevokeRetake(row.student_id)}
                                  disabled={loading || isGranting}
                                  className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                                >
                                  {isGranting ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 animate-spin" />{" "}
                                      Updating…
                                    </>
                                  ) : (
                                    "Revoke"
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onGrantRetake(row.student_id)}
                                  disabled={loading || isGranting}
                                  className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                                >
                                  {isGranting ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 animate-spin" />{" "}
                                      Granting…
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="h-3 w-3" /> Grant
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
