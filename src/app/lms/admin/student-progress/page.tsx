"use client";

import { Suspense, lazy } from "react";
import { AdminTabErrorBoundary } from "@/components/admin/AdminTabErrorBoundary";
import { SkeletonDashboard } from "@/components/ui/skeleton-dashboard";

const AdminStudentProgressTab = lazy(() => import("@/components/admin/AdminStudentProgressTab"));

export default function AdminStudentProgressPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Course Progress</h1>
        <p className="mt-2 text-gray-600">System-wide course progress analytics and tracking</p>
      </div>

      <AdminTabErrorBoundary tabName="Course Progress">
        <Suspense fallback={<SkeletonDashboard />}>
          <AdminStudentProgressTab />
        </Suspense>
      </AdminTabErrorBoundary>
    </div>
  );
}
