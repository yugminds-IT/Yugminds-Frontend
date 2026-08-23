"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import { adminApi } from "../../lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import { CoursePublishTargets, type SchoolTarget } from "./CoursePublishTargets";

interface CoursePublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: {
    id: string;
    name: string;
    status: 'Draft' | 'Published' | 'Archived';
    is_published?: boolean;
    /** Structured school → grade → section targeting from the course DTO. */
    access?: SchoolTarget[];
  };
  onPublishChange: () => void;
}

export function CoursePublishDialog({
  open,
  onOpenChange,
  course,
  onPublishChange,
}: CoursePublishDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changesSummary, setChangesSummary] = useState("");
  const [targets, setTargets] = useState<SchoolTarget[]>([]);

  const isPublished = course.status === 'Published' || course.is_published === true;

  // Rehydrate the picker from the course's current targeting each time it opens.
  useEffect(() => {
    if (open) {
      setTargets(
        (course.access ?? []).map((t) => ({
          school_id: t.school_id,
          grades: (t.grades ?? []).map((g) => ({
            grade: g.grade,
            sections: g.sections ?? [],
          })),
        })),
      );
      setError(null);
      setChangesSummary("");
    }
  }, [open, course.access]);

  const totalSchools = targets.length;
  const reset = () => {
    setError(null);
    setChangesSummary("");
  };

  // Save targeting (setAccess) then publish. Works for a first publish and for
  // re-publishing an already-live course with edited targeting.
  const handlePublish = async () => {
    if (targets.length === 0) {
      setError("Select at least one school to publish to.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await adminApi.courses.setAccess(course.id, {
        access: targets.map((t) => ({
          school_id: t.school_id,
          grades: t.grades.map((g) => ({ grade: g.grade, sections: g.sections })),
        })),
      });
      await adminApi.courses.publish(course.id, {
        publish: true,
        changes_summary: changesSummary.trim() || undefined,
      });
      onPublishChange();
      onOpenChange(false);
      reset();
      toast.success(
        isPublished ? "Course targeting updated & re-published." : "Course published.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish course");
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);
    setError(null);
    try {
      await adminApi.courses.publish(course.id, { publish: false });
      onPublishChange();
      onOpenChange(false);
      reset();
      toast.success("Course unpublished — students can no longer see it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unpublish course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="grid max-h-[85vh] w-[calc(100vw-2rem)] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-green-600" />
            Publish to Schools, Grades &amp; Sections
          </DialogTitle>
          <DialogDescription>
            Choose exactly which schools, grades and sections receive{" "}
            <strong>{course.name}</strong>, then publish. Students matching your
            selection are enrolled immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Badge variant={isPublished ? "default" : "secondary"}>{course.status}</Badge>
            {isPublished && (
              <span className="text-xs text-gray-500">
                Editing targeting and re-publishing enrolls newly-matching students.
              </span>
            )}
          </div>

          <CoursePublishTargets value={targets} onChange={setTargets} />

          <div>
            <Label htmlFor="changes-summary">Changes summary (optional)</Label>
            <Textarea
              id="changes-summary"
              value={changesSummary}
              onChange={(e) => setChangesSummary(e.target.value)}
              placeholder="Describe what's new in this version…"
              rows={2}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Saved to version history alongside a snapshot of the content and targeting.
            </p>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
            Publishing to <strong>{totalSchools}</strong> school{totalSchools === 1 ? "" : "s"}.
            A grade with no sections chosen reaches the whole grade; a school with no grades
            chosen reaches every student in that school.
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:gap-2">
          {isPublished && (
            <Button
              type="button"
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50 mr-auto"
              onClick={handleUnpublish}
              disabled={loading}
            >
              <EyeOff className="h-4 w-4 mr-2" />
              Unpublish
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => { onOpenChange(false); reset(); }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handlePublish} disabled={loading || targets.length === 0}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isPublished ? "Updating…" : "Publishing…"}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isPublished ? "Update & Re-publish" : "Publish Course"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
