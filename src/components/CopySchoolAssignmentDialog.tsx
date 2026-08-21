"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type AssignedSchool = { schoolId?: string; school_id?: string; schoolName?: string; school_name?: string };

export type CopySourceTeacher = {
  id: string | number;
  nameDisplay?: string;
  name?: string;
  full_name?: string;
  assignedSchools?: AssignedSchool[];
  teacher_schools?: AssignedSchool[];
};

export type CopyTargetTeacher = {
  id: string | number;
  nameDisplay?: string;
  name?: string;
  full_name?: string;
};

/**
 * Picks which of the source teacher's schools to copy, and who to copy them
 * to — then hands off to `onConfirm`, which pre-fills the target teacher's
 * Edit Teacher form with that data as a DRAFT (grades, sections, subjects,
 * working days). Nothing is written here or by this dialog: the admin
 * reviews the pre-filled Edit Teacher screen (which already surfaces
 * section-conflict and working-day-overlap warnings) and saves it
 * themselves via the existing "Update Teacher" flow. The source teacher's
 * own assignment is never touched.
 */
export default function CopySchoolAssignmentDialog({
  open,
  onClose,
  sourceTeacher,
  teachers,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  sourceTeacher: CopySourceTeacher | null;
  teachers: CopyTargetTeacher[];
  onConfirm: (schoolIds: string[], targetTeacherId: string) => void;
}) {
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [targetTeacherId, setTargetTeacherId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSelectedSchoolIds([]);
      setTargetTeacherId("");
    }
  }, [open, sourceTeacher?.id]);

  if (!sourceTeacher) return null;

  const sourceName = sourceTeacher.nameDisplay ?? sourceTeacher.name ?? sourceTeacher.full_name ?? "This teacher";
  const schools = (sourceTeacher.assignedSchools ?? sourceTeacher.teacher_schools ?? []).map((s) => ({
    id: s.schoolId ?? s.school_id ?? "",
    name: s.schoolName ?? s.school_name ?? "",
  })).filter((s) => s.id);

  const targetOptions = teachers.filter((t) => String(t.id) !== String(sourceTeacher.id));

  const toggleSchool = (schoolId: string) => {
    setSelectedSchoolIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId],
    );
  };

  const canConfirm = selectedSchoolIds.length > 0 && !!targetTeacherId;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy school assignment</DialogTitle>
          <DialogDescription>
            Pick which of {sourceName}&apos;s schools to copy and who to copy them to.
            {sourceName}&apos;s own assignment stays exactly as-is — you&apos;ll review the
            copied grades, sections, subjects, and working days on the target teacher&apos;s
            Edit screen before saving, so you can resolve any conflicts (e.g. a section
            already claimed, or overlapping working days at another school) yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Schools to copy</Label>
            {schools.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">{sourceName} isn&apos;t assigned to any schools.</p>
            ) : (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {schools.map((school) => (
                  <div key={school.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`copy-school-${school.id}`}
                      checked={selectedSchoolIds.includes(school.id)}
                      onCheckedChange={() => toggleSchool(school.id)}
                    />
                    <Label htmlFor={`copy-school-${school.id}`} className="flex-1 cursor-pointer">
                      {school.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Copy to teacher</Label>
            <Select value={targetTeacherId} onValueChange={setTargetTeacherId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((t) => (
                  <SelectItem key={String(t.id)} value={String(t.id)}>
                    {t.nameDisplay ?? t.name ?? t.full_name ?? `Teacher ${t.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedSchoolIds, targetTeacherId)}
            disabled={!canConfirm}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
