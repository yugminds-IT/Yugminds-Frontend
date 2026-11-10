import { Download } from "lucide-react";

const REPORTS = [
  { id: "enrollment", title: "Enrollment report", text: "Every student with their school, grade, section and courses." },
  { id: "progress", title: "Progress report", text: "How far each student is through each course." },
  { id: "grade", title: "Grade-wise report", text: "Student counts and progress, grouped by grade." },
  { id: "school", title: "School-wise report", text: "Student counts and progress, grouped by school." },
] as const;

export type ReportId = (typeof REPORTS)[number]["id"];

/** Four CSV downloads, each with one line on what is inside. */
export default function ReportsTab({ onDownload, disabled }: { onDownload: (id: ReportId) => void; disabled: boolean }) {
  return (
    <section className="sd-panel" aria-labelledby="ad-reports">
      <div className="sd-panel-head"><div><h2 id="ad-reports">Student reports</h2><p>Each one downloads as a spreadsheet of the students currently loaded.</p></div></div>
      <div className="ad-reports">
        {REPORTS.map((r) => (
          <button key={r.id} type="button" className="ad-report" onClick={() => onDownload(r.id)} disabled={disabled}>
            <Download aria-hidden="true" />
            <span><b>{r.title}</b><small>{r.text}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}
