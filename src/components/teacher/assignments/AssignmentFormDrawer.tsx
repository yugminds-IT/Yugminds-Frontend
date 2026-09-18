"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Lock,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AssignmentBuilder,
  type Assignment as BuilderAssignment,
} from "@/components/admin/AssignmentBuilder";
import {
  AssignmentAudiencePicker,
  schoolsMissingAudience,
  type GradeAudienceTarget,
  type TeacherClass,
} from "@/components/teacher/AssignmentAudiencePicker";
import {
  isStateDirty,
  requestClose,
} from "@/hooks/useUnsavedCloseGuard";

export type CreatePayload = {
  dueDate: string;
  /** One or more schools to publish this assignment to (create mode). */
  schoolIds: string[];
  subject: string;
  isPublished: boolean;
  academicYear: string;
  entireSchool: boolean;
  gradeTargets: GradeAudienceTarget[];
};

type SchoolOption = { id?: string; name?: string };

type WizardStep = 1 | 2 | 3;

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: "Details" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Questions" },
];

type Props = {
  mode: "create" | "edit";
  payload: CreatePayload;
  onPayloadChange: (patch: Partial<CreatePayload>) => void;
  schools: SchoolOption[];
  showSchoolSelect: boolean;
  /** Assignment's current school — always kept selected while editing. */
  lockedSchoolId?: string;
  /** School IDs that already have a same-title DAILY copy (edit mode badge). */
  schoolsWithExistingCopy?: string[];
  teacherClasses: TeacherClass[];
  builderAssignment: BuilderAssignment | null;
  onBuilderChange: (a: BuilderAssignment | null) => void;
  questionsLocked: boolean;
  questionsLockMessage?: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export default function AssignmentFormDrawer({
  mode,
  payload,
  onPayloadChange,
  schools,
  showSchoolSelect,
  lockedSchoolId,
  schoolsWithExistingCopy = [],
  teacherClasses,
  builderAssignment,
  onBuilderChange,
  questionsLocked,
  questionsLockMessage,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<WizardStep>(1);
  const snapshotRef = useRef<{
    payload: CreatePayload;
    builder: BuilderAssignment | null;
  } | null>(null);

  // Reset to step 1 and capture dirty baseline whenever the drawer opens.
  useEffect(() => {
    setStep(1);
    snapshotRef.current = {
      payload: JSON.parse(JSON.stringify(payload)) as CreatePayload,
      builder: builderAssignment
        ? (JSON.parse(JSON.stringify(builderAssignment)) as BuilderAssignment)
        : null,
    };
    // Snapshot only on open (mode identity); not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isDirty = useMemo(() => {
    if (!snapshotRef.current) return false;
    return (
      isStateDirty(payload, snapshotRef.current.payload) ||
      isStateDirty(builderAssignment, snapshotRef.current.builder)
    );
  }, [payload, builderAssignment]);

  const handleRequestClose = () => {
    void requestClose(isDirty, onClose);
  };

  const primarySchoolId = payload.schoolIds[0] ?? "";

  // Keep builder chapter_id aligned with the primary selected school.
  useEffect(() => {
    if (!builderAssignment) return;
    const chapterId = primarySchoolId || "daily-school-assignment";
    if (builderAssignment.chapter_id === chapterId) return;
    onBuilderChange({ ...builderAssignment, chapter_id: chapterId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to school change
  }, [primarySchoolId]);

  const missingAudienceSchools = useMemo(
    () =>
      schoolsMissingAudience(
        payload.schoolIds,
        payload.entireSchool,
        payload.gradeTargets,
        teacherClasses,
      ),
    [
      payload.schoolIds,
      payload.entireSchool,
      payload.gradeTargets,
      teacherClasses,
    ],
  );

  const title = builderAssignment?.title?.trim() ?? "";
  const schoolsOk = payload.schoolIds.length > 0;
  const audienceOk =
    schoolsOk &&
    (payload.entireSchool || missingAudienceSchools.length === 0);
  const canNextFromDetails = title.length > 0 && schoolsOk;
  const canNextFromAudience = audienceOk;
  const canSubmit = canNextFromDetails && canNextFromAudience;

  const syncTitle = (value: string) => {
    if (!builderAssignment) {
      onBuilderChange({
        chapter_id: primarySchoolId || "daily-school-assignment",
        title: value,
        description: undefined,
        auto_grading_enabled: true,
        max_score: 100,
        questions: [],
      });
      return;
    }
    onBuilderChange({ ...builderAssignment, title: value });
  };

  const syncDescription = (value: string) => {
    if (!builderAssignment) return;
    onBuilderChange({
      ...builderAssignment,
      description: value.trim() || undefined,
    });
  };

  const toggleSchool = (schoolId: string) => {
    // Keep the assignment's own school selected while editing.
    if (mode === "edit" && lockedSchoolId && schoolId === lockedSchoolId) {
      return;
    }
    const selected = payload.schoolIds.includes(schoolId);
    const next = selected
      ? payload.schoolIds.filter((id) => id !== schoolId)
      : [...payload.schoolIds, schoolId];
    // Never drop the locked school from the selection.
    const withLocked =
      mode === "edit" && lockedSchoolId && !next.includes(lockedSchoolId)
        ? [lockedSchoolId, ...next]
        : next;
    let nextTargets = payload.gradeTargets;
    if (selected) {
      const remainingGradeIds = new Set(
        teacherClasses
          .filter((c) => c.school_id && withLocked.includes(c.school_id))
          .map((c) => c.grade_id),
      );
      nextTargets =
        remainingGradeIds.size > 0
          ? payload.gradeTargets.filter((t) => remainingGradeIds.has(t.gradeId))
          : [];
    }
    onPayloadChange({
      schoolIds: withLocked,
      gradeTargets: nextTargets,
    });
  };

  const goNext = () => {
    if (step === 1 && !canNextFromDetails) return;
    if (step === 2 && !canNextFromAudience) return;
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  const schoolCount = payload.schoolIds.length;
  const multiSchool = schoolCount > 1;
  const extraSchoolsOnEdit =
    mode === "edit" &&
    lockedSchoolId &&
    payload.schoolIds.filter((id) => id !== lockedSchoolId).length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleRequestClose}
        aria-hidden
      />

      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-6 pt-4 pb-3 border-b border-gray-200 shrink-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleRequestClose}
                className="text-gray-400 hover:text-gray-600 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">
                  {mode === "edit" ? "Edit assignment" : "New assignment"}
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  Step {step} of 3 — {STEPS[step - 1].label}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestClose}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicator */}
          <nav className="flex items-center gap-1" aria-label="Wizard steps">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (s.id < step) setStep(s.id);
                    else if (s.id === 2 && canNextFromDetails) setStep(2);
                    else if (
                      s.id === 3 &&
                      canNextFromDetails &&
                      canNextFromAudience
                    )
                      setStep(3);
                  }}
                  className={`flex-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-800"
                      : done
                        ? "text-gray-700 hover:bg-gray-50"
                        : "text-gray-400"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      active
                        ? "bg-blue-600 text-white"
                        : done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {done ? <CheckCircle className="h-3.5 w-3.5" /> : s.id}
                  </span>
                  <span className="text-xs font-medium hidden sm:inline">
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="sr-only">then</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Body — one step */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Unit 1 quiz"
                  value={builderAssignment?.title ?? ""}
                  onChange={(e) => syncTitle(e.target.value)}
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  Description
                </Label>
                <Textarea
                  placeholder="Optional instructions for students"
                  value={builderAssignment?.description ?? ""}
                  onChange={(e) => syncDescription(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  Subject
                </Label>
                <Input
                  placeholder="e.g. Mathematics, Science…"
                  value={payload.subject}
                  onChange={(e) =>
                    onPayloadChange({ subject: e.target.value })
                  }
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  Due date
                </Label>
                <Input
                  type="date"
                  value={payload.dueDate}
                  onChange={(e) =>
                    onPayloadChange({ dueDate: e.target.value })
                  }
                  className="h-10 text-sm"
                />
              </div>
              {showSchoolSelect && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">
                    School{mode === "create" || schools.length > 1 ? "s" : ""}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {schools.map((s) => {
                      const id = String(s.id ?? "");
                      if (!id) return null;
                      const checked = payload.schoolIds.includes(id);
                      const isLocked =
                        mode === "edit" && !!lockedSchoolId && id === lockedSchoolId;
                      const hasCopy =
                        mode === "edit" &&
                        !isLocked &&
                        schoolsWithExistingCopy.includes(id);
                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-2.5 px-3 py-2.5 ${
                            isLocked
                              ? "cursor-default bg-gray-50/80"
                              : "cursor-pointer hover:bg-gray-50"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={isLocked}
                            onCheckedChange={() => toggleSchool(id)}
                            aria-label={`Select ${s.name ?? id}`}
                          />
                          <span className="text-sm text-gray-800 flex-1 min-w-0">
                            {s.name ?? id}
                            {isLocked && (
                              <span className="ml-1.5 text-[11px] text-gray-400">
                                (this assignment)
                              </span>
                            )}
                            {hasCopy && (
                              <span className="ml-1.5 text-[11px] text-amber-700">
                                Already has a copy
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {mode === "create" && (
                    <p className="text-[11px] text-gray-500">
                      Each school gets an independent assignment copy. Audience
                      (grades/sections) is set per school. Changing audience
                      never deletes past submissions.
                    </p>
                  )}
                  {mode === "edit" && schools.length > 1 && (
                    <p className="text-[11px] text-gray-500">
                      Each school has an independent assignment copy. Adding
                      another school creates or updates that school’s copy only.
                      Audience changes never delete past submissions. This
                      assignment’s school stays selected.
                    </p>
                  )}
                  {!schoolsOk && (
                    <p className="text-xs text-amber-700">
                      Select at least one school to continue.
                    </p>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={payload.isPublished}
                  onChange={(e) =>
                    onPayloadChange({ isPublished: e.target.checked })
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm text-gray-700">
                  {mode === "edit" ? "Published" : "Publish immediately"}
                </span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 max-w-lg">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Who should see this?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {multiSchool
                    ? "Apply to every selected school entirely, or pick grades and sections under each school."
                    : "Choose the whole school, or specific grades and sections you teach."}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <AssignmentAudiencePicker
                  classes={teacherClasses}
                  selectedSchoolIds={payload.schoolIds}
                  schoolNames={Object.fromEntries(
                    schools
                      .filter((s) => s.id)
                      .map((s) => [String(s.id), s.name ?? String(s.id)]),
                  )}
                  entireSchool={payload.entireSchool}
                  onChangeEntireSchool={(value) =>
                    onPayloadChange({
                      entireSchool: value,
                      gradeTargets: value ? [] : payload.gradeTargets,
                    })
                  }
                  targets={payload.gradeTargets}
                  onChangeTargets={(targets) =>
                    onPayloadChange({
                      gradeTargets: targets,
                      entireSchool: false,
                    })
                  }
                />
              </div>
              {!audienceOk && (
                <p className="text-xs text-amber-700">
                  {multiSchool
                    ? "Select Entire selected schools, or at least one grade / section for each school."
                    : "Select Entire school, or at least one grade / section to continue."}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    Questions
                    {questionsLocked && (
                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Optional auto-graded questions. You can publish without any.
                    {multiSchool && mode === "create"
                      ? ` The same questions will be copied to all ${schoolCount} schools.`
                      : ""}
                  </p>
                </div>
              </div>
              <AssignmentBuilder
                chapterId={primarySchoolId || "daily-school-assignment"}
                chapterName="Daily Assignment"
                assignment={builderAssignment}
                onAssignmentChange={onBuilderChange}
                disabled={questionsLocked}
                lockMessage={
                  questionsLocked ? questionsLockMessage : undefined
                }
                variant="inline"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0 bg-white gap-3">
          <Button variant="outline" size="sm" onClick={handleRequestClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goBack}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={
                  (step === 1 && !canNextFromDetails) ||
                  (step === 2 && !canNextFromAudience)
                }
                className="inline-flex items-center gap-1 text-sm font-medium px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading || !canSubmit}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {mode === "edit" ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    {loading
                      ? "Saving…"
                      : extraSchoolsOnEdit
                        ? `Save & copy to ${extraSchoolsOnEdit} school${extraSchoolsOnEdit === 1 ? "" : "s"}`
                        : "Save changes"}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {loading
                      ? "Creating…"
                      : multiSchool
                        ? `Create ${schoolCount} assignments`
                        : "Create assignment"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
