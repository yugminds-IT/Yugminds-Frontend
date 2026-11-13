"use client";

import { useMemo, useState, type ReactNode } from "react";
import { teacherApi } from "@/lib/api/teacher.api";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import Modal from "../../portal/Modal";
import "./assignments.css"; // dialog styles: this dialog is also opened outside the assignments page
import type {
  TeacherAssignment,
  StudentRow,
  NotSubmittedStudent,
  Submission,
} from "./assignments-shared";

/** One band of a grading scale: a percentage at or above `min` earns `label`/`points`. */
export type ScaleBand = { min: number; label: string; points: number };

export const CBSE_SCALE: ScaleBand[] = [
  { min: 91, label: "A1", points: 10 },
  { min: 81, label: "A2", points: 9 },
  { min: 71, label: "B1", points: 8 },
  { min: 61, label: "B2", points: 7 },
  { min: 51, label: "C1", points: 6 },
  { min: 41, label: "C2", points: 5 },
  { min: 35, label: "D1", points: 4 },
  { min: 0, label: "D2", points: 3 },
];

const STORAGE_KEY = "yugminds.reportGradeScale";

/** Band with the highest `min` the percentage reaches (scale sorted desc). */
export function bandFor(pct: number, scale: ScaleBand[]): ScaleBand | null {
  return scale.find((b) => pct >= b.min) ?? null;
}

const sortScale = (s: ScaleBand[]) => [...s].sort((a, b) => b.min - a.min);

function scaleError(s: ScaleBand[]): string | null {
  if (!s.length) return "Add at least one row";
  if (s.some((b) => !b.label.trim())) return "Every row needs a grade";
  if (s.some((b) => !Number.isFinite(b.min) || b.min < 0 || b.min > 100))
    return "Min % must be between 0 and 100";
  if (s.some((b) => !Number.isFinite(b.points))) return "Points must be a number";
  if (new Set(s.map((b) => b.min)).size !== s.length) return "Min % values must be unique";
  if (new Set(s.map((b) => b.label.trim().toLowerCase())).size !== s.length)
    return "Grades must be unique";
  if (!s.some((b) => b.min === 0)) return "One row must start at 0% so every score gets a grade";
  return null;
}

function loadCustom(): ScaleBand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ScaleBand[]) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* storage unavailable — fall through */
  }
  return CBSE_SCALE.map((b) => ({ ...b }));
}

