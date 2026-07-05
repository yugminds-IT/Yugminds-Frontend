"use client";

import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, Medal } from "lucide-react";

export interface RankingRow {
  student_id: number;
  student_name: string;
  grade?: string;
  section?: string;
  school_name?: string;
  course_score?: number;
  daily_score?: number;
  overall_score: number;
  /** position in the full sorted list (school / platform-wide) */
  rank: number;
  school_rank?: number;
  grade_rank?: number;
  section_rank?: number;
  /** system-wide rank (admin view) */
  system_rank?: number;
  is_self?: boolean;
  badge?: string;
}

type SortKey = "rank" | "overall_score" | "course_score" | "daily_score" | "grade_rank" | "section_rank";

interface RankingTableProps {
  rows: RankingRow[];
  /** Which rank columns to show */
  showRanks?: ("school" | "grade" | "section" | "system")[];
  /** Whether to show the School column */
  showSchool?: boolean;
  /** Whether to show grade/section columns */
  showGrade?: boolean;
  /** Whether to show course/daily score columns */
  showScoreBreakdown?: boolean;
  /** Highlight the row marked is_self */
  highlightSelf?: boolean;
  title?: string;
  maxRows?: number;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const BADGE_STYLE: Record<string, string> = {
  GOLD: "bg-yellow-100 text-yellow-800 border-yellow-300",
  SILVER: "bg-gray-100 text-gray-700 border-gray-300",
  BRONZE: "bg-amber-100 text-amber-800 border-amber-300",
};

function ScoreCell({ value }: { value?: number }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const color =
    value >= 90
      ? "text-yellow-600"
      : value >= 75
      ? "text-green-700"
      : value >= 60
      ? "text-blue-700"
      : value > 0
      ? "text-amber-600"
      : "text-gray-400";
  return <span className={`font-semibold ${color}`}>{value.toFixed(1)}%</span>;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) return <span className="text-lg leading-none">{MEDAL[rank]}</span>;
  return (
    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
      #{rank}
    </span>
  );
}

