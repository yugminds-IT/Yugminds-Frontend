'use client'

import { useRef, useState } from 'react'
import { Download, FileUp, KeyRound, Loader2, Upload, FlaskConical } from 'lucide-react'
import Modal from '../portal/Modal'
import { schoolAdminApi } from '@/lib/api/school-admin.api'
import { toast } from '@/components/ui/toast'
import { csvCell, downloadText } from './student-utils'

type Row = Record<string, string>
interface ImportResults {
  summary: { total: number; success: number; failed: number; generated_passwords: number; dry_run: boolean }
  results: Array<{ index: number; email: string | null; success: boolean; error?: string; generated_password?: string }>
}

const TEMPLATE_HEADERS = ['email', 'full_name', 'grade', 'section', 'joining_code', 'parent_name', 'parent_phone', 'password', 'is_active']
const TEMPLATE_ROWS = [
  ['student1@example.com', 'Student One', 'Grade 5', 'A', 'ABC123', 'Parent One', '9999999999', '', 'true'],
  ['student2@example.com', 'Student Two', 'Grade 6', 'B', '', 'Parent Two', '', 'StrongPass1!', 'true'],
]

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const split = (line: string) => {
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted
      } else if (ch === ',' && !quoted) { out.push(cur); cur = '' } else cur += ch
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }
  const headers = split(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map((l) => {
    const cols = split(l)
    const obj: Row = {}
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').replace(/^"|"$/g, '').trim() })
    return obj
  })
}

/** Add many students from a CSV. Check it first with a dry run, then import. */
export default function StudentImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [results, setResults] = useState<ImportResults | null>(null)
  const [busy, setBusy] = useState<null | 'dry' | 'import'>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setRows([]); setFileName(''); setResults(null)
    if (fileRef.current) fileRef.current.value = ''
  }
  const close = () => { if (!busy) { reset(); onClose() } }

  const pick = async (file: File) => {
    const parsed = parseCsv(await file.text())
    setResults(null)
    setRows(parsed)
    setFileName(file.name)
    if (parsed.length === 0) toast.warning('That file has no rows. Use the template to see the format.')
  }

  const run = async (dry: boolean) => {
    if (rows.length === 0) return
    setBusy(dry ? 'dry' : 'import')
    try {
      const payload = rows.map((r) => ({
        email: r.email,
        full_name: r.full_name,
        grade: r.grade,
        section: r.section,
        joining_code: r.joining_code,
        parent_name: r.parent_name,
        parent_phone: r.parent_phone,
        password: r.password,
        is_active: r.is_active ? String(r.is_active).toLowerCase() !== 'false' : undefined,
      }))
      const resp = await schoolAdminApi.students.bulkImport({ students: payload, dry_run: dry })
      const data = resp.data as { success: boolean } & ImportResults
      if (!data?.success) throw new Error('The server did not accept the file')
      setResults({ summary: data.summary, results: data.results })
      if (!dry) onImported()
    } catch (e) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : 'Try again.'}`)
    } finally {
      setBusy(null)
    }
  }

  const failed = results?.results.filter((r) => !r.success) ?? []
  const withPasswords = results?.results.filter((r) => r.success && r.generated_password) ?? []
  const done = !!results && !results.summary.dry_run

  const downloadPasswords = () =>
    downloadText(
      'new_student_passwords.csv',
      ['email,password', ...withPasswords.map((r) => `${csvCell(r.email ?? '')},${csvCell(r.generated_password ?? '')}`)].join('\n'),
    )

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Import students"
      subtitle="Add many students at once from a CSV file."
      footer={
        done ? (
          <>
            <button className="sd-btn sd-btn--line" onClick={reset}>Import another file</button>
            <button className="sd-btn sd-btn--amber" onClick={close}>Done</button>
          </>
        ) : (
          <>
            <button className="sd-btn sd-btn--line" onClick={close} disabled={!!busy}>Cancel</button>
            <button className="sd-btn sd-btn--line" disabled={!!busy || rows.length === 0} onClick={() => void run(true)}>
              {busy === 'dry' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FlaskConical aria-hidden="true" />}Check the file
            </button>
            <button className="sd-btn sd-btn--amber" disabled={!!busy || rows.length === 0} onClick={() => void run(false)}>
              {busy === 'import' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}Import {rows.length > 0 ? rows.length : ''}
            </button>
          </>
        )
      }
    >
      {!done && (
        <ol className="sm-steps">
          <li>
            <b>Get the template</b>
            <span>Each row is one student. Only <code>email</code> is required. Leave <code>password</code> empty and we make one for you.</span>
            <button className="sd-btn sd-btn--line" onClick={() => downloadText('students_import_template.csv', [TEMPLATE_HEADERS.join(','), ...TEMPLATE_ROWS.map((r) => r.map(csvCell).join(','))].join('\n'))}>
              <Download aria-hidden="true" />Download template
            </button>
          </li>
          <li>
            <b>Choose your file</b>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
            <button className="sm-drop" onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden="true" />
              {fileName ? <><b>{fileName}</b><span>{rows.length} {rows.length === 1 ? 'student' : 'students'} found. Click to choose a different file.</span></> : <><b>Choose a CSV file</b><span>Click to browse your computer</span></>}
            </button>
          </li>
          <li>
            <b>Check, then import</b>
            <span>“Check the file” shows what would happen and saves nothing.</span>
          </li>
        </ol>
      )}

      {results && (
        <section className="sm-result" aria-live="polite" aria-label="Import result">
          <p className="sm-result-head">
            <b>{results.summary.dry_run ? 'Check complete. Nothing was saved.' : 'Import complete.'}</b>
          </p>
          <div className="sm-stats">
            <div><b>{results.summary.success}</b><span>{results.summary.dry_run ? 'would be added' : 'added'}</span></div>
            <div data-bad={results.summary.failed > 0}><b>{results.summary.failed}</b><span>{results.summary.failed === 1 ? 'has a problem' : 'have problems'}</span></div>
            <div><b>{results.summary.generated_passwords}</b><span>{results.summary.dry_run ? 'passwords to make' : 'passwords made'}</span></div>
          </div>
          {done && withPasswords.length > 0 && (
            <div className="sm-note">
              <KeyRound aria-hidden="true" />
              <p>We made {withPasswords.length} {withPasswords.length === 1 ? 'password' : 'passwords'} for rows that had none. This is the only time you can see {withPasswords.length === 1 ? 'it' : 'them'}.</p>
              <button className="sd-btn sd-btn--amber" onClick={downloadPasswords}><Download aria-hidden="true" />Download passwords</button>
            </div>
          )}
          {failed.length > 0 && (
            <ul className="sm-errs" aria-label="Rows with problems">
              {failed.map((r) => (
                <li key={`${r.index}-${r.email}`}><b>Row {r.index + 2}</b> {r.email || '(no email)'}: {r.error}</li>
              ))}
            </ul>
          )}
          {results.summary.dry_run && results.summary.failed === 0 && <p className="as-fine">Everything looks good. Press Import to add them.</p>}
        </section>
      )}
    </Modal>
  )
}
