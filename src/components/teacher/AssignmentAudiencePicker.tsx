"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { ChevronDown, ChevronRight, GraduationCap } from "lucide-react";

export interface TeacherClass {
  grade_id: string;
  grade: string;
  section_id: string;
  section: string;
}

interface AssignmentAudiencePickerProps {
  /** The teacher's own classes for the selected school (from GET /teacher/classes) — a teacher can only target grades/sections they actually teach. */
  classes: TeacherClass[];
  /** "grade": target whole grade(s) or, if none picked, the whole school. "section": target specific section(s) only — at least one is required. */
  scope: "grade" | "section";
  gradeIds: string[];
  sectionIds: string[];
  onChangeGradeIds: (ids: string[]) => void;
  onChangeSectionIds: (ids: string[]) => void;
}

/**
 * Grade → section picker for a daily assignment's audience, mirroring the
 * admin CoursePublishTargets semantics but scoped to one school and keyed
 * by real grade/section IDs (matching Assignment.publishedGradeIds /
 * publishedSectionIds, not names) — and constrained to the sections the
 * teacher is actually assigned to teach (TeacherSectionAssignment), so a
 * teacher can't target a class they don't have.
 */
export function AssignmentAudiencePicker({
  classes,
  scope,
  gradeIds,
  sectionIds,
  onChangeGradeIds,
  onChangeSectionIds,
}: AssignmentAudiencePickerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grades = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) if (!map.has(c.grade_id)) map.set(c.grade_id, c.grade);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [classes]);

  const sectionsByGrade = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>();
    for (const c of classes) {
      if (!map.has(c.grade_id)) map.set(c.grade_id, []);
      map.get(c.grade_id)!.push({ id: c.section_id, name: c.section });
    }
    return map;
  }, [classes]);

  const toggleExpanded = (gradeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(gradeId)) next.delete(gradeId);
      else next.add(gradeId);
      return next;
    });
  };

  const toggleGrade = (gradeId: string) => {
    onChangeGradeIds(
      gradeIds.includes(gradeId)
        ? gradeIds.filter((id) => id !== gradeId)
        : [...gradeIds, gradeId],
    );
  };

  const toggleSection = (sectionId: string) => {
    onChangeSectionIds(
      sectionIds.includes(sectionId)
        ? sectionIds.filter((id) => id !== sectionId)
        : [...sectionIds, sectionId],
    );
  };

  if (grades.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-1">
        You have no assigned classes at this school yet.
      </p>
    );
  }

  if (scope === "grade") {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-gray-500">
          Leave all grades unchecked to publish to the <strong>whole school</strong>.
        </p>
        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
          {grades.map((g) => (
            <label
              key={g.id}
              className="flex items-center gap-2 cursor-pointer rounded-md border border-gray-100 px-2 py-1.5 hover:bg-gray-50"
            >
              <Checkbox
                checked={gradeIds.includes(g.id)}
                onCheckedChange={() => toggleGrade(g.id)}
                aria-label={`Select Grade ${g.name}`}
              />
              <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm">Grade {g.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  // scope === "section": at least one section must be picked, or the
  // backend resolves the assignment as visible to nobody.
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-amber-600">
        Select at least one section — a section-scoped assignment with none
        selected won&apos;t be visible to any student.
      </p>
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {grades.map((g) => {
          const sections = sectionsByGrade.get(g.id) ?? [];
          const isOpen = expanded.has(g.id);
          const chosenCount = sections.filter((s) => sectionIds.includes(s.id)).length;
          return (
            <div key={g.id} className="rounded-md border border-gray-100">
              <button
                type="button"
                onClick={() => toggleExpanded(g.id)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                )}
                <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-sm">Grade {g.name}</span>
                {chosenCount > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    {chosenCount} selected
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-2 pt-1 border-t border-gray-50">
                  {sections.map((s) => (
                    <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={sectionIds.includes(s.id)}
                        onCheckedChange={() => toggleSection(s.id)}
                        aria-label={`Select section ${s.name}`}
                      />
                      <span className="text-xs">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {sectionIds.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onChangeSectionIds([])}
        >
          Clear selection
        </Button>
      )}
    </div>
  );
}
