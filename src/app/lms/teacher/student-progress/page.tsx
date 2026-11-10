"use client";

import StudentProgressTab from "@/components/teacher/StudentProgressTab";
import { useTeacherSchool } from "../context";

export default function TeacherStudentProgressPage() {
  const { selectedSchool } = useTeacherSchool();
  return <StudentProgressTab selectedSchoolId={selectedSchool?.id} schoolName={selectedSchool?.name} />;
}
