"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Trash2, X } from "lucide-react";
import type {
  TeacherAssignment,
  StudentRow,
  NotSubmittedStudent,
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

/** Full marks report: every targeted student, submitted or not, plus a per-class summary. */
async function downloadAssignmentReport(
  assignment: TeacherAssignment,
  rows: StudentRow[],
  missing: NotSubmittedStudent[],
  scale: ScaleBand[] | null,
  scaleName: string,
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const total = assignment.total_marks ?? rows.find((r) => r.best)?.best?.max_score ?? null;
  const showPct = total !== 100;

  type Line = {
    name: string;
    grade: string;
    section: string;
    status: string;
    score: number | null;
    pct: number | null;
    attempts: number | null;
    submitted: string;
    letter: string;
    points: number | null;
  };
  const lines: Line[] = [
    ...rows.map((r) => {
      const b = r.best;
      const exact = b && b.max_score ? (b.score! / b.max_score) * 100 : null;
      const pct = exact != null ? Math.round(exact * 10) / 10 : null;
      // Grade from the exact %: rounding 90.96 up to 91.0 would wrongly give A1.
      const band = exact != null && scale ? bandFor(exact, scale) : null;
      return {
        name: r.student_name,
        grade: r.grade ?? "",
        section: r.section ?? "",
        status: b ? "Submitted" : "Awaiting grading",
        score: b?.score ?? null,
        pct,
        attempts: r.attempts.length,
        submitted: fmtDate(r.latest.submitted_at),
        letter: band?.label ?? "",
        points: band?.points ?? null,
      };
    }),
    ...missing.map((m) => ({
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
  lines.sort(
    (a, b) =>
      classOf(a).localeCompare(classOf(b), undefined, { numeric: true }) ||
      a.name.localeCompare(b.name),
  );

  const sheet = workbook.addWorksheet("Students");
  sheet.columns = [
    { header: "Student", key: "name", width: 34 },
    { header: "Class", key: "grade", width: 12 },
    { header: "Section", key: "section", width: 10 },
    { header: "Status", key: "status", width: 16 },
    { header: total ? `Score (/${total})` : "Score", key: "score", width: 12 },
    ...(showPct ? [{ header: "%", key: "pct", width: 8 }] : []),
    { header: "Attempts", key: "attempts", width: 11 },
    { header: "Submitted at", key: "submitted", width: 24 },
    ...(scale
      ? [
          { header: "Grade", key: "letter", width: 9 },
          { header: "Points", key: "points", width: 9 },
        ]
      : []),
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  lines.forEach((l) => {
    const row = sheet.addRow(l);
    if (l.status === "Not submitted") row.getCell("status").font = { color: { argb: "FFDC2626" } };
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  const avg = (ns: (number | null)[], digits = 0) => {
    const p = ns.filter((n): n is number => n != null);
    if (!p.length) return "";
    const f = 10 ** digits;
    return Math.round((p.reduce((a, b) => a + b, 0) / p.length) * f) / f;
  };
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }];
  const heading = (cells: (string | number)[]) => (summary.addRow(cells).font = { bold: true });
  [
    ["Assignment", assignment.title],
    ["Subject", assignment.subject ?? ""],
    ["Due date", assignment.due_date ? new Date(assignment.due_date).toLocaleDateString("en-IN") : ""],
    ["Total marks", total ?? ""],
    ["Grading scale", scaleName],
    ["Targeted students", lines.length],
    ["Submitted", rows.length],
    ["Not submitted", missing.length],
    ["Average %", avg(lines.map((l) => l.pct))],
    ...(scale ? [["Average points", avg(lines.map((l) => l.points), 1)]] : []),
    ["Generated", new Date().toLocaleString("en-IN")],
  ].forEach((r) => (summary.addRow(r).getCell(1).font = { bold: true }));

  summary.addRow([]);
  heading(["Class", "Targeted", "Submitted", "Not submitted", "Average %", ...(scale ? ["Avg points"] : [])]);
  const byClass = new Map<string, Line[]>();
  lines.forEach((l) => byClass.set(classOf(l), [...(byClass.get(classOf(l)) ?? []), l]));
  byClass.forEach((ls, cls) => {
    const notSub = ls.filter((l) => l.status === "Not submitted").length;
    summary.addRow([
      cls,
      ls.length,
      ls.length - notSub,
      notSub,
      avg(ls.map((l) => l.pct)),
      ...(scale ? [avg(ls.map((l) => l.points), 1)] : []),
    ]);
  });

  if (scale) {
    summary.addRow([]);
    heading(["Grade", "Range (%)", "Points", "Students"]);
    scale.forEach((b, i) =>
      summary.addRow([b.label, rangeOf(scale, i), b.points, lines.filter((l) => l.letter === b.label).length]),
    );
  }

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

type Mode = "cbse" | "custom" | "none";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updateRow = (i: number, patch: Partial<ScaleBand>) =>
    setCustom((s) => s.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const handleDownload = async () => {
    const scale =
      mode === "cbse" ? CBSE_SCALE : mode === "custom" ? sortScale(custom) : null;
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

  const inputCls =
    "w-full h-8 px-2 text-sm border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 id="report-dialog-title" className="text-base font-semibold text-gray-900">
            Download report
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Grading scale
            </legend>
            {(
              [
                ["cbse", "CBSE (A1–D2)", "91–100 A1 · 81–90 A2 · … · 0–34 D2"],
                ["custom", "My custom scale", "Set your own grades and points"],
                ["none", "None", "Marks only, no grade columns"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${
                  mode === value ? "border-blue-400 bg-blue-50/50" : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="scale"
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{label}</span>
                  <span className="block text-xs text-gray-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {mode !== "none" && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-[11px] text-gray-400 uppercase tracking-wide">
                    <th className="px-2 py-2 text-left font-semibold">Min %</th>
                    <th className="px-2 py-2 text-left font-semibold">Grade</th>
                    <th className="px-2 py-2 text-left font-semibold">Points</th>
                    {mode === "custom" && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mode === "cbse"
                    ? CBSE_SCALE.map((b, i) => (
                        <tr key={b.label} className="text-gray-700">
                          <td className="px-2 py-1.5">{rangeOf(CBSE_SCALE, i)}</td>
                          <td className="px-2 py-1.5 font-medium">{b.label}</td>
                          <td className="px-2 py-1.5">{b.points}</td>
                        </tr>
                      ))
                    : custom.map((b, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              aria-label="Minimum percentage"
                              value={Number.isNaN(b.min) ? "" : b.min}
                              onChange={(e) => updateRow(i, { min: e.target.valueAsNumber })}
                              className={inputCls}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              aria-label="Grade"
                              value={b.label}
                              onChange={(e) => updateRow(i, { label: e.target.value })}
                              className={inputCls}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              aria-label="Points"
                              value={Number.isNaN(b.points) ? "" : b.points}
                              onChange={(e) => updateRow(i, { points: e.target.valueAsNumber })}
                              className={inputCls}
                            />
                          </td>
                          <td className="px-1">
                            <button
                              type="button"
                              aria-label="Remove row"
                              onClick={() => setCustom((s) => s.filter((_, j) => j !== i))}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {mode === "custom" && (
                <div className="flex items-center justify-between px-2 py-2 border-t border-gray-100 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => setCustom((s) => [...s, { min: NaN, label: "", points: 0 }])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add row
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustom(CBSE_SCALE.map((b) => ({ ...b })))}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Start from CBSE
                  </button>
                </div>
              )}
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!!error || busy}
            className="h-9 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {busy ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
