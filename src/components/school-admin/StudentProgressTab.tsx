"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Fragment, useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Users, BookOpen, TrendingUp, CheckCircle2, AlertCircle, School, GraduationCap,
  Search, ChevronUp, ChevronDown, ChevronRight,
  CheckCircle, Clock, PlayCircle, RefreshCw,
} from "lucide-react";
import { useSchoolAdminStudentProgress, type SchoolAdminProgressResponse } from "../../hooks/useStudentProgress";

type StudentSortKey = "full_name" | "grade" | "section" | "total_courses" | "completed_courses" | "in_progress_courses" | "average_progress" | "last_activity";
type SortDir = "asc" | "desc";
type CourseFromAPI = SchoolAdminProgressResponse["courses"][number];

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

export default function StudentProgressTab() {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [grade, setGrade] = useState("all");
  const [course, setCourse] = useState("all");
  const [sortKey, setSortKey] = useState<StudentSortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useSchoolAdminStudentProgress({
    courseId: course !== "all" ? course : undefined,
    grade: grade !== "all" ? grade : undefined,
    section: section !== "all" ? section : undefined,
  });

  const students = useMemo(() => data?.students ?? [], [data]);
  const summary = data?.summary;

  const courses = useMemo(() => {
    const map = new Map<string, CourseFromAPI>();
    (data?.courses ?? []).forEach((c: CourseFromAPI) => { if (!map.has(c.course_id)) map.set(c.course_id, c); });
    return Array.from(map.values());
  }, [data?.courses]);

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
        (!q || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)) &&
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

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100" />)}
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
    { label: "School Average", value: `${summary?.average_school_progress ?? 0}%`, icon: School, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Active Courses", value: summary?.total_courses ?? 0, icon: BookOpen, color: "text-pink-600", bg: "bg-pink-50" },
  ];

  const studentCols: { key?: StudentSortKey; label: string; center?: boolean }[] = [
    { label: "" },
    { key: "full_name", label: "Student" },
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList className="border border-gray-200 bg-gray-50 p-1 rounded-lg h-auto">
          <TabsTrigger value="students" className="gap-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" /> Students
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BookOpen className="h-3.5 w-3.5" /> Courses
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <GraduationCap className="h-3.5 w-3.5" /> Grades
          </TabsTrigger>
        </TabsList>

        {/* ── Students ── */}
        <TabsContent value="students" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={grade} onValueChange={setGrade}>
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
            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All Courses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c: CourseFromAPI) => (
                  <SelectItem key={c.course_id} value={c.course_id}>{c.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
              {studentRows.length} student{studentRows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Student Table */}
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
                      <td colSpan={10} className="py-16 text-center">
                        <Users className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-400">
                          {search ? "No students match your search" : "No students enrolled yet"}
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
                            <td colSpan={10} className="px-8 py-4">
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
                                    {s.courses.map((c: any) => (
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
        </TabsContent>

        {/* ── Courses ── */}
        <TabsContent value="courses">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    {["Course", "Grade", "Chapters", "Enrolled", "Completed", "Avg Progress", "Completion Rate"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-400">No courses found</p>
                      </td>
                    </tr>
                  ) : courses.map((c: CourseFromAPI, idx: number) => (
                    <tr key={c.course_id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.course_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.grade}</td>
                      <td className="px-4 py-3 text-gray-600 text-center">{c.total_chapters}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium text-center">{c.enrolled_students}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold text-center">{c.completed_students}</td>
                      <td className="px-4 py-3"><ProgressBar value={c.average_progress} barColor="bg-blue-500" /></td>
                      <td className="px-4 py-3"><ProgressBar value={c.completion_rate} barColor="bg-emerald-500" /></td>
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
