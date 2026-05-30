"use client";

import { Suspense, lazy } from "react";
import { useTeacherSchool } from "../context";
import { SkeletonDashboard } from "@/components/ui/skeleton-dashboard";

const StudentProgressTab = lazy(() => import("@/components/teacher/StudentProgressTab"));

export default function TeacherStudentProgressPage() {
  const { selectedSchool } = useTeacherSchool();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Student Progress</h1>
        <p className="mt-2 text-gray-600">
          Track your students&apos; course progress and completion
          {selectedSchool?.name ? ` at ${selectedSchool.name}` : ""}.
        </p>
      </div>

      <Suspense fallback={<SkeletonDashboard />}>
        <StudentProgressTab selectedSchoolId={selectedSchool?.id} />
      </Suspense>
    </div>
  );
}
