"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Plus,
  Edit,
  Trash2,
  CheckSquare,
  Circle,
  X,
} from "lucide-react";
import { generateUUID } from "../../lib/uuid-utils";
import { toast } from "@/components/ui/toast";
import { requestClose, useDirtySnapshot } from "@/hooks/useUnsavedCloseGuard";

export interface AssignmentQuestion {
  id?: string;
  assignment_id?: string;
  question_type: "MCQ" | "FillBlank";
  question_text: string;
  options?: string[];
  correct_answer: string;
  marks: number;
}

export interface Assignment {
  id?: string;
  chapter_id: string;
  title: string;
  description?: string;
  auto_grading_enabled: boolean;
  max_score: number;
  questions?: AssignmentQuestion[];
}

type QuestionFormData = {
  question_type: "MCQ" | "FillBlank";
  question_text: string;
  options: string[];
  correct_answer: string;
  /** Stable MCQ selection index — survives option text edits. -1 = none. */
  correct_option_index: number;
  marks: string;
};

const emptyQuestionForm = (): QuestionFormData => ({
  question_type: "MCQ",
  question_text: "",
  options: ["", "", "", ""],
  correct_answer: "",
  correct_option_index: -1,
  marks: "1",
});

interface AssignmentBuilderProps {
  chapterId: string;
  chapterName: string;
  assignment: Assignment | null;
  onAssignmentChange: (assignment: Assignment | null) => void;
  disabled?: boolean;
  /** Shown when questions are locked (e.g. published or has submissions). */
  lockMessage?: string;
  /** Renders without its own outer Card/title chrome when nested inside a parent
   * that already shows the chapter name (e.g. ChapterBuilderCard). */
  embedded?: boolean;
  /**
   * `chapter` (default): full admin/course chrome with Create/Edit Assignment.
   * `inline`: questions-only UI for teacher create wizard — no nested create meta.
   * Parent must pre-seed `assignment` (non-null).
   */
  variant?: "chapter" | "inline";
}

