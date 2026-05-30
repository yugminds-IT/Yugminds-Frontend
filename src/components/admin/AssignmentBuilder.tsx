"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { 
  Plus, 
  Edit, 
  Trash2, 
  CheckSquare,
  X,
  GripVertical
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
}

export function AssignmentBuilder({
  chapterId,
  chapterName,
  assignment,
  onAssignmentChange,
  disabled = false,
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
    if (assignment) {
      setFormData({
        title: assignment.title || '',
        description: assignment.description || '',
        auto_grading_enabled: assignment.auto_grading_enabled ?? true,
        max_score: assignment.max_score?.toString() || '100',
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Assignment: {chapterName}</CardTitle>
            <CardDescription>
              {assignment ? (
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
              )}
            </CardDescription>
          </div>
          {!disabled && (
            <div className="flex gap-2">
              {assignment ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openDialog}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {pendingDeleteAssignment ? (
                    <>
                      <Button type="button" variant="destructive" size="sm" onClick={confirmDeleteAssignment}>
                        Confirm Delete
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setPendingDeleteAssignment(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteAssignment();
                      }}
                      title="Delete assignment"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openDialog}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Assignment
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignment ? (
          <>
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-1">{assignment.title}</h4>
              {assignment.description && (
                <p className="text-sm text-gray-600">{assignment.description}</p>
              )}
              <div className="flex gap-2 mt-2">
                <Badge variant={assignment.auto_grading_enabled ? "default" : "secondary"}>
                  {assignment.auto_grading_enabled ? "Auto-grading enabled" : "Manual grading"}
                </Badge>
                <Badge variant="outline">Max score: {assignment.max_score}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Questions</Label>
                {!disabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openQuestionDialog()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
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
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <GripVertical className="h-5 w-5 text-gray-400 mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">Q{index + 1}</span>
                          <Badge variant="secondary" className="text-xs">
                            {question.question_type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {question.marks} mark{question.marks !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{question.question_text}</p>
                        {question.question_type === 'MCQ' && question.options && (
                          <div className="space-y-1 ml-4">
                            {question.options.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className={`text-sm ${
                                  option === question.correct_answer
                                    ? 'text-green-600 font-medium'
                                    : 'text-gray-600'
                                }`}
                              >
                                {String.fromCharCode(65 + optIndex)}. {option}
                                {option === question.correct_answer && (
                                  <CheckSquare className="h-3 w-3 inline ml-1" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {question.question_type === 'FillBlank' && (
                          <div className="ml-4 text-sm">
                            <span className="text-gray-600">Correct answer: </span>
                            <span className="font-medium text-green-600">{question.correct_answer}</span>
                          </div>
                        )}
                      </div>
                      {!disabled && (
                        <div className="flex gap-1 items-center">
                          {pendingDeleteQuestionId === question.id ? (
                            <>
                              <Button type="button" variant="destructive" size="sm" onClick={() => confirmDeleteQuestion(question.id!)}>
                                Confirm
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setPendingDeleteQuestionId(null)}>
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
                <div className="text-sm text-gray-500 text-center py-4">
                  <p>No questions added yet. Click &quot;Add Question&quot; to get started.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No assignment created for this chapter yet.
          </p>
        )}

        {/* Assignment Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{assignment ? 'Edit' : 'Create'} Assignment</DialogTitle>
              <DialogDescription>
                Set up the assignment details for {chapterName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="assignment-title">Title *</Label>
                <Input
                  id="assignment-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter assignment title"
                />
              </div>

              <div>
                <Label htmlFor="assignment-description">Description</Label>
                <Textarea
                  id="assignment-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter assignment description"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-grading"
                  checked={formData.auto_grading_enabled}
                  onChange={(e) => setFormData({ ...formData, auto_grading_enabled: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="auto-grading" className="cursor-pointer">
                  Enable auto-grading
                </Label>
              </div>

              <div>
                <Label htmlFor="max-score">Maximum Score</Label>
                <Input
                  id="max-score"
                  type="number"
                  min="1"
                  value={formData.max_score}
                  onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                  placeholder="100"
                />
              </div>
            </div>

            <DialogFooter>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? 'Edit' : 'Add'} Question
              </DialogTitle>
              <DialogDescription>
                {questionFormData.question_type === 'MCQ' 
                  ? 'Create a multiple choice question'
                  : 'Create a fill-in-the-blank question'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="question-type">Question Type</Label>
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

              <div>
                <Label htmlFor="question-text">Question Text *</Label>
                <Textarea
                  id="question-text"
                  value={questionFormData.question_text}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                  placeholder="Enter the question"
                  rows={3}
                />
              </div>

              {questionFormData.question_type === 'MCQ' && (
                <div>
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

              <div>
                <Label htmlFor="correct-answer">
                  Correct Answer *
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

              <div>
                <Label htmlFor="question-marks">Marks</Label>
                <Input
                  id="question-marks"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={questionFormData.marks}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, marks: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeQuestionDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveQuestion}>
                {editingQuestion ? 'Update' : 'Add'} Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