const rangeOf = (scale: ScaleBand[], i: number) => {
  const upper = i === 0 ? 100 : scale[i - 1].min - 1;
  return `${scale[i].min}-${upper}`;
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN") : "";

const PASS_MARK = 40; // same line the exam analytics use for "passed"
const NAVY = "FF0A1F4D";
const WASH = "FFEEF3FC";
const LINE = "FFD3DCEF";
const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const hairline = { style: "thin" as const, color: { argb: LINE } };

/** Green for the top of the scale, amber in the middle, red at the bottom. */
function tone(i: number, n: number): { bg: string; fg: string } {
  const r = n > 1 ? i / (n - 1) : 0;
  if (r < 0.34) return { bg: "FFD1FAE5", fg: "FF065F46" };
  if (r < 0.75) return { bg: "FFFEF3C7", fg: "FF92400E" };
  return { bg: "FFFEE2E2", fg: "FF991B1B" };
}

type Line = {
  name: string;
  grade: string;
  section: string;
  status: "Graded" | "Awaiting grading" | "Not submitted";
  score: number | null;
  pct: number | null;
  attempts: number | null;
  submitted: string;
  letter: string;
  points: number | null;
};

/** One line per targeted student: submitted or not, with the grade from the chosen scale. */
function buildLines(rows: StudentRow[], missing: NotSubmittedStudent[], scale: ScaleBand[] | null): Line[] {
  const lines: Line[] = [
    ...rows.map((r): Line => {
      const b = r.best;
      const exact = b && b.max_score ? (b.score! / b.max_score) * 100 : null;
      // Grade from the exact %: rounding 90.96 up to 91.0 would wrongly give A1.
      const band = exact != null && scale ? bandFor(exact, scale) : null;
      return {
        name: r.student_name,
        grade: r.grade ?? "",
        section: r.section ?? "",
        status: b ? "Graded" : "Awaiting grading",
        score: b?.score ?? null,
        pct: exact != null ? Math.round(exact * 10) / 10 : null,
        attempts: r.attempts.length,
        submitted: fmtDate(r.latest.submitted_at),
        letter: band?.label ?? "",
        points: band?.points ?? null,
      };
    }),
    ...missing.map((m): Line => ({
      name: m.student_name,
      grade: m.grade ?? "",
      section: m.section ?? "",
      status: "Not submitted",
      score: null,
      pct: null,
      attempts: null,
      submitted: "",
      letter: "",
      points: null,
    })),
  ];
  const classOf = (l: Line) => [l.grade, l.section].filter(Boolean).join("-") || "—";
  return lines.sort(
    (a, b) => classOf(a).localeCompare(classOf(b), undefined, { numeric: true }) || a.name.localeCompare(b.name),
  );
}
const classOf = (l: Line) => [l.grade, l.section].filter(Boolean).join("-") || "—";
const mean = (ns: (number | null)[], digits = 0) => {
  const p = ns.filter((n): n is number => n != null);
  if (!p.length) return null;
  const f = 10 ** digits;
  return Math.round((p.reduce((a, b) => a + b, 0) / p.length) * f) / f;
};

/** Designed marks report: a Summary cover sheet and a Students sheet, every targeted student included. */
async function downloadAssignmentReport(
  assignment: TeacherAssignment,
  rows: StudentRow[],
  missing: NotSubmittedStudent[],
  scale: ScaleBand[] | null,
  scaleName: string,
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const isExam = assignment.assignment_type === "EXAM";
  const total = assignment.total_marks ?? rows.find((r) => r.best)?.best?.max_score ?? null;
  const lines = buildLines(rows, missing, scale);
  const graded = lines.filter((l) => l.pct != null);
  const sat = lines.filter((l) => l.status !== "Not submitted").length;
  const when = isExam
    ? [assignment.starts_at, assignment.ends_at].map(fmtDate).join(" to ")
    : assignment.due_date
      ? `Due ${new Date(assignment.due_date).toLocaleDateString("en-IN")}`
      : "";

  // ---------- Summary (cover) ----------
  const sum = workbook.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  sum.columns = Array.from({ length: 6 }, () => ({ width: 19 }));
  sum.mergeCells("A1:F1");
  sum.getCell("A1").value = assignment.title;
  sum.getCell("A1").font = { name: "Calibri", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  sum.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  sum.getRow(1).height = 40;
  sum.mergeCells("A2:F2");
  sum.getCell("A2").value = [isExam ? "Exam report" : "Assignment report", assignment.subject, when].filter(Boolean).join("   ·   ");
  sum.getCell("A2").font = { size: 11, color: { argb: "FFBCCAF0" } };
  sum.getCell("A2").alignment = { vertical: "middle", indent: 1 };
  sum.getRow(2).height = 24;
  for (const r of [1, 2]) for (let c = 1; c <= 6; c++) sum.getCell(r, c).fill = fill(NAVY);

  const pass = graded.length ? Math.round((graded.filter((l) => l.pct! >= PASS_MARK).length / graded.length) * 1000) / 10 : null;
  const kpis: [string, string | number][] = [
    ["Targeted", lines.length],
    ["Sat", sat],
    ["Not submitted", missing.length],
    ["Average", mean(graded.map((l) => l.pct), 1) != null ? `${mean(graded.map((l) => l.pct), 1)}%` : "—"],
    ["Pass rate", pass != null ? `${pass}%` : "—"],
    ["Highest", graded.length ? `${Math.max(...graded.map((l) => l.pct!))}%` : "—"],
  ];
  sum.getRow(4).height = 18;
  sum.getRow(5).height = 34;
  kpis.forEach(([label, value], i) => {
    const l = sum.getCell(4, i + 1);
    const v = sum.getCell(5, i + 1);
    l.value = label;
    l.font = { size: 10, color: { argb: "FF3D4B69" } };
    v.value = value;
    v.font = { size: 20, bold: true, color: { argb: label === "Not submitted" && missing.length ? "FFC2321F" : NAVY } };
    for (const c of [l, v]) {
      c.fill = fill(WASH);
      c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      c.border = { left: i === 0 ? hairline : undefined, right: hairline, top: c === l ? hairline : undefined, bottom: c === v ? hairline : undefined };
    }
  });

  let row = 7;
  const section = (text: string) => {
    const c = sum.getCell(row, 1);
    c.value = text;
    c.font = { size: 13, bold: true, color: { argb: NAVY } };
    sum.getRow(row).height = 22;
    row++;
  };
  const header = (cells: string[]) => {
    cells.forEach((t, i) => {
      const c = sum.getCell(row, i + 1);
      c.value = t;
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.fill = fill(NAVY);
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", indent: i === 0 ? 1 : 0 };
    });
    sum.getRow(row).height = 22;
    row++;
  };
  const body = (cells: (string | number | null)[], zebra: boolean) => {
    cells.forEach((v, i) => {
      const c = sum.getCell(row, i + 1);
      c.value = v ?? "—";
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", indent: i === 0 ? 1 : 0 };
      c.border = { bottom: hairline };
      if (zebra) c.fill = fill("FFF7F9FE");
    });
    sum.getRow(row).height = 20;
    row++;
  };

  section("By class");
  header(["Class", "Targeted", "Submitted", "Not submitted", "Average %", ...(scale ? ["Avg points"] : [])]);
  const byClass = new Map<string, Line[]>();
  lines.forEach((l) => byClass.set(classOf(l), [...(byClass.get(classOf(l)) ?? []), l]));
  [...byClass].forEach(([cls, ls], i) => {
    const notSub = ls.filter((l) => l.status === "Not submitted").length;
    body([cls, ls.length, ls.length - notSub, notSub, mean(ls.map((l) => l.pct), 1), ...(scale ? [mean(ls.map((l) => l.points), 1)] : [])], i % 2 === 1);
  });

  if (scale) {
    row++;
    section(`Grade distribution  (${scaleName})`);
    header(["Grade", "Range (%)", "Points", "Students", "Share", ""]);
    scale.forEach((b, i) => {
      const n = lines.filter((l) => l.letter === b.label).length;
      const share = graded.length ? n / graded.length : 0;
      body([b.label, rangeOf(scale, i), b.points, n, `${Math.round(share * 100)}%`, "█".repeat(Math.round(share * 14))], i % 2 === 1);
      const g = sum.getCell(row - 1, 1);
      const t = tone(i, scale.length);
      g.font = { bold: true, color: { argb: t.fg } };
      g.fill = fill(t.bg);
      sum.getCell(row - 1, 6).font = { color: { argb: t.fg } };
      sum.getCell(row - 1, 6).alignment = { horizontal: "left" };
    });
  }
  row++;
  const note = sum.getCell(row, 1);
  note.value = `Total marks ${total ?? "—"}   ·   Pass mark ${PASS_MARK}%   ·   Generated ${new Date().toLocaleString("en-IN")}`;
  note.font = { size: 9, italic: true, color: { argb: "FF6B7690" } };
  sum.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };

  // ---------- Students ----------
  const sheet = workbook.addWorksheet("Students", { views: [{ state: "frozen", ySplit: 1 }] });
  const rankOf = new Map<Line, number>();
  [...graded].sort((a, b) => b.pct! - a.pct!).forEach((l, i, all) => rankOf.set(l, i > 0 && l.pct === all[i - 1].pct! ? rankOf.get(all[i - 1])! : i + 1));
  const cols: { header: string; key: string; width: number; center?: boolean }[] = [
    { header: "Rank", key: "rank", width: 7, center: true },
    { header: "Student", key: "name", width: 34 },
    { header: "Class", key: "grade", width: 10, center: true },
    { header: "Section", key: "section", width: 10, center: true },
    { header: "Status", key: "status", width: 17 },
    { header: total ? `Score (/${total})` : "Score", key: "score", width: 13, center: true },
    ...(total !== 100 ? [{ header: "%", key: "pct", width: 9, center: true }] : []),
    { header: "Attempts", key: "attempts", width: 10, center: true },
    { header: "Submitted at", key: "submitted", width: 22 },
    ...(scale
      ? [
          { header: "Grade", key: "letter", width: 9, center: true },
          { header: "Points", key: "points", width: 9, center: true },
        ]
      : []),
  ];
  sheet.columns = cols.map(({ header, key, width }) => ({ header, key, width }));
  const head = sheet.getRow(1);
  head.height = 26;
  head.eachCell((c, i) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.fill = fill(NAVY);
    c.alignment = { vertical: "middle", horizontal: cols[i - 1].center ? "center" : "left", indent: cols[i - 1].center ? 0 : 1 };
  });
  lines.forEach((l, i) => {
    const r = sheet.addRow({ ...l, rank: rankOf.get(l) ?? "", score: l.score ?? "", pct: l.pct ?? "", attempts: l.attempts ?? "", points: l.points ?? "" });
    r.height = 21;
    r.eachCell({ includeEmpty: true }, (c, n) => {
      const col = cols[n - 1];
      if (!col) return;
      c.alignment = { vertical: "middle", horizontal: col.center ? "center" : "left", indent: col.center ? 0 : 1 };
      c.border = { bottom: hairline };
      if (i % 2 === 1) c.fill = fill("FFF7F9FE");
    });
    if (l.pct != null && total !== 100) r.getCell("pct").numFmt = "0.0";
    if (l.status === "Not submitted") {
      r.getCell("status").font = { bold: true, color: { argb: "FFC2321F" } };
      r.getCell("name").font = { color: { argb: "FF6B7690" } };
    } else if (l.status === "Awaiting grading") r.getCell("status").font = { color: { argb: "FF92400E" } };
    if (scale && l.letter) {
      const t = tone(scale.findIndex((b) => b.label === l.letter), scale.length);
      const g = r.getCell("letter");
      g.fill = fill(t.bg);
      g.font = { bold: true, color: { argb: t.fg } };
    }
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${assignment.title.replace(/[^\w-]+/g, "_")}_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

/** Group raw submissions into one row per student (best = latest/highest graded, per the retake rule). */
export function rowsFromSubmissions(subs: Submission[], rule: string): StudentRow[] {
  const map = new Map<number, StudentRow>();
  for (const s of subs) {
    const row = map.get(s.student_id) ?? {
      student_id: s.student_id, student_name: s.student_name, grade: s.grade ?? null, section: s.section ?? null,
      school_name: s.school_name ?? null, attempts: [], best: null, latest: s,
      retake_granted: false, retake_grant_count: 0, retake_granted_at: null,
    };
    row.attempts.push(s);
    if (s.attempt_number >= row.latest.attempt_number) row.latest = s;
    if (s.status === "graded" && s.score != null) {
      const better = rule === "highest" ? (row.best?.score ?? -1) < s.score : !row.best || s.attempt_number >= row.best.attempt_number;
      if (!row.best || better) row.best = s;
    }
    map.set(s.student_id, row);
  }
  return [...map.values()];
}

type Mode = "cbse" | "custom" | "none";

const MODES = [
  ["cbse", "CBSE", "A1 to D2, 10 to 3 points"],
  ["custom", "My own scale", "Set grades and points"],
  ["none", "No grades", "Marks only"],
] as const;

export default function ReportDownloadDialog({
  assignment,
  rows,
  missing,
  onClose,
}: {
  assignment: TeacherAssignment;
  rows: StudentRow[];
  missing: NotSubmittedStudent[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("cbse");
  const [custom, setCustom] = useState<ScaleBand[]>(loadCustom);
  const [busy, setBusy] = useState(false);
  const error = mode === "custom" ? scaleError(custom) : null;

  const updateRow = (i: number, patch: Partial<ScaleBand>) =>
    setCustom((s) => s.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const activeScale = mode === "cbse" ? CBSE_SCALE : mode === "custom" && !error ? sortScale(custom) : null;
  // Live count of students per grade, so the teacher sees what the scale does before downloading.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (activeScale)
      for (const l of buildLines(rows, [], activeScale)) if (l.letter) m.set(l.letter, (m.get(l.letter) ?? 0) + 1);
    return m;
  }, [rows, activeScale]);
  const gradedCount = [...counts.values()].reduce((a, b) => a + b, 0);
  const maxCount = Math.max(1, ...counts.values());
  const avg = mean(buildLines(rows, [], null).map((l) => l.pct), 1);

  const handleDownload = async () => {
    const scale = mode === "cbse" ? CBSE_SCALE : mode === "custom" ? sortScale(custom) : null;
    if (mode === "custom") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scale));
      } catch {
        /* not persisted — still export */
      }
    }
    setBusy(true);
    try {
      await downloadAssignmentReport(
        assignment,
        rows,
        missing,
        scale,
        mode === "cbse" ? "CBSE (A1–D2)" : mode === "custom" ? "Custom" : "None",
      );
      onClose();
    } catch (e) {
      console.error("Report export failed", e);
      alert("Failed to generate the report");
    } finally {
      setBusy(false);
    }
  };

  const bar = (label: string) => (
    <td className="rd-bar" aria-label={`${counts.get(label) ?? 0} students`}>
      <i style={{ width: `${((counts.get(label) ?? 0) / maxCount) * 100}%` }} />
      <span>{counts.get(label) ?? 0}</span>
    </td>
  );

  return (
    <Modal
      open
      wide
      onClose={() => { if (!busy) onClose(); }}
      title="Download report"
      subtitle={assignment.title}
      footer={
        <>
          <button type="button" className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="sd-btn sd-btn--amber" onClick={() => void handleDownload()} disabled={!!error || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {busy ? "Preparing" : "Download Excel"}
          </button>
        </>
      }
    >
      <dl className="rd-stats">
        <div><dt>Handed in</dt><dd>{rows.length}</dd></div>
        <div data-hot={missing.length > 0}><dt>Not submitted</dt><dd>{missing.length}</dd></div>
        <div><dt>Average</dt><dd>{avg != null ? `${avg}%` : "—"}</dd></div>
      </dl>
      <p className="rd-note">The file has a summary sheet (by class{mode !== "none" ? ", grade distribution" : ""}) and a sheet with every student, including those who haven&apos;t submitted.</p>

      <fieldset className="tg-scale">
        <legend>Grading scale</legend>
        <div className="rd-modes">
          {MODES.map(([value, label, hint]) => (
            <label key={value} className="tg-opt">
              <input type="radio" name="scale" checked={mode === value} onChange={() => setMode(value)} />
              <span><b>{label}</b><small>{hint}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode !== "none" && (
        <div className="tg-grade-box">
          <table className="tg-scale-table rd-table">
            <thead>
              <tr>
                <th>{mode === "cbse" ? "Marks %" : "Min %"}</th><th>Grade</th><th>Points</th>
                <th>Students{activeScale ? ` (${gradedCount})` : ""}</th>
                {mode === "custom" && <th style={{ width: "2.5rem" }}><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {mode === "cbse"
                ? CBSE_SCALE.map((b, i) => (
                    <tr key={b.label}><td>{rangeOf(CBSE_SCALE, i)}</td><td><span className="rd-pill" data-t={tone(i, CBSE_SCALE.length).bg}>{b.label}</span></td><td>{b.points}</td>{bar(b.label)}</tr>
                  ))
                : custom.map((b, i) => (
                    <tr key={i}>
                      <td><input type="number" min={0} max={100} className="sd-field" aria-label="Minimum percentage" value={Number.isNaN(b.min) ? "" : b.min} onChange={(e) => updateRow(i, { min: e.target.valueAsNumber })} /></td>
                      <td><input className="sd-field" aria-label="Grade" value={b.label} onChange={(e) => updateRow(i, { label: e.target.value })} /></td>
                      <td><input type="number" className="sd-field" aria-label="Points" value={Number.isNaN(b.points) ? "" : b.points} onChange={(e) => updateRow(i, { points: e.target.valueAsNumber })} /></td>
                      {bar(b.label.trim())}
                      <td><button type="button" className="tg-icon" aria-label="Remove row" onClick={() => setCustom((s) => s.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></button></td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {mode === "custom" && (
            <div className="tg-scale-foot">
              <button type="button" className="tg-linkbtn" onClick={() => setCustom((s) => [...s, { min: NaN, label: "", points: 0 }])}><Plus aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem", verticalAlign: "-0.15em" }} /> Add a row</button>
              <button type="button" className="tg-linkbtn" onClick={() => setCustom(CBSE_SCALE.map((b) => ({ ...b })))}>Start from CBSE</button>
            </div>
          )}
        </div>
      )}
      {error && <p className="tg-formerr" role="alert">{error}</p>}
    </Modal>
  );
}

export type ReportData = { assignment: TeacherAssignment; rows: StudentRow[]; missing: NotSubmittedStudent[] };

/** Teacher portal: everything the report needs for one assignment (daily, course or exam). */
export async function loadTeacherReport(id: string): Promise<ReportData> {
  const [a, s] = await Promise.all([teacherApi.assignments.get(id), teacherApi.assignments.submissions(id)]);
  const assignment = (a.data as { assignment: TeacherAssignment }).assignment;
  const p = s.data as { submissions?: Submission[]; not_submitted?: NotSubmittedStudent[] };
  return { assignment, rows: rowsFromSubmissions(p.submissions ?? [], (assignment.retake_rule ?? "latest").toLowerCase()), missing: p.not_submitted ?? [] };
}

/** School-admin and admin: one endpoint returns the assignment, submissions and not-submitted list. */
export const reportLoader =
  (fetch: (id: string) => Promise<{ data: unknown }>) =>
  async (id: string): Promise<ReportData> => {
    const p = (await fetch(id)).data as { assignment: TeacherAssignment; submissions?: Submission[]; not_submitted?: NotSubmittedStudent[] };
    return { assignment: p.assignment, rows: rowsFromSubmissions(p.submissions ?? [], (p.assignment.retake_rule ?? "latest").toLowerCase()), missing: p.not_submitted ?? [] };
  };

/** Load the data, then show the dialog. `busyId` is the assignment being loaded; render `dialog` once. */
export function useReport(load?: (id: string) => Promise<ReportData>): {
  open: (id: string) => void;
  busyId: string | null;
  dialog: ReactNode;
} {
  const [report, setReport] = useState<ReportData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const open = (id: string) => {
    if (!load) return;
    setBusyId(id);
    load(id)
      .then(setReport)
      .catch(() => alert("Failed to load the report data"))
      .finally(() => setBusyId(null));
  };
  return {
    open,
    busyId,
    dialog: report && <ReportDownloadDialog assignment={report.assignment} rows={report.rows} missing={report.missing} onClose={() => setReport(null)} />,
  };
}
