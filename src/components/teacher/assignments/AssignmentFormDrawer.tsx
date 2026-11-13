"use client";

import { REPORT_SUBJECTS } from "@/lib/report-subjects";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Lock, Send, X } from "lucide-react";
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
import { sumQuestionMarks } from "@/lib/assignment-marks";
import { toast } from "@/components/ui/toast";
import { EXAM_TYPE_LABEL } from "@/lib/assignment-types";

export type CreatePayload = {
  dueDate: string;
  /** DAILY/COURSE: what happens after the due day ends. */
  lateSubmissionPolicy: "allow" | "close";
  /** Optional (policy "allow"): last day late submissions are accepted. "" = never closes. */
  closeDate: string;
  /** One or more schools to publish this assignment to (create mode). */
  schoolIds: string[];
  subject: string;
  isPublished: boolean;
  academicYear: string;
  entireSchool: boolean;
  gradeTargets: GradeAudienceTarget[];
  /** EXAM only. startsAt/endsAt are datetime-local strings; durationMinutes is "" for none. */
  examType: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: string;
};

type SchoolOption = { id?: string; name?: string };

type WizardStep = 1 | 2 | 3;

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: "Details" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Questions" },
];

type Props = {
  kind?: "DAILY" | "EXAM";
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
  kind = "DAILY",
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
  const isExam = kind === "EXAM";
  const examWindowOk = !isExam || (
    !!payload.examType && !!payload.startsAt && !!payload.endsAt &&
    new Date(payload.endsAt) > new Date(payload.startsAt) &&
    (!payload.durationMinutes || (Number.isInteger(Number(payload.durationMinutes)) && Number(payload.durationMinutes) > 0 &&
      Number(payload.durationMinutes) * 60000 <= new Date(payload.endsAt).getTime() - new Date(payload.startsAt).getTime()))
  );
  const canNextFromDetails = title.length > 0 && schoolsOk && examWindowOk;
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

  const syncMaxScore = (value: string) => {
    if (!builderAssignment) return;
    const maxScore = parseInt(value, 10);
    if (!Number.isFinite(maxScore) || maxScore < 1) {
      onBuilderChange({ ...builderAssignment, max_score: Number(value) || 0 });
      return;
    }
    const used = sumQuestionMarks(builderAssignment.questions ?? []);
    if (used > maxScore) {
      toast.warning(
        `Questions already add up to ${used} marks. Set at least ${used}, or lower question marks first.`,
      );
      return;
    }
    onBuilderChange({ ...builderAssignment, max_score: maxScore });
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

  const nextDisabled = (step === 1 && !canNextFromDetails) || (step === 2 && !canNextFromAudience);
  const missing = step === 1 && !canNextFromDetails ? (!title ? "give it a title" : !examWindowOk ? "set a valid exam window" : "choose a school") : step === 2 && !canNextFromAudience ? "choose who sees it" : "";

  return (
    <div className="tg-drawer" role="dialog" aria-modal="true" aria-label={`${mode === "edit" ? "Edit" : "New"} ${isExam ? "exam" : "assignment"}`} onClick={handleRequestClose}>
      <div className="tg-drawer-card" onClick={(e) => e.stopPropagation()}>
        <div className="tg-drawer-head">
          <div className="tg-drawer-top">
            <div>
              <h2>{mode === "edit" ? "Edit" : "New"} {isExam ? "exam" : "assignment"}</h2>
              <p>Step {step} of 3: {STEPS[step - 1].label}</p>
            </div>
            <button type="button" className="pl-ico" onClick={handleRequestClose} aria-label="Close"><X aria-hidden="true" /></button>
          </div>

          <ol className="tg-steps" aria-label="Steps">
            {STEPS.map((s) => {
              const done = step > s.id;
              const reachable = s.id < step || (s.id === 2 && canNextFromDetails) || (s.id === 3 && canNextFromDetails && canNextFromAudience);
              return (
                <li key={s.id}>
                  <button type="button" className="tg-step" aria-current={step === s.id ? "step" : undefined} data-done={done} disabled={!reachable && step !== s.id} onClick={() => reachable && setStep(s.id)}>
                    <i>{done ? <Check aria-hidden="true" /> : s.id}</i>
                    <span>{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="tg-drawer-body">
          {step === 1 && (
            <div className="tg-form">
              <div className="sd-field-wrap">
                <label htmlFor="as-title">Title</label>
                <input id="as-title" className="sd-field" placeholder="For example: Unit 1 quiz" value={builderAssignment?.title ?? ""} onChange={(e) => syncTitle(e.target.value)} autoFocus aria-required="true" />
              </div>
              <div className="sd-field-wrap">
                <label htmlFor="as-desc">Instructions <small>(optional)</small></label>
                <textarea id="as-desc" className="sd-field" rows={3} placeholder="Anything students should know before they start" value={builderAssignment?.description ?? ""} onChange={(e) => syncDescription(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "0.9rem" }}>
                <div className="sd-field-wrap">
                  <label htmlFor="as-marks">Maximum marks</label>
                  <input id="as-marks" className="sd-field" type="number" min="1" value={builderAssignment?.max_score ?? 100} onChange={(e) => syncMaxScore(e.target.value)} />
                </div>
                {!isExam && (
                <div className="sd-field-wrap">
                  <label htmlFor="as-due">Due date</label>
                  <input id="as-due" className="sd-field" type="date" value={payload.dueDate} onChange={(e) => onPayloadChange({ dueDate: e.target.value, ...(payload.closeDate && e.target.value > payload.closeDate ? { closeDate: "" } : {}) })} />
                </div>
                )}
              </div>
              {!isExam && payload.dueDate && (
                <div className="sd-field-wrap">
                  <label htmlFor="as-late">After the due date</label>
                  <select id="as-late" className="sd-field" value={payload.lateSubmissionPolicy} onChange={(e) => onPayloadChange({ lateSubmissionPolicy: e.target.value as "allow" | "close" })}>
                    <option value="allow">Accept late submissions (marked Late)</option>
                    <option value="close">Close submissions</option>
                  </select>
                  <p className="sd-hint">The due date runs to the end of that day. To reopen a closed assignment, move the due date forward.</p>
                </div>
              )}
              {!isExam && payload.dueDate && payload.lateSubmissionPolicy === "allow" && (
                <div className="sd-field-wrap">
                  <label htmlFor="as-close">Close date <span className="sd-opt">(optional)</span></label>
                  <input id="as-close" className="sd-field" type="date" min={payload.dueDate} value={payload.closeDate} onChange={(e) => onPayloadChange({ closeDate: e.target.value })} />
                  <p className="sd-hint">Late submissions are accepted until the end of this day, then it closes. Leave empty to never close.</p>
                </div>
              )}
              {isExam && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", gap: "0.9rem" }}>
                  <div className="sd-field-wrap">
                    <label htmlFor="ex-type">Exam type</label>
                    <select id="ex-type" className="sd-field" value={payload.examType} onChange={(e) => onPayloadChange({ examType: e.target.value })}>
                      {Object.entries(EXAM_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="sd-field-wrap">
                    <label htmlFor="ex-dur">Duration in minutes <small>(optional)</small></label>
                    <input id="ex-dur" className="sd-field" type="number" min="1" placeholder="No limit within the window" value={payload.durationMinutes} onChange={(e) => onPayloadChange({ durationMinutes: e.target.value })} />
                  </div>
                  <div className="sd-field-wrap">
                    <label htmlFor="ex-start">Opens</label>
                    <input id="ex-start" className="sd-field" type="datetime-local" value={payload.startsAt} onChange={(e) => onPayloadChange({ startsAt: e.target.value })} />
                  </div>
                  <div className="sd-field-wrap">
                    <label htmlFor="ex-end">Closes</label>
                    <input id="ex-end" className="sd-field" type="datetime-local" value={payload.endsAt} onChange={(e) => onPayloadChange({ endsAt: e.target.value })} />
                  </div>
                  <p className="tg-fine" style={{ gridColumn: "1 / -1", margin: 0 }}>Students can start any time in the window. The timer runs on the server, so each student gets the full duration, but never past the closing time.</p>
                </div>
              )}
              <p className="tg-fine" style={{ marginTop: "-0.5rem" }}>Question marks cannot add up to more than the maximum.</p>
              <div className="sd-field-wrap">
                <label htmlFor="as-subject">Subject</label>
                <select id="as-subject" className="sd-field" value={payload.subject} onChange={(e) => onPayloadChange({ subject: e.target.value })}>
                  <option value="">Select a subject</option>
                  {REPORT_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {showSchoolSelect && (
                <div className="sd-field-wrap" role="group" aria-labelledby="as-schools">
                  <label id="as-schools">{mode === "create" || schools.length > 1 ? "Schools" : "School"}</label>
                  <div>
                    {schools.map((sc) => {
                      const id = String(sc.id ?? "");
                      if (!id) return null;
                      const isLocked = mode === "edit" && !!lockedSchoolId && id === lockedSchoolId;
                      const hasCopy = mode === "edit" && !isLocked && schoolsWithExistingCopy.includes(id);
                      return (
                        <label key={id} className="tg-opt">
                          <input type="checkbox" checked={payload.schoolIds.includes(id)} disabled={isLocked} onChange={() => toggleSchool(id)} />
                          <span>
                            <b>{sc.name ?? id}</b>
                            {isLocked && <small>This assignment is here</small>}
                            {hasCopy && <em>Already has a copy</em>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="tg-fine">
                    {mode === "create"
                      ? "Each school gets its own copy. You choose the audience per school. Changing it never deletes past submissions."
                      : schools.length > 1
                        ? "Each school has its own copy. Adding a school creates or updates only that school's copy, and this assignment's school stays selected."
                        : ""}
                  </p>
                  {!schoolsOk && <p className="tg-warn">Choose at least one school to continue.</p>}
                </div>
              )}

              <label className="tg-opt">
                <input type="checkbox" checked={payload.isPublished} onChange={(e) => onPayloadChange({ isPublished: e.target.checked })} />
                <span><b>{mode === "edit" ? "Published" : "Publish right away"}</b><small>{payload.isPublished ? "Students can see it now." : "It stays a draft until you publish it."}</small></span>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="tg-form">
              <div>
                <h3 className="tg-h3">Who sees this?</h3>
                <p className="tg-fine">
                  {multiSchool
                    ? "Give it to every selected school, or pick grades and sections under each."
                    : "Give it to the whole school, or to the grades and sections you teach."}
                </p>
              </div>
              <AssignmentAudiencePicker
                classes={teacherClasses}
                selectedSchoolIds={payload.schoolIds}
                schoolNames={Object.fromEntries(schools.filter((sc) => sc.id).map((sc) => [String(sc.id), sc.name ?? String(sc.id)]))}
                entireSchool={payload.entireSchool}
                onChangeEntireSchool={(value) => onPayloadChange({ entireSchool: value, gradeTargets: value ? [] : payload.gradeTargets })}
                targets={payload.gradeTargets}
                onChangeTargets={(targets) => onPayloadChange({ gradeTargets: targets, entireSchool: false })}
              />
              {!audienceOk && (
                <p className="tg-warn">
                  {multiSchool ? "Choose every selected school, or at least one grade or section for each school." : "Choose the whole school, or at least one grade or section, to continue."}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="tg-form" style={{ maxWidth: "none" }}>
              <div>
                <h3 className="tg-h3">Questions {questionsLocked && <Lock aria-label="Locked" style={{ width: "1rem", height: "1rem", display: "inline", color: "var(--sd-amber-deep)", verticalAlign: "-0.15em" }} />}</h3>
                <p className="tg-fine">
                  Optional, and graded for you. You can publish without any.
                  {multiSchool && mode === "create" ? ` The same questions are copied to all ${schoolCount} schools.` : ""}
                </p>
              </div>
              <div className="tg-builder">
                <AssignmentBuilder
                  chapterId={primarySchoolId || "daily-school-assignment"}
                  chapterName={isExam ? "Exam" : "Daily Assignment"}
                  assignment={builderAssignment}
                  onAssignmentChange={onBuilderChange}
                  disabled={questionsLocked}
                  lockMessage={questionsLocked ? questionsLockMessage : undefined}
                  variant="inline"
                />
              </div>
            </div>
          )}
        </div>

        <div className="tg-drawer-foot">
          <button type="button" className="sd-btn sd-btn--line" onClick={handleRequestClose}>Cancel</button>
          <div>
            {missing && step < 3 && <span style={{ alignSelf: "center", fontSize: "0.88rem", color: "var(--sd-ink-soft)" }}>Still needed: {missing}.</span>}
            {step > 1 && <button type="button" className="sd-btn sd-btn--line" onClick={goBack}><ChevronLeft aria-hidden="true" />Back</button>}
            {step < 3 ? (
              <button type="button" className="sd-btn sd-btn--amber" onClick={goNext} disabled={nextDisabled}>Next<ChevronRight aria-hidden="true" /></button>
            ) : (
              <button type="button" className="sd-btn sd-btn--amber" onClick={onSubmit} disabled={loading || !canSubmit}>
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : mode === "edit" ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}
                {mode === "edit"
                  ? loading ? "Saving" : extraSchoolsOnEdit ? `Save and copy to ${extraSchoolsOnEdit} ${extraSchoolsOnEdit === 1 ? "school" : "schools"}` : "Save changes"
                  : loading ? "Creating" : multiSchool ? `Create ${schoolCount} assignments` : isExam ? "Create exam" : "Create assignment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
