"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Fragment, useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Users, BookOpen, TrendingUp, CheckCircle2, AlertCircle, School, GraduationCap, Globe,
  Search, ChevronUp, ChevronDown, ChevronRight, ChevronLeft,
  CheckCircle, Clock, PlayCircle, RefreshCw,
} from "lucide-react";
import { useAdminStudentProgress } from "../../hooks/useStudentProgress";

type StudentSortKey = "full_name" | "school_name" | "grade" | "section" | "total_courses" | "completed_courses" | "in_progress_courses" | "average_progress" | "last_activity";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

function ProgressBar({ value, barColor = "bg-blue-500" }: { value: number; barColor?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-9 text-right shrink-0">{value}%</span>
    </div>
  );
}

export default function AdminStudentProgressTab() {
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [sortKey, setSortKey] = useState<StudentSortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch } = useAdminStudentProgress({
    schoolId: schoolId !== "all" ? schoolId : undefined,
    courseId: courseId !== "all" ? courseId : undefined,
    grade: grade !== "all" ? grade : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const students = useMemo(() => data?.students ?? [], [data]);
  const schools = data?.schools ?? [];
  const courses = data?.courses ?? [];
  const summary = data?.summary;
  const pagination = data?.pagination;

  const sections = useMemo(
    () => [...new Set(students.map((s: any) => s.section).filter(Boolean))].sort() as string[],
    [students]
  );
  const grades = useMemo(
    () => [...new Set(students.map((s: any) => s.grade).filter(Boolean))].sort() as string[],
    [students]
  );

  const studentRows = useMemo(() => {
    const filtered = students.filter((s: any) => {
      const q = search.toLowerCase();
      return (
        (!q ||
          s.full_name?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.school_name?.toLowerCase().includes(q)) &&
        (section === "all" || s.section === section)
      );
    });
    return [...filtered].sort((a: any, b: any) => {
      let av: any = a[sortKey] ?? "";
      let bv: any = b[sortKey] ?? "";
      if (sortKey === "last_activity") {
        av = av ? +new Date(av) : 0;
        bv = bv ? +new Date(bv) : 0;
      } else if (typeof av === "string") {
        av = av.toLowerCase();
        bv = String(bv).toLowerCase();
      }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [students, search, section, sortKey, sortDir]);

  const gradeRows = useMemo(() => {
    const gradeSet = [...new Set(students.map((s: any) => s.grade).filter(Boolean))].sort() as string[];
    return gradeSet.map((g) => {
      const gs = students.filter((s: any) => s.grade === g);
      const avg = gs.length
        ? Math.round(gs.reduce((sum: number, s: any) => sum + (s.average_progress ?? 0), 0) / gs.length)
        : 0;
      return {
        grade: g,
        students: gs.length,
        completed: gs.filter((s: any) => s.average_progress === 100).length,
        avgProgress: avg,
      };
    });
  }, [students]);

  const sort = (key: StudentSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: StudentSortKey }) =>
    sortKey === col
      ? sortDir === "asc"
        ? <ChevronUp className="h-3 w-3 text-blue-600" />
        : <ChevronDown className="h-3 w-3 text-blue-600" />
      : <ChevronUp className="h-3 w-3 text-gray-300" />;

  const statusMeta = (p: number) =>
    p === 100
      ? { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", bar: "bg-emerald-500" }
      : p > 0
      ? { label: "In Progress", cls: "bg-blue-50 text-blue-700 border border-blue-200", bar: "bg-blue-500" }
      : { label: "Not Started", cls: "bg-gray-50 text-gray-500 border border-gray-200", bar: "bg-gray-300" };

  const courseIcon = (status: string) =>
    status === "completed" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
    : status === "in_progress" ? <PlayCircle className="h-3.5 w-3.5 text-blue-500" />
    : <Clock className="h-3.5 w-3.5 text-gray-400" />;

  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 0;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100" />)}
        </div>
        <div className="h-12 rounded-xl bg-gray-100" />
        <div className="h-64 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-red-100 bg-red-50">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
          <p className="text-sm font-medium text-red-700">Failed to load student progress</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-3 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Total Students", value: summary?.total_students ?? 0, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Active Students", value: summary?.students_with_progress ?? 0, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Completed", value: summary?.students_completed ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "System Average", value: `${summary?.average_system_progress ?? 0}%`, icon: Globe, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Total Schools", value: summary?.total_schools ?? 0, icon: School, color: "text-pink-600", bg: "bg-pink-50" },
    { label: "Total Courses", value: summary?.total_courses ?? 0, icon: BookOpen, color: "text-cyan-600", bg: "bg-cyan-50" },
  ];

  const studentCols: { key?: StudentSortKey; label: string; center?: boolean }[] = [
    { label: "" },
    { key: "full_name", label: "Student" },
    { key: "school_name", label: "School" },
    { key: "grade", label: "Grade" },
    { key: "section", label: "Section" },
    { key: "total_courses", label: "Courses", center: true },
    { key: "completed_courses", label: "Completed", center: true },
    { key: "in_progress_courses", label: "In Progress", center: true },
    { key: "average_progress", label: "Progress" },
    { key: "last_activity", label: "Last Active" },
    { label: "Status" },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className={`${bg} ${color} p-2.5 rounded-lg shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Global Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or school…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={schoolId} onValueChange={(v) => { setSchoolId(v); setPage(0); }}>
          <SelectTrigger className="w-[190px] h-9"><SelectValue placeholder="All Schools" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schools.map((s: any) => (
              <SelectItem key={s.school_id} value={s.school_id}>{s.school_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={grade} onValueChange={(v) => { setGrade(v); setPage(0); }}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="All Grades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {grades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="All Sections" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={courseId} onValueChange={(v) => { setCourseId(v); setPage(0); }}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c: any) => (
              <SelectItem key={c.course_id} value={c.course_id}>{c.course_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList className="border border-gray-200 bg-gray-50 p-1 rounded-lg h-auto">
          <TabsTrigger value="students" className="gap-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" /> Students
          </TabsTrigger>
          <TabsTrigger value="schools" className="gap-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <School className="h-3.5 w-3.5" /> Schools
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BookOpen className="h-3.5 w-3.5" /> Courses
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <GraduationCap className="h-3.5 w-3.5" /> Grades
          </TabsTrigger>
        </TabsList>

        {/* ── Students ── */}
        <TabsContent value="students" className="space-y-3">
          {pagination && (
            <p className="text-xs text-gray-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, pagination.total)} of {pagination.total} students
            </p>
          )}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    {studentCols.map((col) => (
                      <th
                        key={col.label}
                        onClick={() => col.key && sort(col.key)}
                        className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.center ? "text-center" : "text-left"} ${col.key ? "cursor-pointer hover:text-gray-800 select-none" : ""}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.key && <SortIcon col={col.key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {studentRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center">
                        <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-400">
                          {search ? "No students match your search" : "No students in the system yet"}
                        </p>
                      </td>
                    </tr>
                  ) : studentRows.map((s: any, idx: number) => {
                    const meta = statusMeta(s.average_progress ?? 0);
                    const isOpen = expanded === s.student_id;
                    return (
                      <Fragment key={s.student_id}>
                        <tr
                          onClick={() => setExpanded(isOpen ? null : s.student_id)}
                          className={`border-b border-gray-50 cursor-pointer hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                        >
                          <td className="pl-4 pr-2 py-3 w-8">
                            <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 leading-tight">{s.full_name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{s.email}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={s.school_name}>
                            {s.school_name || "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{s.grade || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{s.section || "—"}</td>
                          <td className="px-4 py-3 text-center font-medium text-gray-700">{s.total_courses ?? 0}</td>
                          <td className="px-4 py-3 text-center font-semibold text-emerald-600">{s.completed_courses ?? 0}</td>
                          <td className="px-4 py-3 text-center font-semibold text-blue-600">{s.in_progress_courses ?? 0}</td>
                          <td className="px-4 py-3">
                            <ProgressBar value={s.average_progress ?? 0} barColor={meta.bar} />
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {s.last_activity
                              ? new Date(s.last_activity).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/60 border-b border-gray-100">
                            <td colSpan={11} className="px-8 py-4">
                              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                Course Breakdown
                              </p>
                              {s.courses?.length > 0 ? (
                                <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                                  <thead>
                                    <tr className="bg-white border-b border-gray-100">
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Course</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Chapters</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Progress</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {s.courses.slice(0, 5).map((c: any) => (
                                      <tr key={c.course_id} className="border-t border-gray-50 bg-white hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5 font-medium text-gray-800">{c.course_name}</td>
                                        <td className="px-4 py-2.5 text-gray-500">{c.completed_chapters}/{c.total_chapters}</td>
                                        <td className="px-4 py-2.5">
                                          <ProgressBar value={c.progress_percentage} barColor="bg-blue-400" />
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                                            {courseIcon(c.status)}
                                            <span className="capitalize">{c.status?.replace("_", " ") || "—"}</span>
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                    {s.courses.length > 5 && (
                                      <tr className="border-t border-gray-50 bg-white">
                                        <td colSpan={4} className="px-4 py-2 text-xs text-gray-400 text-center italic">
                                          +{s.courses.length - 5} more courses
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-gray-400 italic">No course data available</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Page {page + 1} of {totalPages}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  className="h-8 gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore}
                  className="h-8 gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Schools ── */}
        <TabsContent value="schools">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    {["School", "Total Students", "Avg Progress"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schools.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-16 text-center">
                        <School className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-400">No schools found</p>
                      </td>
                    </tr>
                  ) : schools.map((s: any, idx: number) => (
                    <tr key={s.school_id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.school_name}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{s.total_students}</td>
                      <td className="px-4 py-3"><ProgressBar value={s.average_progress ?? 0} barColor="bg-blue-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Courses ── */}
        <TabsContent value="courses">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    {["Course", "Chapters", "Enrolled", "Completed", "Avg Progress", "Completion Rate"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-400">No courses found</p>
                      </td>
                    </tr>
                  ) : courses.map((c: any, idx: number) => (
                    <tr key={c.course_id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.course_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-center">{c.total_chapters}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium text-center">{c.enrolled_students}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold text-center">{c.completed_students}</td>
                      <td className="px-4 py-3"><ProgressBar value={c.average_progress ?? 0} barColor="bg-blue-500" /></td>
                      <td className="px-4 py-3"><ProgressBar value={c.completion_rate ?? 0} barColor="bg-emerald-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Grades ── */}
        <TabsContent value="grades">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    {["Grade", "Total Students", "Completed", "Remaining", "Avg Progress"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradeRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <GraduationCap className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-400">No grade data available</p>
                      </td>
                    </tr>
                  ) : gradeRows.map((g, idx) => (
                    <tr key={g.grade} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 font-semibold text-gray-900">{g.grade}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{g.students}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold">{g.completed}</td>
                      <td className="px-4 py-3 text-gray-500">{g.students - g.completed}</td>
                      <td className="px-4 py-3"><ProgressBar value={g.avgProgress} barColor="bg-violet-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
