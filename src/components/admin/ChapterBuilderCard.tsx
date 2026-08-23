"use client";

import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { ChapterContentManager, type ChapterContent } from "./ChapterContentManager";
import { AssignmentBuilder, type Assignment } from "./AssignmentBuilder";

/** Shared chapter shape for the course creation wizard and course editor —
 * previously declared separately in each file and had already drifted
 * (CourseEditor had extra `contents`/`title` fields the wizard lacked). */
export interface Chapter {
  id?: string;
  course_id?: string;
  name: string;
  description?: string;
  learning_outcomes: string[];
  order_number: number;
  /** Present on chapters fetched with nested content (course-detail API response). */
  contents?: ChapterContent[];
  [key: string]: unknown;
}

interface ChapterBuilderCardProps {
  chapter: Chapter;
  chapterKey: string;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<Chapter>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  contents: ChapterContent[];
  onContentsChange: (contents: ChapterContent[]) => void;
  assignment: Assignment | null;
  onAssignmentChange: (assignment: Assignment | null) => void;
  courseId?: string;
  onVideoAdded?: (video: { chapter_id: string; title: string; video_url: string; duration?: number }) => void;
}

/**
 * One collapsed-by-default row per chapter — the header (name, at-a-glance
 * meta, controls) is always visible; the content/assignment builders only
 * mount when expanded. With several chapters each holding several content
 * items and assignment questions, keeping everything expanded made this step
 * an extremely long scroll — collapsing everything but the chapter you're
 * actively editing keeps the page short regardless of chapter count.
 *
 * Row actions are hover-revealed on pointer screens (standard course-builder
 * behaviour) but stay visible below `sm` where there is no hover.
 */
export function ChapterBuilderCard({
  chapter,
  chapterKey,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  contents,
  onContentsChange,
  assignment,
  onAssignmentChange,
  courseId,
  onVideoAdded,
}: ChapterBuilderCardProps) {
  const [pendingDelete, setPendingDelete] = useState(false);
  const hasAssignment = !!assignment;
  const chapterName = chapter.name.trim() || `Chapter ${index + 1}`;
  const questionCount = Array.isArray(assignment?.questions) ? assignment.questions.length : 0;

  return (
    <Card
      className={`group overflow-hidden border-gray-200 py-0 gap-0 shadow-sm transition-colors ${
        isExpanded ? "border-gray-300" : "hover:border-gray-300"
      }`}
    >
      {/* Header — click anywhere (outside a control) to expand/collapse.
          Not a role="button" wrapper: it contains its own focusable Input
          and Buttons, and ARIA forbids focusable descendants inside a
          button role (screen readers flatten the row and the name field
          becomes unreachable). The chevron below is the real, keyboard-
          operable expand/collapse control; this div's onClick is a mouse-
          only convenience on top of it. */}
      <div
        onClick={onToggleExpand}
        className={`flex cursor-pointer select-none items-start gap-3 p-4 transition-colors ${
          isExpanded ? "bg-gray-50/80" : "hover:bg-gray-50/60"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse chapter" : "Expand chapter"}
          className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-gray-700 group-hover:text-gray-600"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Chapter {index + 1}
          </p>
          <Input
            value={chapter.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder={`Chapter ${index + 1} name`}
            aria-label={`Chapter ${index + 1} name`}
            className="h-auto border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold shadow-none hover:border-gray-200 hover:bg-white focus-visible:bg-white"
          />
          <p className="mt-1.5 px-2 text-xs text-gray-500">
            {contents.length} content item{contents.length !== 1 ? "s" : ""}
            <span className="mx-1.5 text-gray-300">•</span>
            {hasAssignment ? (
              <span className="font-medium text-gray-700">
                Assignment ({questionCount} question{questionCount !== 1 ? "s" : ""})
              </span>
            ) : (
              "No assignment"
            )}
          </p>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className={`flex flex-shrink-0 items-center gap-0.5 transition-opacity ${
            pendingDelete
              ? "opacity-100"
              : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          }`}
        >
          {pendingDelete ? (
            <>
              <span className="mr-1 text-xs text-gray-500">Delete chapter?</span>
              <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {onMoveUp && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onMoveUp}
                  title="Move chapter up"
                  aria-label="Move chapter up"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
              {onMoveDown && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onMoveDown}
                  title="Move chapter down"
                  aria-label="Move chapter down"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingDelete(true)}
                title="Delete chapter"
                aria-label="Delete chapter"
                className="h-8 w-8 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-white">
          <div className="space-y-1.5 border-b border-gray-100 p-4">
            <Label
              htmlFor={`chapter-description-${chapterKey}`}
              className="text-xs font-medium text-gray-500"
            >
              Description
            </Label>
            <Textarea
              id={`chapter-description-${chapterKey}`}
              value={chapter.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="What this chapter covers (optional)"
              rows={2}
            />
          </div>

          <div className="border-b border-gray-100 p-4">
            <ChapterContentManager
              chapterId={chapterKey}
              chapterName={chapterName}
              contents={contents}
              onContentsChange={onContentsChange}
              courseId={courseId}
              onVideoAdded={onVideoAdded}
              embedded
            />
          </div>

          <div className="p-4">
            <AssignmentBuilder
              chapterId={chapterKey}
              chapterName={chapterName}
              assignment={assignment}
              onAssignmentChange={onAssignmentChange}
              embedded
            />
          </div>
        </div>
      )}
    </Card>
  );
}
