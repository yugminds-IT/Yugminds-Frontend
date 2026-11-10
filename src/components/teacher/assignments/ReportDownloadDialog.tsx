"use client";

import { useState } from "react";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import Modal from "../../portal/Modal";
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

  return (
    <Modal
      open
      onClose={() => { if (!busy) onClose(); }}
      title="Download report"
      subtitle="Marks for every student, with a grade column if you want one."
      footer={
        <>
          <button type="button" className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="sd-btn sd-btn--amber" onClick={() => void handleDownload()} disabled={!!error || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            {busy ? "Preparing" : "Download"}
          </button>
        </>
      }
    >
      <fieldset className="tg-scale">
        <legend>Grading scale</legend>
        {(
          [
            ["cbse", "CBSE (A1 to D2)", "91-100 A1, 81-90 A2, and so on down to 0-34 D2"],
            ["custom", "My own scale", "Set your own grades and points"],
            ["none", "None", "Marks only, no grade columns"],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="tg-opt">
            <input type="radio" name="scale" checked={mode === value} onChange={() => setMode(value)} />
            <span><b>{label}</b><small>{hint}</small></span>
          </label>
        ))}
      </fieldset>

      {mode !== "none" && (
        <div className="tg-grade-box" style={{ borderColor: "var(--sd-line)" }}>
          <table className="tg-scale-table">
            <thead>
              <tr><th>Min %</th><th>Grade</th><th>Points</th>{mode === "custom" && <th style={{ width: "2.5rem" }}><span className="sr-only">Remove</span></th>}</tr>
            </thead>
            <tbody>
              {mode === "cbse"
                ? CBSE_SCALE.map((b, i) => (
                    <tr key={b.label}><td>{rangeOf(CBSE_SCALE, i)}</td><td><b>{b.label}</b></td><td>{b.points}</td></tr>
                  ))
                : custom.map((b, i) => (
                    <tr key={i}>
                      <td><input type="number" min={0} max={100} className="sd-field" aria-label="Minimum percentage" value={Number.isNaN(b.min) ? "" : b.min} onChange={(e) => updateRow(i, { min: e.target.valueAsNumber })} /></td>
                      <td><input className="sd-field" aria-label="Grade" value={b.label} onChange={(e) => updateRow(i, { label: e.target.value })} /></td>
                      <td><input type="number" className="sd-field" aria-label="Points" value={Number.isNaN(b.points) ? "" : b.points} onChange={(e) => updateRow(i, { points: e.target.valueAsNumber })} /></td>
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
