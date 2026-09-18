"use client";

import { Search, Clock, Plus } from "lucide-react";
import type { TeacherClass } from "@/components/teacher/AssignmentAudiencePicker";
import {
  StatusPill,
  audienceChipLabel,
  type TeacherAssignment,
} from "./assignments-shared";

type Props = {
  tab: "daily" | "course";
  assignments: TeacherAssignment[];
  filteredAssignments: TeacherAssignment[];
  selectedId: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  teacherClasses: TeacherClass[];
  stats: { published: number; drafts: number; totalSubs: number };
};

export default function AssignmentListPane({
  tab,
  assignments,
  filteredAssignments,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelect,
  onCreate,
  teacherClasses,
  stats,
}: Props) {
  return (
    <div className="w-full lg:w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden h-full">
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${tab}…`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder-gray-400"
          />
        </div>
        <p className="text-[11px] text-gray-400 px-0.5">
          {stats.published} live · {stats.drafts} draft
          {stats.drafts !== 1 ? "s" : ""} · {stats.totalSubs} submission
          {stats.totalSubs !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16">
            <p className="text-sm font-medium text-gray-600 mb-1">
              {searchQuery ? "No matches" : `No ${tab} assignments`}
            </p>
            <p className="text-xs text-gray-400 max-w-[14rem]">
              {searchQuery
                ? "Try a different search"
                : tab === "daily"
                  ? "Create an assignment to get started"
                  : "Course assignments are created by admins"}
            </p>
            {!searchQuery && tab === "daily" && onCreate && (
              <button
                type="button"
                onClick={onCreate}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Create assignment
              </button>
            )}
          </div>
        ) : (
          <ul className="py-1">
            {filteredAssignments.map((a) => {
              const isSelected = a.id === selectedId;
              const dueDate = a.due_date ? new Date(a.due_date) : null;
              const overdue = !!(dueDate && dueDate < new Date());
              const audience = audienceChipLabel(a, teacherClasses);
              const meta = [a.subject, audience].filter(Boolean).join(" · ");

              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(a.id === selectedId ? "" : a.id)}
                    className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${
                      isSelected
                        ? "bg-blue-50/80 border-l-blue-600"
                        : "border-l-transparent hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 leading-snug truncate">
                        {a.title}
                      </p>
                      <StatusPill published={a.is_published} />
                    </div>
                    {meta && (
                      <p className="text-xs text-gray-500 truncate mb-1.5">{meta}</p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      {dueDate && (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            overdue ? "text-red-600" : ""
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {overdue
                            ? "Overdue"
                            : dueDate.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                        </span>
                      )}
                      <span className="text-gray-300">·</span>
                      <span>{a.submission_count ?? 0} submitted</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100">
        <p className="text-[11px] text-gray-400">
          {filteredAssignments.length} of {assignments.length} assignment
          {assignments.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
