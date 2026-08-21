"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import { startImpersonation, impersonationLandingPath } from "@/lib/impersonation";

interface StudentSchool {
  id?: string;
  student_id?: string;
  school_id?: string;
  school_name?: string | null;
  grade?: string;
  section?: string;
  is_active?: boolean;
  schools?: { name?: string };
}

interface Course {
  id: string;
  name: string;
}

interface StudentCourse {
  id: string;
  student_id: string;
  course_id: string;
  progress_percentage?: number;
  courses?: { course_name?: string };
}

export interface ViewStudentDialogStudent {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  parent_name?: string;
  parent_phone?: string;
  student_schools?: Array<StudentSchool & { schools?: { name?: string } }>;
  courses?: Course[];
  student_courses?: StudentCourse[];
  progress?: number;
}

/**
 * Read-only student detail dialog — extracted from the students management
 * page's ~3300-line file. Pure display, no mutation handlers, so it carries
 * none of that page's form/import state.
 */
export default function ViewStudentDialog({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: ViewStudentDialogStudent | null;
}) {
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);

  const handleImpersonate = async () => {
    if (!student) return;
    setImpersonating(true);
    setImpersonateError(null);
    try {
      const { role } = await startImpersonation(parseInt(student.id, 10));
      window.location.href = impersonationLandingPath(role);
    } catch (e) {
      setImpersonateError(e instanceof Error ? e.message : "Failed to sign in as student");
      setImpersonating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Student Details</DialogTitle>
          <DialogDescription>View detailed information about the student</DialogDescription>
        </DialogHeader>
        {student && (
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                    <p className="text-base font-medium break-words">{student.full_name}</p>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-gray-500">Email</Label>
                    <p className="text-base break-words">{student.email}</p>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-gray-500">Student ID</Label>
                    <p className="text-base font-mono text-sm break-words">{student.id}</p>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-gray-500">Role</Label>
                    <Badge variant="outline">{student.role}</Badge>
                  </div>
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-gray-500">Created At</Label>
                    <p className="text-base">{new Date(student.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* School & Grade Information */}
            {student.student_schools && student.student_schools.length > 0 && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">School & Grade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {student.student_schools.map((assignment: StudentSchool, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {assignment.school_name || assignment.schools?.name || "Unknown School"}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline">
                                {assignment.grade?.toString().trim().toLowerCase().startsWith("grade")
                                  ? assignment.grade
                                  : `Grade ${assignment.grade}`}
                              </Badge>
                              {assignment.section && <Badge variant="outline">Section {assignment.section}</Badge>}
                            </div>
                          </div>
                          <Badge variant={assignment.is_active ? "default" : "secondary"}>
                            {assignment.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Courses Information */}
            {student.student_courses && student.student_courses.length > 0 && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {student.student_courses.map((course: StudentCourse, index: number) => (
                      <div key={index} className="p-2 border rounded">
                        <p className="font-medium">{course.courses?.course_name || "Unknown Course"}</p>
                        {course.progress_percentage !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-600">Progress</span>
                              <span className="text-sm font-medium">{course.progress_percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${course.progress_percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg">Overall Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full"
                        style={{ width: `${student.progress || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-lg font-medium">{student.progress || 0}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
              onClick={handleImpersonate}
              disabled={impersonating || !student}
            >
              {impersonating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserCog className="h-4 w-4 mr-2" />
              )}
              Sign in as this student
            </Button>
            {impersonateError && (
              <span className="text-xs text-red-600">{impersonateError}</span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
