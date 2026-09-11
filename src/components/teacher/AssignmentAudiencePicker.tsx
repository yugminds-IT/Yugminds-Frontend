"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { ChevronDown, ChevronRight, Globe, GraduationCap } from "lucide-react";

export interface TeacherClass {
  grade_id: string;
  grade: string;
  section_id: string;
  section: string;
}

/** One grade grant: empty `sectionIds` = the whole grade (every section the teacher teaches). */
export interface GradeAudienceTarget {
  gradeId: string;
  sectionIds: string[];
}

export interface ResolvedAudience {
  publishScope: "grade" | "section";
  publishedGradeIds: string[];
  publishedSectionIds: string[];
  /** Legacy singular field when exactly one whole grade is targeted. */
  gradeId?: string;
}

interface AssignmentAudiencePickerProps {
  /** The teacher's own classes for the selected school (from GET /teacher/classes). */
  classes: TeacherClass[];
  /** When true, publish to the entire school (all grades & sections). */
  entireSchool: boolean;
  onChangeEntireSchool: (value: boolean) => void;
  /** Selected grades; empty sectionIds means all sections in that grade. */
  targets: GradeAudienceTarget[];
  onChangeTargets: (targets: GradeAudienceTarget[]) => void;
}

function formatGradeLabel(name: string): string {
  const trimmed = name.trim();
  if (/^grade\s+/i.test(trimmed)) return trimmed;
  return `Grade ${trimmed}`;
}

/**
 * Resolve picker state into the Assignment API audience fields.
 *
 * - Entire school → publishScope "grade", empty ID lists
 * - Whole grades only → publishScope "grade" + publishedGradeIds
 * - Any section-level picks → publishScope "section"; whole grades expand to all section IDs
 */
export function resolveAudiencePayload(
  entireSchool: boolean,
  targets: GradeAudienceTarget[],
  classes: TeacherClass[],
): ResolvedAudience {
  if (entireSchool || targets.length === 0) {
    return {
      publishScope: "grade",
      publishedGradeIds: [],
      publishedSectionIds: [],
    };
  }

  const hasSectionSubset = targets.some((t) => t.sectionIds.length > 0);
  if (!hasSectionSubset) {
    const gradeIds = targets.map((t) => t.gradeId);
    return {
      publishScope: "grade",
      publishedGradeIds: gradeIds,
      publishedSectionIds: [],
      gradeId: gradeIds.length === 1 ? gradeIds[0] : undefined,
    };
  }

  const sectionIds: string[] = [];
  for (const t of targets) {
    if (t.sectionIds.length > 0) {
      sectionIds.push(...t.sectionIds);
    } else {
      for (const c of classes) {
        if (c.grade_id === t.gradeId) sectionIds.push(c.section_id);
      }
    }
  }

  return {
    publishScope: "section",
    publishedGradeIds: [],
    publishedSectionIds: [...new Set(sectionIds)],
  };
}

/** Reconstruct picker state from a saved Assignment audience. */
export function audienceFromAssignment(
  assignment: {
    publish_scope?: string | null;
    published_grade_ids?: string[] | null;
    published_section_ids?: string[] | null;
  },
  classes: TeacherClass[],
): { entireSchool: boolean; gradeTargets: GradeAudienceTarget[] } {
  const scope = assignment.publish_scope ?? "grade";
  const gradeIds = assignment.published_grade_ids ?? [];
  const sectionIds = assignment.published_section_ids ?? [];

  if (scope === "grade" && gradeIds.length === 0) {
    return { entireSchool: true, gradeTargets: [] };
  }

  if (scope === "grade") {
    return {
      entireSchool: false,
      gradeTargets: gradeIds.map((gradeId) => ({ gradeId, sectionIds: [] })),
    };
  }

  const byGrade = new Map<string, string[]>();
  for (const sectionId of sectionIds) {
    const cls = classes.find((c) => c.section_id === sectionId);
    if (!cls) continue;
    const list = byGrade.get(cls.grade_id) ?? [];
    list.push(sectionId);
    byGrade.set(cls.grade_id, list);
  }

  const gradeTargets: GradeAudienceTarget[] = [];
  for (const [gradeId, ids] of byGrade) {
    const allSectionIds = classes
      .filter((c) => c.grade_id === gradeId)
      .map((c) => c.section_id);
    const isAll =
      allSectionIds.length > 0 &&
      allSectionIds.every((id) => ids.includes(id)) &&
      ids.length === allSectionIds.length;
    gradeTargets.push({ gradeId, sectionIds: isAll ? [] : ids });
  }

  return { entireSchool: false, gradeTargets };
}

/**
 * Grade → section picker for a daily assignment's audience.
 *
 * Semantics:
 *  - Entire school checked → whole school
 *  - A grade with no sections picked → whole grade
 *  - A grade with sections picked → only those sections
 */
