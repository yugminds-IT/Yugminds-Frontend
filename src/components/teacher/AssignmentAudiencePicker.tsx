"use client";

import { useMemo } from "react";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { Globe, GraduationCap } from "lucide-react";

export interface TeacherClass {
  grade_id: string;
  grade: string;
  section_id: string;
  section: string;
  school_id?: string;
  school_name?: string;
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
  /** The teacher's own classes for the selected school(s) (from GET /teacher/classes). */
  classes: TeacherClass[];
  /** When true, publish to every selected school (all grades & sections). */
  entireSchool: boolean;
  onChangeEntireSchool: (value: boolean) => void;
  /** Selected grades; empty sectionIds means all sections in that grade. */
  targets: GradeAudienceTarget[];
  onChangeTargets: (targets: GradeAudienceTarget[]) => void;
  /** School IDs currently selected on the Details step (for multi-school labels). */
  selectedSchoolIds?: string[];
  /** Optional school id → name map for empty school groups. */
  schoolNames?: Record<string, string>;
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

/** Filter targets to those that belong to the given school's classes. */
export function targetsForSchool(
  targets: GradeAudienceTarget[],
  schoolClasses: TeacherClass[],
): GradeAudienceTarget[] {
  const gradeIds = new Set(schoolClasses.map((c) => c.grade_id));
  return targets.filter((t) => gradeIds.has(t.gradeId));
}

/**
 * Schools among `schoolIds` that still need an audience when Entire school is off.
 * A school is covered when at least one selected grade belongs to it.
 * Schools with no classes still require Entire school (cannot pick grades).
 */
export function schoolsMissingAudience(
  schoolIds: string[],
  entireSchool: boolean,
  targets: GradeAudienceTarget[],
  classes: TeacherClass[],
): string[] {
  if (entireSchool) return [];
  if (schoolIds.length === 0) return [];

  const hasSchoolMeta = classes.some((c) => c.school_id);
  if (!hasSchoolMeta) {
    return targets.length === 0 ? schoolIds : [];
  }

  return schoolIds.filter((sid) => {
    const schoolClasses = classes.filter((c) => c.school_id === sid);
    if (schoolClasses.length === 0) return true;
    return targetsForSchool(targets, schoolClasses).length === 0;
  });
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

type SchoolGroup = {
  id: string;
  name: string;
  grades: Array<{ id: string; name: string }>;
  sectionsByGrade: Map<string, Array<{ id: string; name: string }>>;
};

/** Normalize API rows so section_id/grade_id are always present (id is the section). */
function normalizeClass(c: TeacherClass & Record<string, unknown>): TeacherClass | null {
  const gradeId = String(c.grade_id ?? c.gradeId ?? "").trim();
  const sectionId = String(c.section_id ?? c.sectionId ?? c.id ?? "").trim();
  const grade = String(c.grade ?? "").trim();
  if (!gradeId || !sectionId) return null;
  const sectionRaw = c.section;
  const section =
    typeof sectionRaw === "string"
      ? sectionRaw.trim()
      : String(
          (sectionRaw as { name?: string } | null | undefined)?.name ?? "",
        ).trim();
  return {
    grade_id: gradeId,
    grade: grade || "Grade",
    section_id: sectionId,
    section: section || "Section",
    school_id: c.school_id ? String(c.school_id) : undefined,
    school_name: c.school_name ? String(c.school_name) : undefined,
  };
}

function buildSchoolGroups(
  classes: TeacherClass[],
  selectedSchoolIds?: string[],
  schoolNameById?: Map<string, string>,
): SchoolGroup[] {
  const normalized = classes
    .map((c) => normalizeClass(c as TeacherClass & Record<string, unknown>))
    .filter((c): c is TeacherClass => c !== null);

  const bySchool = new Map<string, TeacherClass[]>();
  for (const c of normalized) {
    const sid = c.school_id || "_default";
    if (!bySchool.has(sid)) bySchool.set(sid, []);
    bySchool.get(sid)!.push(c);
  }

  // Keep selected schools visible even when they have no class rows yet.
  for (const sid of selectedSchoolIds ?? []) {
    if (sid && !bySchool.has(sid)) bySchool.set(sid, []);
  }

  const orderedIds = [
    ...(selectedSchoolIds ?? []).filter((id) => bySchool.has(id)),
    ...[...bySchool.keys()].filter((id) => !(selectedSchoolIds ?? []).includes(id)),
  ];

  return orderedIds.map((id) => {
    const schoolClasses = bySchool.get(id) ?? [];
    const name =
      schoolClasses.find((c) => c.school_name)?.school_name ||
      schoolNameById?.get(id) ||
      (id === "_default" ? "School" : id);
    const gradesMap = new Map<string, string>();
    const sectionsByGrade = new Map<string, Array<{ id: string; name: string }>>();
    for (const c of schoolClasses) {
      if (!gradesMap.has(c.grade_id)) gradesMap.set(c.grade_id, c.grade);
      if (!sectionsByGrade.has(c.grade_id)) sectionsByGrade.set(c.grade_id, []);
      const list = sectionsByGrade.get(c.grade_id)!;
      if (!list.some((s) => s.id === c.section_id)) {
        list.push({ id: c.section_id, name: c.section });
      }
    }
    return {
      id,
      name,
      grades: [...gradesMap.entries()].map(([gid, gname]) => ({ id: gid, name: gname })),
      sectionsByGrade,
    };
  });
}

/**
 * Grade → section picker for a daily assignment's audience.
 *
 * Semantics:
 *  - Entire school(s) checked → whole school for every selected school
 *  - A grade with no sections picked → whole grade
 *  - A grade with sections picked → only those sections
 *  - Multi-school: grades are grouped under each school
 *  - Sections are always listed under each grade (no hidden accordion)
 */
export function AssignmentAudiencePicker({
  classes,
  entireSchool,
  onChangeEntireSchool,
  targets,
  onChangeTargets,
  selectedSchoolIds,
  schoolNames,
}: AssignmentAudiencePickerProps) {
  const schoolNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (schoolNames) {
      for (const [id, name] of Object.entries(schoolNames)) map.set(id, name);
    }
    return map;
  }, [schoolNames]);

