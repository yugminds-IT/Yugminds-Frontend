"use client";

import { useMemo, useState } from "react";
import { useAdminSchools } from "../../hooks/useAdminSchools";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronDown, ChevronRight, School, Search } from "lucide-react";
import { Input } from "../ui/input";

/** One grade grant: empty `sections` = the whole grade (every section). */
export interface GradeTarget {
  grade: string; // grade name, matches StudentSchool.grade
  sections: string[]; // section names, matches StudentSchool.section
}

/** Targeting for one school. No grades = the whole school. */
export interface SchoolTarget {
  school_id: string;
  grades: GradeTarget[];
}

interface CoursePublishTargetsProps {
  value: SchoolTarget[];
  onChange: (targets: SchoolTarget[]) => void;
}

/**
 * Per-school → per-grade → per-section picker for course distribution.
 *
 * Semantics (match the backend enrollment rules):
 *  - a school with no grades selected  → the whole school
 *  - a grade with no sections selected → the whole grade (every section)
 *  - a grade with sections selected    → only those sections
 *
 * Grades and sections come from each school's real academic structure
 * (`useAdminSchools()` → `grades[].sections[]`), so this is per-school rather
 * than one flat grade list applied to every school.
 */
export function CoursePublishTargets({ value, onChange }: CoursePublishTargetsProps) {
  const { schools: rawSchools, isLoading } = useAdminSchools();
  const schools = useMemo(
    () => (rawSchools ?? []).filter((s) => s.is_active !== false),
    [rawSchools],
  );
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filteredSchools = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.schoolCode ?? "").toLowerCase().includes(term),
    );
  }, [schools, search]);

  const targetBySchool = useMemo(() => {
    const map = new Map<string, SchoolTarget>();
    for (const t of value) map.set(t.school_id, t);
    return map;
  }, [value]);

  const setSchoolTarget = (schoolId: string, next: SchoolTarget | null) => {
    const others = value.filter((t) => t.school_id !== schoolId);
    onChange(next ? [...others, next] : others);
  };

  const toggleSchool = (schoolId: string) => {
    if (targetBySchool.has(schoolId)) {
      setSchoolTarget(schoolId, null);
    } else {
      setSchoolTarget(schoolId, { school_id: schoolId, grades: [] });
      setExpanded((prev) => new Set(prev).add(schoolId));
    }
  };

  const toggleExpanded = (schoolId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  };

  const isGradeSelected = (schoolId: string, gradeName: string) =>
    !!targetBySchool.get(schoolId)?.grades.some((g) => g.grade === gradeName);

  const toggleGrade = (schoolId: string, gradeName: string) => {
    const target = targetBySchool.get(schoolId) ?? { school_id: schoolId, grades: [] };
    const has = target.grades.some((g) => g.grade === gradeName);
    const grades = has
      ? target.grades.filter((g) => g.grade !== gradeName)
      : [...target.grades, { grade: gradeName, sections: [] }];
    setSchoolTarget(schoolId, { school_id: schoolId, grades });
  };

  const getGradeSections = (schoolId: string, gradeName: string): string[] =>
    targetBySchool.get(schoolId)?.grades.find((g) => g.grade === gradeName)?.sections ?? [];

  const setGradeSections = (schoolId: string, gradeName: string, sections: string[]) => {
    const target = targetBySchool.get(schoolId) ?? { school_id: schoolId, grades: [] };
    const grades = target.grades.map((g) =>
      g.grade === gradeName ? { ...g, sections } : g,
    );
    setSchoolTarget(schoolId, { school_id: schoolId, grades });
  };

  const toggleSection = (schoolId: string, gradeName: string, sectionName: string) => {
    const current = getGradeSections(schoolId, gradeName);
    const next = current.includes(sectionName)
      ? current.filter((s) => s !== sectionName)
      : [...current, sectionName];
    setGradeSections(schoolId, gradeName, next);
  };

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading schools…</div>;
  }

  const selectedCount = value.length;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search schools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {selectedCount === 0 && (
        <p className="text-sm text-amber-600">
          Select at least one school to publish this course to.
        </p>
      )}

      <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
        {filteredSchools.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">No schools found</div>
        ) : (
          filteredSchools.map((school) => {
            const isSelected = targetBySchool.has(school.id);
            const isOpen = expanded.has(school.id);
            const grades = Array.isArray(school.grades) ? school.grades : [];
            const target = targetBySchool.get(school.id);
            const gradeCount = target?.grades.length ?? 0;
            return (
              <div
                key={school.id}
                className={`rounded-lg border ${isSelected ? "border-blue-300 bg-blue-50/40" : "border-gray-200"}`}
              >
                <div className="flex items-center gap-2 p-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSchool(school.id)}
                    aria-label={`Select ${school.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => (isSelected ? toggleExpanded(school.id) : toggleSchool(school.id))}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <School className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm font-medium">{school.name}</span>
                    {school.schoolCode && (
                      <span className="text-xs text-gray-400">({school.schoolCode})</span>
                    )}
                    {isSelected && (
                      <Badge variant="secondary" className="text-[10px]">
                        {gradeCount === 0 ? "Whole school" : `${gradeCount} grade${gradeCount === 1 ? "" : "s"}`}
                      </Badge>
                    )}
                  </button>
                  {isSelected && grades.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(school.id)}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="Toggle grades"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                {isSelected && isOpen && (
                  <div className="border-t px-3 py-2 space-y-2">
                    {grades.length === 0 ? (
                      <p className="text-xs text-gray-500 py-1">
                        This school has no grades configured — the course will reach the whole school.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500">
                          Leave all grades unchecked to publish to the <strong>whole school</strong>.
                        </p>
                        {grades.map((grade) => {
                          const gradeSelected = isGradeSelected(school.id, grade.name);
                          const sections = Array.isArray(grade.sections) ? grade.sections : [];
                          const chosenSections = getGradeSections(school.id, grade.name);
                          const allSections = chosenSections.length === 0;
                          return (
                            <div key={grade.id} className="rounded-md border border-gray-100 p-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={gradeSelected}
                                  onCheckedChange={() => toggleGrade(school.id, grade.name)}
                                  aria-label={`Select ${grade.name}`}
                                />
                                <span className="text-sm font-medium">{grade.name}</span>
                                {gradeSelected && (
                                  <span className="text-xs text-gray-400">
                                    {allSections
                                      ? "All sections"
                                      : `${chosenSections.length} section${chosenSections.length === 1 ? "" : "s"}`}
                                  </span>
                                )}
                              </label>

                              {gradeSelected && sections.length > 0 && (
                                <div className="ml-6 mt-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant={allSections ? "default" : "outline"}
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => setGradeSections(school.id, grade.name, [])}
                                    >
                                      All sections
                                    </Button>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {sections.map((sec) => (
                                      <label key={sec.id} className="flex items-center gap-1.5 cursor-pointer">
                                        <Checkbox
                                          checked={chosenSections.includes(sec.name)}
                                          onCheckedChange={() => toggleSection(school.id, grade.name, sec.name)}
                                          aria-label={`Select section ${sec.name}`}
                                        />
                                        <span className="text-xs">{sec.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