export function AssignmentBuilder({
  chapterId,
  chapterName,
  assignment,
  onAssignmentChange,
  disabled = false,
  lockMessage,
  embedded = false,
  variant = "chapter",
}: AssignmentBuilderProps) {
  const isInline = variant === "inline";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AssignmentQuestion | null>(null);
  const [formData, setFormData] = useState({
    title: assignment?.title || "",
    description: assignment?.description || "",
    auto_grading_enabled: assignment?.auto_grading_enabled ?? true,
    max_score:
      assignment?.max_score?.toString() ||
      (
        assignment?.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 100
      ).toString(),
  });
  const [questionFormData, setQuestionFormData] = useState<QuestionFormData>(emptyQuestionForm);
  const [pendingDeleteQuestionId, setPendingDeleteQuestionId] = useState<string | null>(null);
  const [pendingDeleteAssignment, setPendingDeleteAssignment] = useState(false);
  const [lastAddedQuestionId, setLastAddedQuestionId] = useState<string | null>(null);

  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const lastAddedRowRef = useRef<HTMLDivElement | null>(null);

  const focusQuestionText = () => {
    requestAnimationFrame(() => {
      questionTextRef.current?.focus();
    });
  };

  const loadQuestionIntoForm = (question?: AssignmentQuestion) => {
    if (question) {
      const options = question.options?.length
        ? [...question.options]
        : question.question_type === "MCQ"
          ? ["", "", "", ""]
          : [];
      const answer = question.correct_answer || "";
      const answerNorm = answer.trim().toLowerCase();
      const matchedIndex =
        question.question_type === "MCQ"
          ? options.findIndex((o) => o.trim().toLowerCase() === answerNorm)
          : -1;
      setEditingQuestion(question);
      setQuestionFormData({
        question_type: question.question_type,
        question_text: question.question_text || "",
        options,
        correct_answer: answer,
        correct_option_index: matchedIndex,
        marks: question.marks?.toString() || "1",
      });
    } else {
      setEditingQuestion(null);
      setQuestionFormData(emptyQuestionForm());
    }
  };

  const openDialog = () => {
    if (assignment) {
      setFormData({
        title: assignment.title || "",
        description: assignment.description || "",
        auto_grading_enabled: assignment.auto_grading_enabled ?? true,
        max_score: assignment.max_score?.toString() || "100",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        auto_grading_enabled: true,
        max_score: "100",
      });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const assignmentFormDirty = useDirtySnapshot(isDialogOpen, formData);

  const requestCloseAssignmentDialog = () => {
    void requestClose(assignmentFormDirty, closeDialog);
  };

  /** Chapter mode only — opens the question dialog. */
  const openQuestionDialog = (question?: AssignmentQuestion) => {
    loadQuestionIntoForm(question);
    setIsQuestionDialogOpen(true);
  };

  const closeQuestionDialog = () => {
    setIsQuestionDialogOpen(false);
    setEditingQuestion(null);
    setQuestionFormData(emptyQuestionForm());
  };

  const questionFormDirty = useDirtySnapshot(isQuestionDialogOpen, questionFormData);

  const requestCloseQuestionDialog = () => {
    void requestClose(questionFormDirty, closeQuestionDialog);
  };

  /** Inline mode — load into the persistent composer and scroll to it. */
  const startInlineEdit = (question?: AssignmentQuestion) => {
    loadQuestionIntoForm(question);
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      focusQuestionText();
    });
  };

  const cancelInlineEdit = () => {
    setEditingQuestion(null);
    setQuestionFormData(emptyQuestionForm());
    focusQuestionText();
  };

  const handleSaveAssignment = () => {
    if (!formData.title.trim()) {
      toast.warning("Assignment title is required.");
      return;
    }
    if (!chapterId) {
      toast.error("No chapter ID provided. Please try again.");
      return;
    }

    const maxScore = parseInt(formData.max_score) || 100;
    const questions = assignment?.questions || [];
    const assignmentId = assignment?.id || generateUUID();

    const updatedAssignment: Assignment = {
      ...assignment,
      id: assignmentId,
      chapter_id: chapterId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      auto_grading_enabled: formData.auto_grading_enabled,
      max_score: maxScore,
      questions,
    };

    if (!updatedAssignment.title || !updatedAssignment.chapter_id) {
      toast.error("Invalid assignment data. Please try again.");
      return;
    }

    try {
      onAssignmentChange(updatedAssignment);
    } catch {
      toast.error("Error saving assignment. Please try again.");
      return;
    }

    closeDialog();
  };

  /**
   * Validates and persists the current question form.
   * @returns the saved question id, or null on validation failure
   */
  const persistQuestion = (): string | null => {
    if (!questionFormData.question_text.trim()) {
      toast.warning("Question text is required.");
      return null;
    }

    let resolvedCorrectAnswer = questionFormData.correct_answer.trim();
    let resolvedOptions: string[] | undefined;

    if (questionFormData.question_type === "MCQ") {
      const validOptions = questionFormData.options
        .map((opt: string) => opt.trim())
        .filter(Boolean);
      if (validOptions.length < 2) {
        toast.warning("MCQ questions must have at least 2 options.");
        return null;
      }
      const idx = questionFormData.correct_option_index;
      if (
        idx < 0 ||
        idx >= questionFormData.options.length ||
        !questionFormData.options[idx]?.trim()
      ) {
        toast.warning("Mark the correct option beside one of the answers.");
        return null;
      }
      resolvedCorrectAnswer = questionFormData.options[idx].trim();
      resolvedOptions = validOptions;
      if (!resolvedOptions.includes(resolvedCorrectAnswer)) {
        toast.warning("Correct answer must be one of the options.");
        return null;
      }
    } else {
      if (!resolvedCorrectAnswer) {
        toast.warning("Correct answer is required for fill-in-the-blank questions.");
        return null;
      }
    }

    if (!assignment) {
      toast.error("Assignment is not ready yet.");
      return null;
    }

    const marks = parseFloat(questionFormData.marks) || 1;
    const questionId = editingQuestion?.id || generateUUID();
    const newQuestion: AssignmentQuestion = {
      ...(editingQuestion || {}),
      id: questionId,
      assignment_id: assignment.id,
      question_type: questionFormData.question_type,
      question_text: questionFormData.question_text.trim(),
      options:
        questionFormData.question_type === "MCQ" ? resolvedOptions : undefined,
      correct_answer: resolvedCorrectAnswer,
      marks,
    };

    const questions = assignment.questions || [];
    let nextQuestions: AssignmentQuestion[];
    if (editingQuestion) {
      nextQuestions = questions.map((q: AssignmentQuestion) =>
        q.id === editingQuestion.id ? newQuestion : q,
      );
    } else {
      nextQuestions = [...questions, newQuestion];
    }
    const maxScore = nextQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
    onAssignmentChange({
      ...assignment,
      questions: nextQuestions,
      max_score: maxScore > 0 ? maxScore : assignment.max_score || 100,
    });

    return questionId;
  };

  const resetFormKeepType = () => {
    const type = questionFormData.question_type;
    setEditingQuestion(null);
    setQuestionFormData({
      ...emptyQuestionForm(),
      question_type: type,
      options: type === "MCQ" ? ["", "", "", ""] : [],
    });
  };

  const handleSaveQuestion = (mode: "close" | "add-another" | "inline" = "close") => {
    const wasEdit = !!editingQuestion;
    const savedId = persistQuestion();
    if (!savedId) return;

    if (mode === "add-another" || mode === "inline") {
      setLastAddedQuestionId(wasEdit ? null : savedId);
      resetFormKeepType();
      focusQuestionText();
      return;
    }

    setLastAddedQuestionId(wasEdit ? null : savedId);
    closeQuestionDialog();
  };

  useEffect(() => {
    if (!lastAddedQuestionId) return;
    const el = lastAddedRowRef.current;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    const t = window.setTimeout(() => setLastAddedQuestionId(null), 1200);
    return () => window.clearTimeout(t);
  }, [lastAddedQuestionId, assignment?.questions?.length]);

  const handleDeleteQuestion = (questionId: string | undefined) => {
    if (!questionId || !assignment?.questions) return;
    setPendingDeleteQuestionId(questionId);
  };

  const confirmDeleteQuestion = (questionId: string) => {
    const nextQuestions = (assignment!.questions || []).filter(
      (q: AssignmentQuestion) => q.id !== questionId,
    );
    const maxScore = nextQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
    onAssignmentChange({
      ...assignment!,
      questions: nextQuestions,
      max_score: maxScore > 0 ? maxScore : assignment?.max_score || 100,
    });
    if (editingQuestion?.id === questionId) {
      cancelInlineEdit();
    }
    setPendingDeleteQuestionId(null);
  };

  const handleDeleteAssignment = () => {
    setPendingDeleteAssignment(true);
  };

  const confirmDeleteAssignment = () => {
    onAssignmentChange(null);
    setPendingDeleteAssignment(false);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...questionFormData.options];
    newOptions[index] = value;
    const next = { ...questionFormData, options: newOptions };
    if (questionFormData.correct_option_index === index) {
      next.correct_answer = value;
    }
    setQuestionFormData(next);
  };

  const setCorrectOption = (index: number) => {
    setQuestionFormData({
      ...questionFormData,
      correct_option_index: index,
      correct_answer: questionFormData.options[index] ?? "",
    });
  };

  const addOption = () => {
    setQuestionFormData({
      ...questionFormData,
      options: [...questionFormData.options, ""],
    });
  };

  const removeOption = (index: number) => {
    const newOptions = questionFormData.options.filter((_, i) => i !== index);
    let correctIndex = questionFormData.correct_option_index;
    let correctAnswer = questionFormData.correct_answer;
    if (correctIndex === index) {
      correctIndex = -1;
      correctAnswer = "";
    } else if (correctIndex > index) {
      correctIndex -= 1;
    }
    setQuestionFormData({
      ...questionFormData,
      options: newOptions,
      correct_option_index: correctIndex,
      correct_answer: correctAnswer,
    });
  };

  const questionsForMarks = Array.isArray(assignment?.questions)
    ? assignment.questions
    : [];
  const totalMarks =
    questionsForMarks.reduce(
      (sum: number, q: AssignmentQuestion) => sum + (q.marks || 0),
      0,
    ) || 0;

  const statusDescription = assignment ? (
    <>
      {questionsForMarks.length} question
      {questionsForMarks.length !== 1 ? "s" : ""} • Total marks: {totalMarks} /{" "}
      {assignment.max_score}
    </>
  ) : (
    "No assignment created yet"
  );

  const editingIndex =
    editingQuestion && assignment?.questions
      ? assignment.questions.findIndex((q) => q.id === editingQuestion.id)
      : -1;

  const questionFields = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="question-type">Question type</Label>
        <Select
          value={questionFormData.question_type}
          onValueChange={(value: "MCQ" | "FillBlank") =>
            setQuestionFormData({
              ...questionFormData,
              question_type: value,
              options: value === "MCQ" ? ["", "", "", ""] : [],
              correct_answer: "",
              correct_option_index: -1,
            })
          }
        >
          <SelectTrigger id="question-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MCQ">Multiple Choice (MCQ)</SelectItem>
            <SelectItem value="FillBlank">Fill in the Blank</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="question-text">Question text *</Label>
        <Textarea
          id="question-text"
          ref={questionTextRef}
          value={questionFormData.question_text}
          onChange={(e) =>
            setQuestionFormData({
              ...questionFormData,
              question_text: e.target.value,
            })
          }
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (isInline) handleSaveQuestion("inline");
              else handleSaveQuestion(editingQuestion ? "close" : "add-another");
            }
          }}
          placeholder="Enter the question"
          rows={3}
        />
      </div>

      {questionFormData.question_type === "MCQ" && (
        <div className="space-y-1.5">
          <Label>Options * — click the circle to mark the correct answer</Label>
          <div className="space-y-2">
            {questionFormData.options.map((option, index) => {
              const isCorrect = questionFormData.correct_option_index === index;
              return (
                <div key={index} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectOption(index)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      isCorrect
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                    }`}
                    title={
                      isCorrect
                        ? "Correct answer"
                        : `Mark option ${String.fromCharCode(65 + index)} as correct`
                    }
                    aria-label={`Mark option ${String.fromCharCode(65 + index)} as correct`}
                    aria-pressed={isCorrect}
                  >
                    {isCorrect ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <span className="w-5 text-sm font-medium text-gray-500">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    className={isCorrect ? "border-emerald-300 focus-visible:ring-emerald-500" : ""}
                  />
                  {questionFormData.options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(index)}
                      className="h-8 w-8 p-0 text-gray-400"
                      aria-label="Remove option"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {questionFormData.options.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                className="h-8 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add option
              </Button>
            )}
          </div>
        </div>
      )}

      {questionFormData.question_type === "FillBlank" && (
        <div className="space-y-1.5">
          <Label htmlFor="correct-answer">Correct answer *</Label>
          <Input
            id="correct-answer"
            value={questionFormData.correct_answer}
            onChange={(e) =>
              setQuestionFormData({
                ...questionFormData,
                correct_answer: e.target.value,
                correct_option_index: -1,
              })
            }
            placeholder="Enter correct answer"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="question-marks">Marks</Label>
        <Input
          id="question-marks"
          type="number"
          min="0.5"
          step="0.5"
          value={questionFormData.marks}
          onChange={(e) =>
            setQuestionFormData({ ...questionFormData, marks: e.target.value })
          }
          placeholder="1"
          className="w-32"
        />
      </div>
    </div>
  );

  const actionButtons = !disabled && (
    <div className="flex flex-wrap items-center gap-1.5">
      {assignment ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openDialog}
            className="h-8 border-gray-200 text-xs font-medium text-gray-700"
          >
            <Edit className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          {pendingDeleteAssignment ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                onClick={confirmDeleteAssignment}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPendingDeleteAssignment(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteAssignment();
              }}
              title="Delete assignment"
              aria-label="Delete assignment"
              className="h-8 w-8 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openDialog}
          className="h-8 border-gray-200 text-xs font-medium text-gray-700"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Create Assignment
        </Button>
      )}
    </div>
  );

  const questionsArray = Array.isArray(assignment?.questions)
    ? assignment!.questions!
    : [];

  const bodyAndDialogs = (
    <>
      {disabled && lockMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {lockMessage}
        </div>
      )}
      {assignment ? (
        <>
          {!isInline && (
            <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
              <h4 className="text-sm font-semibold text-gray-900">
                {assignment.title}
              </h4>
              {assignment.description && (
                <p className="mt-0.5 text-xs text-gray-600">
                  {assignment.description}
                </p>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                {assignment.auto_grading_enabled
                  ? "Auto-graded"
                  : "Manually graded"}
                <span className="mx-1.5 text-gray-300">•</span>
                Max score {assignment.max_score}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-medium text-gray-500">
                {isInline
                  ? `${questionsArray.length} question${questionsArray.length !== 1 ? "s" : ""}`
                  : "Questions"}
                {isInline && questionsArray.length > 0 && (
                  <span className="ml-1.5 font-normal text-gray-400">
                    · {assignment.max_score} marks total
                  </span>
                )}
              </Label>
              {!disabled && !isInline && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openQuestionDialog()}
                  className="h-8 border-gray-200 text-xs font-medium text-gray-700"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Question
                </Button>
              )}
            </div>

            {questionsArray.length > 0 ? (
              <div className="space-y-2">
                {questionsArray.map((question, index) => {
                  const isLastAdded = question.id === lastAddedQuestionId;
                  const isBeingEdited = editingQuestion?.id === question.id;
                  return (
                    <div
                      key={question.id || index}
                      ref={isLastAdded ? lastAddedRowRef : undefined}
                      className={`group/q flex items-start gap-3 rounded-lg border bg-white p-3 transition-colors ${
                        isBeingEdited
                          ? "border-blue-300 ring-1 ring-blue-100"
                          : isLastAdded
                            ? "border-emerald-300 bg-emerald-50/40"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/60"
                      }`}
                    >
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">
                          {question.question_text}
                        </p>
                        <p className="mt-0.5 mb-2 text-xs text-gray-500">
                          {question.question_type === "MCQ"
                            ? "Multiple choice"
                            : "Fill in the blank"}
                          <span className="mx-1.5 text-gray-300">•</span>
                          {question.marks} mark
                          {question.marks !== 1 ? "s" : ""}
                        </p>
                        {question.question_type === "MCQ" && question.options && (
                          <div className="space-y-0.5">
                            {question.options.map((option, optIndex) => {
                              const isCorrect =
                                option.trim().toLowerCase() ===
                                (question.correct_answer || "")
                                  .trim()
                                  .toLowerCase();
                              return (
                                <div
                                  key={optIndex}
                                  className={`text-xs ${
                                    isCorrect
                                      ? "font-medium text-green-700"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIndex)}. {option}
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
                              {question.correct_answer}
                            </span>
                          </p>
                        )}
                      </div>
                      {!disabled && (
                        <div
                          className={`flex flex-shrink-0 items-center gap-0.5 transition-opacity ${
                            pendingDeleteQuestionId === question.id
                              ? "opacity-100"
                              : "opacity-100 sm:opacity-0 sm:group-hover/q:opacity-100 sm:group-focus-within/q:opacity-100"
                          }`}
                        >
                          {pendingDeleteQuestionId === question.id ? (
                            <>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() =>
                                  confirmDeleteQuestion(question.id!)
                                }
                              >
                                Delete
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => setPendingDeleteQuestionId(null)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  isInline
                                    ? startInlineEdit(question)
                                    : openQuestionDialog(question)
                                }
                                title="Edit question"
                                aria-label="Edit question"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteQuestion(question.id);
                                }}
                                title="Delete question"
                                aria-label="Delete question"
                                className="h-8 w-8 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              !isInline && (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center">
                  <p className="text-sm text-gray-500">No questions yet</p>
                </div>
              )
            )}

            {/* Persistent inline composer — teacher wizard */}
            {isInline && !disabled && (
              <div
                ref={composerRef}
                className="space-y-3 rounded-lg border border-blue-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">
                      {editingQuestion
                        ? `Edit question ${editingIndex >= 0 ? editingIndex + 1 : ""}`.trim()
                        : questionsArray.length === 0
                          ? "Add your first question"
                          : "Add next question"}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {editingQuestion
                        ? "Update this question, or cancel to add a new one."
                        : "Saves instantly — keep going for as many as you need. ⌘/Ctrl+Enter to add."}
                    </p>
                  </div>
                </div>

                {questionsArray.length === 0 && (
                  <p className="text-xs text-gray-400 -mt-1">
                    Optional — you can create the assignment without questions.
                  </p>
                )}

                {questionFields}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {editingQuestion && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cancelInlineEdit}
                    >
                      Cancel edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveQuestion("inline")}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {editingQuestion ? "Save changes" : "Add question"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : isInline ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
          <p className="text-sm text-gray-500">Preparing questions…</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
          <p className="text-sm text-gray-500">No assignment for this chapter</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Create one to add auto-graded questions students must complete.
          </p>
        </div>
      )}

      {/* Assignment Dialog — chapter variant only */}
      {!isInline && (
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsDialogOpen(true);
              return;
            }
            requestCloseAssignmentDialog();
          }}
        >
          <DialogContent className="grid max-h-[85vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
            <DialogHeader className="border-b px-6 pt-6 pb-4">
              <DialogTitle>
                {assignment ? "Edit" : "Create"} Assignment
              </DialogTitle>
              <DialogDescription>
                Set up the assignment details for {chapterName}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="assignment-title">Title *</Label>
                <Input
                  id="assignment-title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter assignment title"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignment-description">Description</Label>
                <Textarea
                  id="assignment-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter assignment description"
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-score">Maximum score</Label>
                <Input
                  id="max-score"
                  type="number"
                  min="1"
                  value={formData.max_score}
                  onChange={(e) =>
                    setFormData({ ...formData, max_score: e.target.value })
                  }
                  placeholder="100"
                />
              </div>

              <label
                htmlFor="auto-grading"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  id="auto-grading"
                  checked={formData.auto_grading_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      auto_grading_enabled: e.target.checked,
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">
                  <span className="font-medium text-gray-900">
                    Enable auto-grading
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Score submissions automatically from the correct answers you
                    set.
                  </span>
                </span>
              </label>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={requestCloseAssignmentDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveAssignment}>
                {assignment ? "Update" : "Create"} Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Question Dialog — chapter / embedded only */}
      {!isInline && (
        <Dialog
          open={isQuestionDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsQuestionDialogOpen(true);
              return;
            }
            requestCloseQuestionDialog();
          }}
        >
          <DialogContent className="grid max-h-[85vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="border-b px-6 pt-6 pb-4">
              <DialogTitle>
                {editingQuestion ? "Edit" : "Add"} Question
              </DialogTitle>
              <DialogDescription>
                {questionFormData.question_type === "MCQ"
                  ? "Create a multiple choice question — mark the correct option beside it"
                  : "Create a fill-in-the-blank question"}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              {questionFields}
            </div>

            <DialogFooter className="border-t px-6 py-4 gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={requestCloseQuestionDialog}
              >
                Cancel
              </Button>
              <div className="flex flex-wrap gap-2">
                {!editingQuestion && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSaveQuestion("add-another")}
                  >
                    Save & add another
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => handleSaveQuestion("close")}
                >
                  {editingQuestion ? "Save question" : "Add question"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );

  if (isInline) {
    return <div className="space-y-3">{bodyAndDialogs}</div>;
  }

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Assignment
            {assignment && (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-gray-400">
                ({statusDescription})
              </span>
            )}
          </h4>
          {actionButtons}
        </div>
        {bodyAndDialogs}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Assignment: {chapterName}</CardTitle>
            <CardDescription>{statusDescription}</CardDescription>
          </div>
          {actionButtons}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{bodyAndDialogs}</CardContent>
    </Card>
  );
}