  const schoolGroups = useMemo(
    () => buildSchoolGroups(classes, selectedSchoolIds, schoolNameById),
    [classes, selectedSchoolIds, schoolNameById],
  );
  const multiSchool = (selectedSchoolIds?.length ?? schoolGroups.length) > 1;

  const targetByGrade = useMemo(() => {
    const map = new Map<string, GradeAudienceTarget>();
    for (const t of targets) map.set(t.gradeId, t);
    return map;
  }, [targets]);

  const setEntireSchool = (value: boolean) => {
    onChangeEntireSchool(value);
  };

  const toggleGrade = (gradeId: string) => {
    if (entireSchool) onChangeEntireSchool(false);
    if (targetByGrade.has(gradeId)) {
      onChangeTargets(targets.filter((t) => t.gradeId !== gradeId));
      return;
    }
    // Empty sectionIds = whole grade (every section listed under it).
    onChangeTargets([...targets, { gradeId, sectionIds: [] }]);
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

  const toggleSection = (
    gradeId: string,
    sectionId: string,
    sections: Array<{ id: string; name: string }>,
  ) => {
    const existing = targetByGrade.get(gradeId);
    const current = existing?.sectionIds ?? [];
    // Empty sectionIds means "all sections". First section click leaves only that section.
    const effective =
      existing && current.length === 0
        ? sections.map((s) => s.id).filter((id) => id !== sectionId)
        : current.includes(sectionId)
          ? current.filter((id) => id !== sectionId)
          : [...current, sectionId];

    // Clearing all sections drops the grade. Selecting every section = whole grade.
    if (effective.length === 0) {
      onChangeTargets(targets.filter((t) => t.gradeId !== gradeId));
      return;
    }
    if (effective.length === sections.length) {
      setGradeSections(gradeId, []);
      return;
    }
    setGradeSections(gradeId, effective);
  };

  const hasAnyGrades = schoolGroups.some((g) => g.grades.length > 0);

  if (!hasAnyGrades && classes.length === 0) {
    const schoolCount = selectedSchoolIds?.length ?? 0;
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer rounded-md border border-blue-100 bg-white px-2.5 py-2 hover:bg-blue-50/50">
          <Checkbox
            checked={entireSchool}
            onCheckedChange={(checked) => setEntireSchool(checked === true)}
            aria-label={
              schoolCount > 1 ? "Entire selected schools" : "Entire school"
            }
          />
          <Globe className="h-3.5 w-3.5 text-blue-500" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-800">
              {schoolCount > 1 ? "Entire selected schools" : "Entire school"}
            </span>
            <p className="text-[11px] text-gray-500 leading-tight">
              You have no assigned classes yet — publish to the whole school(s).
            </p>
          </div>
        </label>
      </div>
    );
  }

