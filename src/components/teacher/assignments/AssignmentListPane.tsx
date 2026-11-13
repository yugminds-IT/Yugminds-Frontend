"use client";

import { Plus } from "lucide-react";
import type { TeacherClass } from "@/components/teacher/AssignmentAudiencePicker";
import { StatusPill, audienceChipLabel, stageOf, type TeacherAssignment } from "./assignments-shared";

type Props = {
  tab: "daily" | "course" | "exam";
  assignments: TeacherAssignment[];
  filteredAssignments: TeacherAssignment[];
  selectedId: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  teacherClasses: TeacherClass[];
  now: number;
  /** a stage filter is on, so an empty list may just mean nothing is in that stage */
  filtered: boolean;
  onClearFilter: () => void;
};

/** Your assignments, newest first as the server returns them. Pick one to open it on the right. */
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
  now,
  filtered,
  onClearFilter,
}: Props) {
  return (
    <div className="sd-panel tg-listpane">
      <div className="tg-list-head">
        <input type="search" className="sd-field" placeholder={`Search ${tab} assignments`} aria-label={`Search ${tab} assignments`} value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
      </div>

      <div className="tg-list-scroll">
        {filteredAssignments.length === 0 ? (
          <div className="sd-empty" style={{ padding: "1.25rem 1rem" }}>
            <b>{searchQuery || filtered ? "No matches" : `No ${tab === "exam" ? "exams" : `${tab} assignments`} yet`}</b>
            <p>{searchQuery ? "Try a different search." : filtered ? "Nothing is in that stage." : tab !== "course" ? "Create one and it shows up here." : "Course assignments are set up by your admin."}</p>
            {filtered ? (
              <button className="sd-btn sd-btn--line" onClick={onClearFilter}>Show all</button>
            ) : !searchQuery && tab !== "course" && onCreate ? (
              <button className="sd-btn sd-btn--amber" onClick={onCreate}><Plus aria-hidden="true" />New assignment</button>
            ) : null}
          </div>
        ) : (
          filteredAssignments.map((a) => {
            const stage = stageOf(a, now);
            const due = a.due_date ? new Date(a.due_date) : null;
            const meta = [a.subject, audienceChipLabel(a, teacherClasses)].filter(Boolean).join(" · ");
            return (
              <button key={a.id} type="button" className="tg-item" aria-current={a.id === selectedId} onClick={() => onSelect(a.id === selectedId ? "" : a.id)}>
                <b>{a.title}</b>
                {meta && <small>{meta}</small>}
                <span className="tg-item-row">
                  <StatusPill stage={stage} />
                  {due && <span className={stage === "past" ? "tg-late" : undefined}>{stage === "past" ? "Past due" : `Due ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}</span>}
                  <span>{a.submission_count ?? 0} submitted</span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="tg-list-foot">
        {filteredAssignments.length} of {assignments.length} {assignments.length === 1 ? "assignment" : "assignments"}
      </div>
    </div>
  );
}
