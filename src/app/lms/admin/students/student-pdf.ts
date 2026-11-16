import { escapeHtml as esc } from "@/lib/escape-html";

export type PdfStudentRow = { name?: string; email?: string; password?: string; school?: string; grade?: string; section?: string };

/**
 * Print document for student lists, styled like the portal (navy band, blue/amber, line-bordered
 * rounded table). Used by both the import-credentials and the student-info exports.
 */
export function buildStudentPdfHtml(opts: {
  title: string;
  facts: Array<[label: string, value: string]>;
  note: string;
  rows: PdfStudentRow[];
  showPassword: boolean;
}): string {
  const { title, facts, note, rows, showPassword } = opts;
  const date = new Date().toLocaleString();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm 10mm; }
  :root { --ink:#0b1b3a; --soft:#3d4b69; --wash:#eef3fc; --line:#d3dcef; --blue:#2563eb; --navy:#0a1f4d; --amber:#fbbf24; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font: 400 9.5pt/1.4 Figtree, "Segoe UI", sans-serif; color: var(--ink); }
  .band { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 14px; background: var(--navy); color: #fff; }
  .mark { flex: none; width: 38px; height: 38px; border-radius: 50%; background: var(--amber); display: grid; place-items: center; color: var(--navy); font: 800 15pt/1 "Bricolage Grotesque", "Trebuchet MS", sans-serif; }
  .band h1 { margin: 0; font: 800 19pt/1.1 "Bricolage Grotesque", "Trebuchet MS", sans-serif; letter-spacing: -0.015em; }
  .band p { margin: 2px 0 0; color: #bccaf0; font-size: 9pt; }
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); margin: 14px 0 10px; border: 1.5px solid var(--line); border-radius: 12px; overflow: hidden; }
  .facts div { padding: 9px 12px; border-right: 1.5px solid var(--line); background: var(--wash); }
  .facts div:last-child { border-right: 0; }
  .facts span { display: block; font-size: 8pt; color: var(--soft); }
  .facts b { display: block; margin-top: 1px; font: 700 10.5pt/1.25 Figtree, sans-serif; overflow-wrap: anywhere; }
  .note { margin: 0 0 14px; padding: 9px 12px; border-left: 4px solid var(--amber); border-radius: 0 10px 10px 0; background: #fff8e1; color: var(--ink); font-size: 9pt; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1.5px solid var(--line); border-radius: 12px; overflow: hidden; }
  thead { display: table-header-group; }
  th { padding: 8px 10px; background: var(--ink); color: #fff; text-align: left; font: 600 8.5pt/1.2 Figtree, sans-serif; }
  td { padding: 7px 10px; border-top: 1px solid var(--line); vertical-align: top; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: var(--wash); }
  .n { width: 30px; color: var(--soft); text-align: right; }
  .nm { font-weight: 600; }
  .em { color: var(--blue); overflow-wrap: anywhere; }
  .pw { font: 600 9pt/1.3 ui-monospace, Menlo, Consolas, monospace; }
  .none { color: var(--soft); font-style: italic; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 99px; border: 1.5px solid var(--line); background: #fff; font-weight: 600; font-size: 8.5pt; white-space: nowrap; }
  .sch { font-size: 8.5pt; color: var(--soft); }
  footer { margin-top: 10px; color: var(--soft); font-size: 8pt; text-align: right; }
</style></head>
<body>
  <div class="band"><div class="mark">R</div><div><h1>${esc(title)}</h1><p>RoboCoders LMS · ${esc(date)}</p></div></div>
  <div class="facts">
    <div><span>Students</span><b>${rows.length}</b></div>
    ${facts.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}
  </div>
  <p class="note">${esc(note)}</p>
  <table>
    <thead><tr><th class="n">#</th><th>Name</th><th>Email</th>${showPassword ? '<th>Password</th>' : ''}<th>School</th><th>Grade</th><th>Section</th></tr></thead>
    <tbody>
      ${rows.map((c, i) => `<tr>
        <td class="n">${i + 1}</td>
        <td class="nm">${esc(c.name ?? '')}</td>
        <td class="em">${esc(c.email ?? '')}</td>
        ${showPassword ? `<td class="pw">${c.password ? esc(c.password) : '<span class="none">own password</span>'}</td>` : ''}
        <td class="sch">${esc(c.school ?? '')}</td>
        <td><span class="pill">${esc(c.grade ?? '')}</span></td>
        <td><span class="pill">${esc(c.section ?? '')}</span></td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${showPassword ? '<footer>Keep this file private — it contains login details.</footer>' : ''}
</body></html>`;
}