export function RankingTable({
  rows,
  showRanks = ["school"],
  showSchool = false,
  showGrade = true,
  showScoreBreakdown = true,
  highlightSelf = false,
  title,
  maxRows = 100,
}: RankingTableProps) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const grades = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((r) => r.grade ?? "").filter(Boolean))).sort()],
    [rows]
  );
  const sections = useMemo(
    () => ["all", ...Array.from(new Set(rows.filter((r) => gradeFilter === "all" || r.grade === gradeFilter).map((r) => r.section ?? "").filter(Boolean))).sort()],
    [rows, gradeFilter]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.student_name.toLowerCase().includes(q) ||
          (r.school_name ?? "").toLowerCase().includes(q) ||
          (r.grade ?? "").toLowerCase().includes(q) ||
          (r.section ?? "").toLowerCase().includes(q)
      );
    }
    if (gradeFilter !== "all") list = list.filter((r) => r.grade === gradeFilter);
    if (sectionFilter !== "all") list = list.filter((r) => r.section === sectionFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = (a[sortKey] as number) ?? 0;
      const bv = (b[sortKey] as number) ?? 0;
      return (av - bv) * dir;
    });
    return list.slice(0, maxRows);
  }, [rows, search, gradeFilter, sectionFilter, sortKey, sortDir, maxRows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Render inline, not as a component, to satisfy the react-hooks/purity rule.
  const sortIcon = (k: SortKey) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />
    ) : null;

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center gap-2">
          <Medal className="h-4 w-4 text-yellow-500" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-400 ml-auto">{rows.length} students</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            placeholder="Search student, school, grade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        {showGrade && grades.length > 2 && (
          <select
            value={gradeFilter}
            onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter("all"); }}
            className="h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            {grades.map((g) => (
              <option key={g} value={g}>{g === "all" ? "All Grades" : `Grade ${g}`}</option>
            ))}
          </select>
        )}
        {showGrade && sections.length > 2 && (
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sections.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All Sections" : `Section ${s}`}</option>
            ))}
          </select>
        )}
        {filtered.length !== rows.length && (
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} shown</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No matching students</div>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                <th
                  className="px-4 py-3 text-left cursor-pointer hover:text-gray-700"
                  onClick={() => toggleSort("rank")}
                >
                  # {sortIcon("rank")}
                </th>
                <th className="px-4 py-3 text-left">Student</th>
                {showGrade && <th className="px-3 py-3 text-left">Grade</th>}
                {showGrade && <th className="px-3 py-3 text-left">Section</th>}
                {showSchool && <th className="px-3 py-3 text-left">School</th>}
                {showRanks.includes("grade") && (
                  <th
                    className="px-3 py-3 text-center cursor-pointer hover:text-gray-700"
                    onClick={() => toggleSort("grade_rank")}
                  >
                    Grade Rank {sortIcon("grade_rank")}
                  </th>
                )}
                {showRanks.includes("section") && (
                  <th
                    className="px-3 py-3 text-center cursor-pointer hover:text-gray-700"
                    onClick={() => toggleSort("section_rank")}
                  >
                    Sec Rank {sortIcon("section_rank")}
                  </th>
                )}
                {showRanks.includes("school") && (
                  <th className="px-3 py-3 text-center">School Rank</th>
                )}
                {showRanks.includes("system") && (
                  <th className="px-3 py-3 text-center">System Rank</th>
                )}
                {showScoreBreakdown && (
                  <>
                    <th
                      className="px-3 py-3 text-right cursor-pointer hover:text-gray-700"
                      onClick={() => toggleSort("course_score")}
                    >
                      Course {sortIcon("course_score")}
                    </th>
                    <th
                      className="px-3 py-3 text-right cursor-pointer hover:text-gray-700"
                      onClick={() => toggleSort("daily_score")}
                    >
                      Daily {sortIcon("daily_score")}
                    </th>
                  </>
                )}
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:text-gray-700"
                  onClick={() => toggleSort("overall_score")}
                >
                  Overall {sortIcon("overall_score")}
                </th>
                {rows.some((r) => r.badge) && <th className="px-3 py-3 text-center">Badge</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((row) => {
                const isSelf = highlightSelf && row.is_self;
                return (
                  <tr
                    key={row.student_id}
                    className={`hover:bg-gray-50/60 transition-colors ${
                      isSelf ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <RankBadge rank={row.rank} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${isSelf ? "text-blue-800" : "text-gray-900"}`}>
                        {row.student_name}
                        {isSelf && <span className="ml-2 text-xs font-normal text-blue-500">(You)</span>}
                      </span>
                    </td>
                    {showGrade && (
                      <td className="px-3 py-3">
                        {row.grade ? (
                          <span className="inline-block bg-blue-50 text-blue-700 text-[11px] font-semibold px-1.5 py-0.5 rounded">
                            {row.grade}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {showGrade && (
                      <td className="px-3 py-3">
                        {row.section ? (
                          <span className="inline-block bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-1.5 py-0.5 rounded">
                            {row.section}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {showSchool && (
                      <td className="px-3 py-3 text-xs text-gray-600 max-w-[160px] truncate">
                        {row.school_name || "—"}
                      </td>
                    )}
                    {showRanks.includes("grade") && (
                      <td className="px-3 py-3 text-center">
                        {row.grade_rank != null ? (
                          <span className="text-xs font-bold text-gray-600">#{row.grade_rank}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {showRanks.includes("section") && (
                      <td className="px-3 py-3 text-center">
                        {row.section_rank != null ? (
                          <span className="text-xs font-bold text-gray-600">#{row.section_rank}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {showRanks.includes("school") && (
                      <td className="px-3 py-3 text-center">
                        {row.school_rank != null ? (
                          <RankBadge rank={row.school_rank} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {showRanks.includes("system") && (
                      <td className="px-3 py-3 text-center">
                        {row.system_rank != null ? (
                          <RankBadge rank={row.system_rank} />
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    {showScoreBreakdown && (
                      <>
                        <td className="px-3 py-3 text-right"><ScoreCell value={row.course_score} /></td>
                        <td className="px-3 py-3 text-right"><ScoreCell value={row.daily_score} /></td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right"><ScoreCell value={row.overall_score} /></td>
                    {rows.some((r) => r.badge) && (
                      <td className="px-3 py-3 text-center">
                        {row.badge && row.badge !== "NONE" ? (
                          <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded-full ${BADGE_STYLE[row.badge] ?? ""}`}>
                            {row.badge}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
