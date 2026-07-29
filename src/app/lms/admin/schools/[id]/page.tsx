"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  School,
  Users,
  User,
  Mail,
  Phone,
  MapPin,
  Cpu,
  Clock,
  CheckCircle,
} from "lucide-react";
import { adminApi, setAuthToken } from "@/lib/api";
import { getSession } from "@/lib/session-utils";

async function ensureAccessToken(): Promise<void> {
  const { data } = await getSession();
  const token = data.session?.access_token ?? null;
  if (token) setAuthToken(token);
}

interface SchoolDetail {
  id: string;
  name: string;
  schoolCode?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  principalName?: string | null;
  schoolType?: string | null;
  isActive?: boolean;
  gradesOffered?: string[];
}

interface TeacherRow {
  id?: string;
  name?: string;
  full_name?: string;
  fullName?: string;
  email?: string;
}

interface StudentRow {
  id?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  grade?: string;
}

interface LeaveRow {
  id: string;
  status: string;
  reason?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  profiles?: { full_name?: string };
}

function useSchoolDetail(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<SchoolDetail> => {
      await ensureAccessToken();
      const { data } = await adminApi.schools.get(schoolId);
      return data as SchoolDetail;
    },
  });
}

function useSchoolTeachers(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "teachers"],
    enabled: !!schoolId,
    queryFn: async (): Promise<TeacherRow[]> => {
      await ensureAccessToken();
      const { data } = await adminApi.teachers.list({ school_id: schoolId });
      const raw = (data as Record<string, unknown>).teachers ?? (data as Record<string, unknown>).data ?? data ?? [];
      return (Array.isArray(raw) ? raw : []) as TeacherRow[];
    },
  });
}

function useSchoolStudents(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "students"],
    enabled: !!schoolId,
    queryFn: async (): Promise<StudentRow[]> => {
      await ensureAccessToken();
      const { data } = await adminApi.students.list({ school_id: schoolId, limit: 1000 });
      const raw = (data as Record<string, unknown>).students ?? (data as Record<string, unknown>).data ?? data ?? [];
      return (Array.isArray(raw) ? raw : []) as StudentRow[];
    },
  });
}

function useSchoolLeaves(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "leaves"],
    enabled: !!schoolId,
    queryFn: async (): Promise<LeaveRow[]> => {
      await ensureAccessToken();
      const { data } = await adminApi.leaves.list({ school_id: schoolId });
      const raw = (data as { leaves?: LeaveRow[] })?.leaves ?? (Array.isArray(data) ? (data as LeaveRow[]) : []);
      return raw.filter((l) => l.status === "Pending");
    },
  });
}

function useSchoolLicenses(schoolId: string) {
  return useQuery({
    queryKey: ["admin", "schools", schoolId, "licenses"],
    enabled: !!schoolId,
    queryFn: async (): Promise<Array<{ isActive?: boolean; is_active?: boolean }>> => {
      await ensureAccessToken();
      try {
        const { data } = await adminApi.licenses.list({ schoolId });
        return ((data as { licenses?: Array<{ isActive?: boolean; is_active?: boolean }> })?.licenses ?? []);
      } catch {
        return [];
      }
    },
  });
}