export function AssignmentAudiencePicker({
  classes,
  entireSchool,
  onChangeEntireSchool,
  targets,
  onChangeTargets,
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

  const targetByGrade = useMemo(() => {
    const map = new Map<string, GradeAudienceTarget>();
    for (const t of targets) map.set(t.gradeId, t);
    return map;
  }, [targets]);

  const toggleExpanded = (gradeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(gradeId)) next.delete(gradeId);
      else next.add(gradeId);
      return next;
    });
  };

  const setEntireSchool = (value: boolean) => {
    onChangeEntireSchool(value);
  };

  const toggleGrade = (gradeId: string) => {
    if (entireSchool) onChangeEntireSchool(false);
    if (targetByGrade.has(gradeId)) {
      onChangeTargets(targets.filter((t) => t.gradeId !== gradeId));
      return;
    }
    onChangeTargets([...targets, { gradeId, sectionIds: [] }]);
    setExpanded((prev) => new Set(prev).add(gradeId));
  };

  const setGradeSections = (gradeId: string, sectionIds: string[]) => {
    if (entireSchool) onChangeEntireSchool(false);
    const existing = targetByGrade.get(gradeId);
    if (!existing) {
      onChangeTargets([...targets, { gradeId, sectionIds }]);
      return;
    }
    onChangeTargets(
      targets.map((t) => (t.gradeId === gradeId ? { ...t, sectionIds } : t)),
    );
  };

  const toggleSection = (gradeId: string, sectionId: string) => {
    const existing = targetByGrade.get(gradeId);
    const sections = sectionsByGrade.get(gradeId) ?? [];
    const current = existing?.sectionIds ?? [];
    // Empty sectionIds means "all sections". First section click leaves only that section.
    const effective =
      existing && current.length === 0
        ? sections.map((s) => s.id).filter((id) => id !== sectionId)
        : current.includes(sectionId)
          ? current.filter((id) => id !== sectionId)
          : [...current, sectionId];

    // Selecting every section (or clearing all) collapses back to "whole grade".
    if (effective.length === 0 || effective.length === sections.length) {
      setGradeSections(gradeId, []);
      return;
    }
    setGradeSections(gradeId, effective);
  };

  if (grades.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-1">
        You have no assigned classes at this school yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer rounded-md border border-blue-100 bg-white px-2.5 py-2 hover:bg-blue-50/50">
        <Checkbox
          checked={entireSchool}
          onCheckedChange={(checked) => setEntireSchool(checked === true)}
          aria-label="Select entire school"
        />
        <Globe className="h-3.5 w-3.5 text-blue-500" />
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-800">Entire school</span>
          <p className="text-[11px] text-gray-500 leading-tight">
            All grades and sections you teach at this school
          </p>
        </div>
      </label>

      {!entireSchool && (
        <>
          <p className="text-xs text-gray-500 pt-1">
            Or pick grades — leave sections unchecked for the whole grade, or choose only the sections you need.
          </p>
          {targets.length === 0 && (
            <p className="text-xs text-amber-600">
              No grades selected yet. Turn on Entire school, or select at least one grade.
            </p>
          )}
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {grades.map((g) => {
              const sections = sectionsByGrade.get(g.id) ?? [];
              const target = targetByGrade.get(g.id);
              const gradeSelected = !!target;
              const isOpen = expanded.has(g.id);
              const chosenSections = target?.sectionIds ?? [];
              const allSections = gradeSelected && chosenSections.length === 0;
              return (
                <div
                  key={g.id}
                  className={`rounded-md border ${gradeSelected ? "border-blue-200 bg-white" : "border-gray-100 bg-white"}`}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Checkbox
                      checked={gradeSelected}
                      onCheckedChange={() => toggleGrade(g.id)}
                      aria-label={`Select ${formatGradeLabel(g.name)}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!gradeSelected) toggleGrade(g.id);
                        else toggleExpanded(g.id);
                      }}
                      className="flex flex-1 items-center gap-2 text-left min-w-0"
                    >
                      <GraduationCap className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm">{formatGradeLabel(g.name)}</span>
                      {gradeSelected && (
                        <span className="text-xs text-blue-600 font-medium shrink-0">
                          {allSections
                            ? "All sections"
                            : `${chosenSections.length} section${chosenSections.length === 1 ? "" : "s"}`}
                        </span>
                      )}
                    </button>
                    {gradeSelected && sections.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(g.id)}
                        className="text-gray-400 hover:text-gray-600 p-0.5"
                        aria-label="Toggle sections"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {gradeSelected && isOpen && sections.length > 0 && (
                    <div className="border-t border-gray-50 px-3 pb-2 pt-1.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={allSections ? "default" : "outline"}
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setGradeSections(g.id, [])}
                        >
                          All sections
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {sections.map((s) => (
                          <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={allSections || chosenSections.includes(s.id)}
                              onCheckedChange={() => toggleSection(g.id, s.id)}
                              aria-label={`Select section ${s.name}`}
                            />
                            <span className="text-xs">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {targets.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onChangeTargets([])}
            >
              Clear selection
            </Button>
          )}
        </>
      )}
    </div>
  );
}
