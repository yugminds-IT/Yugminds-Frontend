"use client";

import { useState } from "react";
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
  X
} from "lucide-react";
import { generateUUID } from "../../lib/uuid-utils";
import { toast } from "@/components/ui/toast";

export interface AssignmentQuestion {
  id?: string;
  assignment_id?: string;
  question_type: 'MCQ' | 'FillBlank';
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

interface AssignmentBuilderProps {
  chapterId: string;
  chapterName: string;
  assignment: Assignment | null;
  onAssignmentChange: (assignment: Assignment | null) => void;
  disabled?: boolean;
  /** Renders without its own outer Card/title chrome when nested inside a parent
   * that already shows the chapter name (e.g. ChapterBuilderCard). */
  embedded?: boolean;
}

export function AssignmentBuilder({
  chapterId,
  chapterName,
  assignment,
  onAssignmentChange,
  disabled = false,
  embedded = false,
}: AssignmentBuilderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AssignmentQuestion | null>(null);
  const [formData, setFormData] = useState({
    title: assignment?.title || '',
    description: assignment?.description || '',
    auto_grading_enabled: assignment?.auto_grading_enabled ?? true,
    max_score: assignment?.max_score?.toString() || (assignment?.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 100).toString(),
  });
  const [questionFormData, setQuestionFormData] = useState({
    question_type: 'MCQ' as 'MCQ' | 'FillBlank',
    question_text: '',
    options: ['', '', '', ''] as string[],
    correct_answer: '',
    marks: '1',
  });
  // NOTE: Previous versions included extensive console debugging that treated
  // an empty `questions: []` as an error. Empty questions are valid for new
  // assignments, so we intentionally keep this component free of debug-only
  // console.error noise.

  const openDialog = () => {
    // Always resync, in both directions: without the else branch, opening
    // "Create Assignment" after a previous assignment was deleted left the
    // dialog pre-filled with that deleted assignment's title/description.
    if (assignment) {
      setFormData({
        title: assignment.title || '',
        description: assignment.description || '',
        auto_grading_enabled: assignment.auto_grading_enabled ?? true,
        max_score: assignment.max_score?.toString() || '100',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        auto_grading_enabled: true,
        max_score: '100',
      });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const openQuestionDialog = (question?: AssignmentQuestion) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionFormData({
        question_type: question.question_type,
        question_text: question.question_text || '',
        options: question.options || ['', '', '', ''],
        correct_answer: question.correct_answer || '',
        marks: question.marks?.toString() || '1',
      });
    } else {
      setEditingQuestion(null);
      setQuestionFormData({
        question_type: 'MCQ',
        question_text: '',
        options: ['', '', '', ''],
        correct_answer: '',
        marks: '1',
      });
    }
    setIsQuestionDialogOpen(true);
  };

  const closeQuestionDialog = () => {
    setIsQuestionDialogOpen(false);
    setEditingQuestion(null);
  };

  const handleSaveAssignment = () => {
    if (!formData.title.trim()) {
      toast.warning('Assignment title is required.');
      return;
    }
    if (!chapterId) {
      toast.error('No chapter ID provided. Please try again.');
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
      toast.error('Invalid assignment data. Please try again.');
      return;
    }

    try {
      onAssignmentChange(updatedAssignment);
    } catch {
      toast.error('Error saving assignment. Please try again.');
      return;
    }

    closeDialog();
  };

  const handleSaveQuestion = () => {
    if (!questionFormData.question_text.trim()) {
      toast.warning('Question text is required.');
      return;
    }

    if (questionFormData.question_type === 'MCQ') {
      const validOptions = questionFormData.options.filter((opt: string) => opt.trim());
      if (validOptions.length < 2) {
        toast.warning('MCQ questions must have at least 2 options.');
        return;
      }
      if (!questionFormData.correct_answer.trim()) {
        toast.warning('Please select a correct answer.');
        return;
      }
      if (!validOptions.includes(questionFormData.correct_answer)) {
        toast.warning('Correct answer must be one of the options.');
        return;
      }
    } else {
      if (!questionFormData.correct_answer.trim()) {
        toast.warning('Correct answer is required for fill-in-the-blank questions.');
        return;
      }
    }

    const marks = parseFloat(questionFormData.marks) || 1;
    const newQuestion: AssignmentQuestion = {
      ...(editingQuestion || {}),
      // Without an id, every newly-added question compared equal
      // (undefined === undefined) in the "edit" match below, so editing
      // any one of several unsaved questions silently overwrote all of
      // them, and the delete button on an unsaved question was a no-op.
      id: editingQuestion?.id || generateUUID(),
      assignment_id: assignment?.id,
      question_type: questionFormData.question_type,
      question_text: questionFormData.question_text.trim(),
      options: questionFormData.question_type === 'MCQ' ? questionFormData.options.filter((opt: string) => opt.trim()) : undefined,
      correct_answer: questionFormData.correct_answer.trim(),
      marks,
    };

    const questions = assignment?.questions || [];
    if (editingQuestion) {
      const updatedQuestions = questions.map((q: AssignmentQuestion) => 
        q.id === editingQuestion.id ? newQuestion : q
      );
      onAssignmentChange({
        ...assignment!,
        questions: updatedQuestions,
      });
    } else {
      onAssignmentChange({
        ...assignment!,
        questions: [...questions, newQuestion],
      });
    }

    closeQuestionDialog();
  };

  const [pendingDeleteQuestionId, setPendingDeleteQuestionId] = useState<string | null>(null);
  const [pendingDeleteAssignment, setPendingDeleteAssignment] = useState(false);

  const handleDeleteQuestion = (questionId: string | undefined) => {
    if (!questionId || !assignment?.questions) return;
    setPendingDeleteQuestionId(questionId);
  };

  const confirmDeleteQuestion = (questionId: string) => {
    onAssignmentChange({
      ...assignment!,
      questions: (assignment!.questions || []).filter((q: AssignmentQuestion) => q.id !== questionId),
    });
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
    setQuestionFormData({ ...questionFormData, options: newOptions });
  };

  const addOption = () => {
    setQuestionFormData({
      ...questionFormData,
      options: [...questionFormData.options, ''],
    });
  };

  const removeOption = (index: number) => {
    const newOptions = questionFormData.options.filter((_, i) => i !== index);
    setQuestionFormData({ ...questionFormData, options: newOptions });
  };

  // CRITICAL: Ensure questions is an array before calculating total marks
  const questionsForMarks = Array.isArray(assignment?.questions) ? assignment.questions : [];
  const totalMarks = questionsForMarks.reduce((sum: number, q: AssignmentQuestion) => sum + (q.marks || 0), 0) || 0;

  const statusDescription = assignment ? (
    <>
      {(() => {
        // CRITICAL: Ensure questions is an array before getting length
        const questionsArray = Array.isArray(assignment.questions) ? assignment.questions : [];
        return questionsArray.length;
      })()} question{(() => {
        const questionsArray = Array.isArray(assignment.questions) ? assignment.questions : [];
        return questionsArray.length !== 1 ? 's' : '';
      })()} •
      Total marks: {totalMarks} / {assignment.max_score}
    </>
  ) : (
    'No assignment created yet'
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
              <Button type="button" variant="destructive" size="sm" className="h-8 text-xs" onClick={confirmDeleteAssignment}>
                Delete
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPendingDeleteAssignment(false)}>
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

  const bodyAndDialogs = (
    <>
      {assignment ? (
          <>
            <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
              <h4 className="text-sm font-semibold text-gray-900">{assignment.title}</h4>
              {assignment.description && (
                <p className="mt-0.5 text-xs text-gray-600">{assignment.description}</p>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                {assignment.auto_grading_enabled ? "Auto-graded" : "Manually graded"}
                <span className="mx-1.5 text-gray-300">•</span>
                Max score {assignment.max_score}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-medium text-gray-500">Questions</Label>
                {!disabled && (
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

              {(() => {
                const questionsArray = Array.isArray(assignment.questions) ? assignment.questions : [];
                return questionsArray.length > 0;
              })() ? (
                <div className="space-y-2">
                  {(() => {
                    // CRITICAL FIX: Use normalized questionsArray instead of assignment.questions
                    const questionsArray = Array.isArray(assignment.questions) ? assignment.questions : [];
                    return questionsArray;
                  })().map((question, index) => (
                    <div
                      key={question.id || index}
                      className="group/q flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 hover:bg-gray-50/60"
                    >
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900">{question.question_text}</p>
                        <p className="mt-0.5 mb-2 text-xs text-gray-500">
                          {question.question_type === 'MCQ' ? 'Multiple choice' : 'Fill in the blank'}
                          <span className="mx-1.5 text-gray-300">•</span>
                          {question.marks} mark{question.marks !== 1 ? 's' : ''}
                        </p>
                        {question.question_type === 'MCQ' && question.options && (
                          <div className="space-y-0.5">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`text-xs ${
                                  option === question.correct_answer
                                    ? 'font-medium text-green-700'
                                    : 'text-gray-500'
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}. {option}
                                {option === question.correct_answer && (
                                  <CheckSquare className="ml-1 inline h-3 w-3" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {question.question_type === 'FillBlank' && (
                          <p className="text-xs text-gray-500">
                            Answer:{" "}
                            <span className="font-medium text-green-700">{question.correct_answer}</span>
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
                              <Button type="button" variant="destructive" size="sm" className="h-8 text-xs" onClick={() => confirmDeleteQuestion(question.id!)}>
                                Delete
                              </Button>
                              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPendingDeleteQuestionId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openQuestionDialog(question)}
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
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center">
                  <p className="text-sm text-gray-500">No questions yet</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
            <p className="text-sm text-gray-500">No assignment for this chapter</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Create one to add auto-graded questions students must complete.
            </p>
          </div>
        )}

        {/* Assignment Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="grid max-h-[85vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
            <DialogHeader className="border-b px-6 pt-6 pb-4">
              <DialogTitle>{assignment ? 'Edit' : 'Create'} Assignment</DialogTitle>
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
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter assignment title"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignment-description">Description</Label>
                <Textarea
                  id="assignment-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, auto_grading_enabled: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">
                  <span className="font-medium text-gray-900">Enable auto-grading</span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Score submissions automatically from the correct answers you set.
                  </span>
                </span>
              </label>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveAssignment}>
                {assignment ? 'Update' : 'Create'} Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Question Dialog */}
        <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
          <DialogContent className="grid max-h-[85vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
            <DialogHeader className="border-b px-6 pt-6 pb-4">
              <DialogTitle>
                {editingQuestion ? 'Edit' : 'Add'} Question
              </DialogTitle>
              <DialogDescription>
                {questionFormData.question_type === 'MCQ'
                  ? 'Create a multiple choice question'
                  : 'Create a fill-in-the-blank question'}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="question-type">Question type</Label>
                <Select
                  value={questionFormData.question_type}
                  onValueChange={(value: 'MCQ' | 'FillBlank') =>
                    setQuestionFormData({ ...questionFormData, question_type: value, options: value === 'MCQ' ? ['', '', '', ''] : [] })
                  }
                >
                  <SelectTrigger>
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
                  value={questionFormData.question_text}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                  placeholder="Enter the question"
                  rows={3}
                />
              </div>

              {questionFormData.question_type === 'MCQ' && (
                <div className="space-y-1.5">
                  <Label>Options *</Label>
                  <div className="space-y-2">
                    {questionFormData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-6 text-sm font-medium">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        />
                        {questionFormData.options.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {questionFormData.options.length < 6 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addOption}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Option
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="correct-answer">
                  Correct answer *
                  {questionFormData.question_type === 'MCQ' && ' (select from options)'}
                </Label>
                {questionFormData.question_type === 'MCQ' ? (
                  <Select
                    value={questionFormData.correct_answer}
                    onValueChange={(value) =>
                      setQuestionFormData({ ...questionFormData, correct_answer: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      {questionFormData.options
                        .filter((opt: string) => opt.trim())
                        .map((option, index) => (
                          <SelectItem key={index} value={option}>
                            {String.fromCharCode(65 + index)}. {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="correct-answer"
                    value={questionFormData.correct_answer}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, correct_answer: e.target.value })}
                    placeholder="Enter correct answer"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="question-marks">Marks</Label>
                <Input
                  id="question-marks"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={questionFormData.marks}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, marks: e.target.value })}
                  placeholder="1"
                  className="w-32"
                />
              </div>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={closeQuestionDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveQuestion}>
                {editingQuestion ? 'Update' : 'Add'} Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );

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
      <CardContent className="space-y-4">
        {bodyAndDialogs}
      </CardContent>
    </Card>
  );
}