export default function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = use(params);
  const router = useRouter();

  const { data: school, isLoading: schoolLoading, error } = useSchoolDetail(schoolId);
  const { data: teachers = [], isLoading: teachersLoading } = useSchoolTeachers(schoolId);
  const { data: students = [], isLoading: studentsLoading } = useSchoolStudents(schoolId);
  const { data: pendingLeaves = [] } = useSchoolLeaves(schoolId);
  const { data: licenses = [] } = useSchoolLicenses(schoolId);

  useEffect(() => {
    if (error) console.error("[SchoolDetailPage] failed to load school:", error);
  }, [error]);

  const activeLicenseCount = licenses.filter((l) => l.isActive ?? l.is_active).length;

  const gradeBreakdown = students.reduce<Record<string, number>>((acc, s) => {
    const key = s.grade || "Unspecified";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  if (schoolLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md mx-auto">
          <p className="font-semibold text-red-800 mb-3">Failed to load this school.</p>
          <Button variant="outline" onClick={() => router.push("/lms/admin/schools")}>
            Back to Schools
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" style={{ backgroundColor: "#f9fafb", minHeight: "100vh" }}>
      <Link href="/lms/admin/schools" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium">
        <ArrowLeft className="h-4 w-4" />
        Back to Schools
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <School className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
              <Badge variant={school.isActive ? "default" : "secondary"}>
                {school.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {school.schoolCode ? `Code: ${school.schoolCode}` : ""}
              {school.schoolType ? ` · ${school.schoolType}` : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/lms/admin/schools")}>
          Manage in Schools
        </Button>
      </div>

      {/* Contact info */}
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          {school.principalName && (
            <div>
              <p className="text-xs text-gray-500">Principal</p>
              <p className="text-sm font-medium">{school.principalName}</p>
            </div>
          )}
          {school.email && (
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
              <p className="text-sm font-medium">{school.email}</p>
            </div>
          )}
          {school.phone && (
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p>
              <p className="text-sm font-medium">{school.phone}</p>
            </div>
          )}
          {(school.city || school.state) && (
            <div>
              <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</p>
              <p className="text-sm font-medium">{[school.city, school.state].filter(Boolean).join(", ")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xl font-bold">{teachersLoading ? "…" : teachers.length}</p>
              <p className="text-xs text-gray-500">Teachers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <User className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-xl font-bold">{studentsLoading ? "…" : students.length}</p>
              <p className="text-xs text-gray-500">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Clock className={`h-5 w-5 ${pendingLeaves.length > 0 ? "text-amber-500" : "text-gray-400"}`} />
            <div>
              <p className="text-xl font-bold">{pendingLeaves.length}</p>
              <p className="text-xs text-gray-500">Pending leaves</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Cpu className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-xl font-bold">{activeLicenseCount}</p>
              <p className="text-xs text-gray-500">Active licenses</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teachers */}
        <Card>
          <CardHeader>
            <CardTitle>Teachers</CardTitle>
            <CardDescription>{teachers.length} teacher{teachers.length !== 1 ? "s" : ""} at this school</CardDescription>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No teachers assigned yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {teachers.map((t, idx) => (
                  <div key={t.id ?? idx} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.name ?? t.full_name ?? t.fullName ?? "Unnamed"}</p>
                      <p className="text-xs text-gray-500">{t.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-right">
              <Link href="/lms/admin/teachers" className="text-xs text-blue-600 hover:underline">
                Open Teachers Management →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Students by grade */}
        <Card>
          <CardHeader>
            <CardTitle>Students by Grade</CardTitle>
            <CardDescription>{students.length} student{students.length !== 1 ? "s" : ""} enrolled</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(gradeBreakdown).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No students enrolled yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(gradeBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([grade, count]) => (
                    <div key={grade} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <span className="text-sm font-medium text-gray-700">{grade}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
              </div>
            )}
            <div className="mt-3 text-right">
              <Link href="/lms/admin/students" className="text-xs text-blue-600 hover:underline">
                Open Students Management →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending leaves */}
      {pendingLeaves.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Leave Requests</CardTitle>
            <CardDescription>Awaiting review — approved/rejected by this school&apos;s admin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingLeaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-amber-900">{l.profiles?.full_name ?? "Teacher"}</p>
                  <p className="text-xs text-amber-700">
                    {l.start_date} → {l.end_date} ({l.total_days}d){l.reason ? ` · ${l.reason}` : ""}
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-800 border-0">Pending</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pendingLeaves.length === 0 && teachers.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          No pending leave requests for this school.
        </div>
      )}
    </div>
  );
}