  const entireLabel = multiSchool ? "Entire selected schools" : "Entire school";
  const entireHint = multiSchool
    ? `All grades and sections you teach at ${schoolGroups.map((g) => g.name).join(" and ")}`
    : "All grades and sections you teach at this school";

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer rounded-md border border-blue-100 bg-white px-2.5 py-2 hover:bg-blue-50/50">
        <Checkbox
          checked={entireSchool}
          onCheckedChange={(checked) => setEntireSchool(checked === true)}
          aria-label={entireLabel}
        />
        <Globe className="h-3.5 w-3.5 text-blue-500" />
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-800">{entireLabel}</span>
          <p className="text-[11px] text-gray-500 leading-tight">{entireHint}</p>
        </div>
      </label>

      {!entireSchool && (
        <>
          <p className="text-xs text-gray-500 pt-1">
            Or pick grades
            {multiSchool ? " under each school" : ""} — check a grade for all
            its sections, or choose only the sections you need.
          </p>
          {targets.length === 0 && (
            <p className="text-xs text-amber-600">
              No grades selected yet. Turn on{" "}
              {multiSchool ? "Entire selected schools" : "Entire school"}, or
              select at least one grade / section per school.
            </p>
          )}
          <div className="max-h-80 overflow-y-auto space-y-4 pr-1">
            {schoolGroups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                {multiSchool && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-0.5">
                    {group.name}
                  </p>
                )}
                {group.grades.length === 0 ? (
                  <p className="text-xs text-gray-500 px-0.5 py-1">
                    No assigned classes at this school. Use Entire selected
                    schools, or pick another school.
                  </p>
                ) : (
                  group.grades.map((g) => {
                    const sections = group.sectionsByGrade.get(g.id) ?? [];
                    const target = targetByGrade.get(g.id);
                    const gradeSelected = !!target;
                    const chosenSections = target?.sectionIds ?? [];
                    const allSections =
                      gradeSelected && chosenSections.length === 0;
                    const gradeKey = `${group.id}:${g.id}`;
                    return (
                      <div
                        key={gradeKey}
                        className={`rounded-md border ${gradeSelected ? "border-blue-200 bg-white" : "border-gray-100 bg-white"}`}
                      >
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <Checkbox
                            checked={gradeSelected}
                            onCheckedChange={() => toggleGrade(g.id)}
                            aria-label={`Select ${formatGradeLabel(g.name)}`}
                          />
                          <GraduationCap className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-sm flex-1 min-w-0">
                            {formatGradeLabel(g.name)}
                          </span>
                          {gradeSelected && (
                            <span className="text-xs text-blue-600 font-medium shrink-0">
                              {allSections
                                ? sections.length === 1
                                  ? "1 section"
                                  : `All ${sections.length} sections`
                                : `${chosenSections.length} section${chosenSections.length === 1 ? "" : "s"}`}
                            </span>
                          )}
                        </div>

                        {sections.length > 0 && (
                          <div className="border-t border-gray-50 px-3 pb-2 pt-1.5 space-y-1.5">
                            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                              {sections.map((s) => {
                                const sectionChecked =
                                  gradeSelected &&
                                  (allSections ||
                                    chosenSections.includes(s.id));
                                return (
                                  <label
                                    key={`${gradeKey}:${s.id}`}
                                    className="flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={sectionChecked}
                                      onCheckedChange={() =>
                                        toggleSection(g.id, s.id, sections)
                                      }
                                      aria-label={`Select section ${s.name}`}
                                    />
                                    <span className="text-xs text-gray-700">
                                      {s.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ))}
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
