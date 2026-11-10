"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Key, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Modal from "../../portal/Modal";
import ConfirmModal from "../../portal/ConfirmModal";
import RowMenu from "../../portal/RowMenu";
import { ChipGroup } from "../../portal/notifications";
import { adminApi } from "@/lib/api/admin.api";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { toast } from "@/components/ui/toast";
import {
  ALL_GRADES,
  STATE_LABEL,
  STATE_ORDER,
  monthYear,
  plural,
  sortCodes,
  stateOf,
  type CodeState,
  type JoiningCode,
} from "./utils";

const USAGE = [["multiple", "Many students"], ["single", "One student"]] as const;
const errMsg = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** The codes of one school: the list, plus making new ones, editing, regenerating and deleting. Used by the page and by the dialog. */
export default function CodesPanel({
  schoolId,
  schoolName,
  codes,
  loading,
  error,
  onRetry,
  onChanged,
  filter,
  onFilter,
  showChips,
  now,
  onNested,
}: {
  schoolId: string;
  schoolName: string;
  codes: JoiningCode[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onChanged: () => void;
  filter: CodeState | null;
  onFilter: (s: CodeState | null) => void;
  /** show the state chips here (the page shows them as a track instead) */
  showChips: boolean;
  now: number;
  /** told when one of this panel's own dialogs opens or closes, so a dialog around the panel does not close under it */
  onNested?: (open: boolean) => void;
}) {
  const { schools } = useAdminSchools();
  const school = useMemo(() => (schools as Array<Record<string, unknown>> | undefined)?.find((s) => s.id === schoolId), [schools, schoolId]);
  const schoolGrades = useMemo<string[]>(() => {
    const g = (school?.gradesOffered ?? school?.grades_offered ?? (Array.isArray(school?.grades) ? (school!.grades as { name: string }[]).map((x) => x.name) : null)) as unknown;
    return Array.isArray(g) ? (g as string[]) : [];
  }, [school]);
  const sectionsByGrade = useMemo(() => {
    const map = new Map<string, string[]>();
    const grades = school?.grades;
    if (Array.isArray(grades)) for (const g of grades as Array<{ name?: string; sections?: Array<{ name: string }> }>) if (g?.name && Array.isArray(g.sections)) map.set(g.name, g.sections.map((s) => s.name));
    return map;
  }, [school]);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<JoiningCode | null>(null);
  const [regen, setRegen] = useState<JoiningCode | null>(null);
  const [del, setDel] = useState<JoiningCode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const nestedOpen = adding || !!editing || !!regen || !!del;
  useEffect(() => { onNested?.(nestedOpen); }, [nestedOpen, onNested]);

  const counts: Record<CodeState, number> = { active: 0, full: 0, expired: 0, off: 0 };
  codes.forEach((c) => { counts[stateOf(c, now)] += 1; });
  const shown = sortCodes(filter ? codes.filter((c) => stateOf(c, now) === filter) : codes);

  const copy = async (c: JoiningCode) => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopied(c.id);
      setTimeout(() => setCopied((cur) => (cur === c.id ? null : cur)), 1800);
    } catch { toast.error("Could not copy. Select the code and copy it by hand."); }
  };

  const setActive = async (c: JoiningCode, isActive: boolean) => {
    setBusyId(c.id);
    try {
      await adminApi.joiningCodes.update({ code: c.code, isActive });
      toast.success(isActive ? "Code switched on." : "Code switched off. Nobody can join with it now.");
      onChanged();
    } catch (e) { toast.error(errMsg(e, "Could not change the code. Try again.")); } finally { setBusyId(null); }
  };

  const runRegenerate = async () => {
    if (!regen) return;
    setBusyId(regen.id);
    try {
      await adminApi.joiningCodes.update({ code: regen.code, schoolId, grade: regen.grade, regenerate: true });
      toast.success("A new code was made. The old one is switched off.");
      setRegen(null);
      onChanged();
    } catch (e) { toast.error(errMsg(e, "Could not make a new code.")); } finally { setBusyId(null); }
  };

  const runDelete = async () => {
    if (!del) return;
    setBusyId(del.id);
    try {
      await adminApi.joiningCodes.delete(del.id);
      toast.success("Code deleted.");
      setDel(null);
      onChanged();
    } catch (e) { toast.error(errMsg(e, "Could not delete the code.")); } finally { setBusyId(null); }
  };

  return (
    <>
      <div className="jc-bar">
        {showChips && (
          <ChipGroup
            label="Show codes"
            value={filter ?? "all"}
            options={[["all", `All ${codes.length}`], ...STATE_ORDER.filter((s) => counts[s] > 0).map((s) => [s, `${STATE_LABEL[s]} ${counts[s]}`] as const)] as readonly (readonly [string, string])[]}
            onChange={(v) => onFilter(v === "all" ? null : (v as CodeState))}
          />
        )}
        {filter && !showChips && <span className="sm-chip" data-class="true">{STATE_LABEL[filter]}</span>}
        <button className="sd-btn sd-btn--amber jc-add" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Make codes</button>
      </div>

      {loading ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : error ? (
        <section className="sd-panel">
          <div className="sd-empty"><b>We could not load the codes</b><p>Check your connection, then try again.</p><button className="sd-btn sd-btn--amber" onClick={onRetry}>Try again</button></div>
        </section>
      ) : codes.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No joining codes for {schoolName} yet</b>
            <p>Make one code per grade, or one per section. Students and teachers type it when they sign up and land in the right class.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => setAdding(true)}><Plus aria-hidden="true" />Make codes</button>
          </div>
        </section>
      ) : shown.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty"><b>No codes match</b><p>Pick another state, or show every code.</p><button className="sd-btn sd-btn--line" onClick={() => onFilter(null)}>Show every code</button></div>
        </section>
      ) : (
        <section className="sd-panel jc-list mc-swap" aria-label={`Joining codes for ${schoolName}`}>
          <div className="jc-head"><span>Class</span><span>Code</span><span>Used</span><span>Expires</span><span>State</span><span /></div>
          {shown.map((c) => {
            const st = stateOf(c, now);
            const limit = c.usage_type === "single" ? 1 : c.max_uses;
            const pct = limit ? Math.min(100, Math.round((c.times_used / limit) * 100)) : null;
            return (
              <div key={c.id} className="jc-row" data-s={st}>
                <span className="jc-class"><b>{c.grade}</b>{c.section && <small>Section {c.section}</small>}</span>
                <span className="jc-code">
                  <code>{c.code}</code>
                  <button type="button" onClick={() => void copy(c)} aria-label={`Copy code ${c.code}`}>{copied === c.id ? <Check /> : <Copy />}</button>
                </span>
                <span className="jc-used">
                  <b>{c.times_used}{limit ? ` of ${limit}` : ""}</b>
                  {pct != null ? <span className="sd-meter" role="img" aria-label={`${pct} percent used`}><i style={{ "--p": `${Math.max(pct, 3)}%` } as React.CSSProperties} /></span> : <small>No limit</small>}
                  <small>{c.usage_type === "single" ? "One student" : "Many students"}</small>
                </span>
                <span className="jc-exp">{monthYear(c.expires_at)}</span>
                <span className="jc-state">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.is_active}
                    aria-label={`${c.grade}${c.section ? ` section ${c.section}` : ""} code is on`}
                    className="st-switch"
                    disabled={busyId === c.id}
                    onClick={() => void setActive(c, !c.is_active)}
                  />
                  <span className="jc-chip" data-s={st}>{STATE_LABEL[st]}</span>
                </span>
                <span className="jc-menu">
                  {busyId === c.id ? <Loader2 className="animate-spin" aria-label="Working" /> : (
                    <RowMenu
                      label={`Actions for the ${c.grade} code`}
                      items={[
                        { label: "Edit code", icon: Pencil, onClick: () => setEditing(c) },
                        { label: "Make a new code", icon: RefreshCw, onClick: () => setRegen(c) },
                        { label: "Delete code", icon: Trash2, onClick: () => setDel(c), danger: true, separatorBefore: true },
                      ]}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {adding && (
        <GenerateModal
          schoolId={schoolId}
          schoolName={schoolName}
          codes={codes}
          schoolGrades={schoolGrades}
          sectionsByGrade={sectionsByGrade}
          now={now}
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); onChanged(); }}
        />
      )}
      {editing && <EditModal key={editing.id} code={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onChanged(); }} />}

      <ConfirmModal
        open={!!regen}
        onClose={() => setRegen(null)}
        title="Make a new code?"
        subtitle={regen ? `${regen.grade}${regen.section ? `, section ${regen.section}` : ""}` : undefined}
        confirmLabel="Make a new code"
        busy={!!regen && busyId === regen.id}
        onConfirm={() => void runRegenerate()}
      >
        <p>The current code, <b>{regen?.code}</b>, is switched off and a new one takes its place. Anyone who has the old code can no longer join with it.</p>
      </ConfirmModal>
      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        title="Delete this code?"
        subtitle={del ? `${del.code}, ${del.grade}` : undefined}
        confirmLabel="Delete code"
        danger
        busy={!!del && busyId === del.id}
        onConfirm={() => void runDelete()}
      >
        <p>This cannot be undone. To stop a code being used but keep it, switch it off instead.</p>
      </ConfirmModal>
    </>
  );
}

function GenerateModal({
  schoolId,
  schoolName,
  codes,
  schoolGrades,
  sectionsByGrade,
  now,
  onClose,
  onDone,
}: {
  schoolId: string;
  schoolName: string;
  codes: JoiningCode[];
  schoolGrades: string[];
  sectionsByGrade: Map<string, string[]>;
  now: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [grades, setGrades] = useState<string[]>([]);
  const [sections, setSections] = useState<Record<string, string[]>>({});
  const [usage, setUsage] = useState<"single" | "multiple">("multiple");
  const [maxUses, setMaxUses] = useState("");
  const [busy, setBusy] = useState(false);
  const [warned, setWarned] = useState(false);
  const warnRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (warned) warnRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [warned]);

  const hasLive = (g: string) => codes.some((c) => c.grade === g && stateOf(c, now) === "active");
  const withLive = grades.filter(hasLive);
  const sectionable = grades.filter((g) => (sectionsByGrade.get(g)?.length ?? 0) > 0);
  const ordered = [...ALL_GRADES].sort((a, b) => Number(schoolGrades.includes(b)) - Number(schoolGrades.includes(a)));

  const toggleGrade = (g: string) => {
    setWarned(false);
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
    setSections((prev) => { if (!(g in prev)) return prev; const next = { ...prev }; delete next[g]; return next; });
  };
  const toggleSection = (g: string, s: string) =>
    setSections((prev) => { const cur = prev[g] ?? []; return { ...prev, [g]: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] }; });

  const submit = async () => {
    if (grades.length === 0 || busy) return;
    if (withLive.length > 0 && !warned) { setWarned(true); return; }
    setBusy(true);
    try {
      const picked = Object.fromEntries(Object.entries(sections).filter(([, names]) => names.length > 0));
      const { data } = await adminApi.joiningCodes.create({
        schoolId,
        grades,
        sections: picked,
        usageType: usage,
        maxUses: maxUses ? parseInt(maxUses, 10) : null,
      });
      const payload = (data as Record<string, unknown>) ?? {};
      const results = (payload.results as unknown[] | undefined) ?? [];
      const count = results.length || Object.keys((payload.codes as Record<string, unknown>) || {}).length;
      toast.success(`Made ${plural(count, "code")} for ${grades.length === 1 ? grades[0] : plural(grades.length, "grade")}.`);
      onDone();
    } catch (e) {
      toast.error(errMsg(e, "Could not make the codes. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => { if (!busy) onClose(); }}
      wide
      title="Make joining codes"
      subtitle={`For ${schoolName}. Pick the grades, and the sections if you want one code per section.`}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={() => void submit()} disabled={busy || grades.length === 0}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Key aria-hidden="true" />}
            {warned ? "Make them anyway" : grades.length ? `Make codes for ${plural(grades.length, "grade")}` : "Make codes"}
          </button>
        </>
      }
    >
      <div className="jc-form">
        <section aria-labelledby="jc-g">
          <h3 id="jc-g">Grades</h3>
          <div className="jc-grades" role="group" aria-label="Grades">
            {ordered.map((g) => (
              <button key={g} type="button" className="as-chip jc-grade" aria-pressed={grades.includes(g)} onClick={() => toggleGrade(g)} data-off={schoolGrades.length > 0 && !schoolGrades.includes(g)}>
                {g}{hasLive(g) && <small>has a code</small>}
              </button>
            ))}
          </div>
          {schoolGrades.length > 0 && <p className="jc-hint">{schoolName} teaches {schoolGrades.join(", ")}. Faded grades are not set up for this school, but you can still make a code for them.</p>}
        </section>

        {sectionable.length > 0 && (
          <section aria-labelledby="jc-s">
            <h3 id="jc-s">Sections <small>(optional)</small></h3>
            <p className="jc-hint">Leave a grade&apos;s sections unticked for one code for the whole grade. Tick sections for one code per section. Students who use it join that section directly.</p>
            {sectionable.map((g) => (
              <div key={g} className="jc-secs">
                <b>{g}</b>
                <span className="jc-secs-list" role="group" aria-label={`Sections of ${g}`}>
                  {(sectionsByGrade.get(g) ?? []).map((s) => (
                    <button key={s} type="button" className="as-chip" aria-pressed={(sections[g] ?? []).includes(s)} onClick={() => toggleSection(g, s)}>{s}</button>
                  ))}
                </span>
                <small>{(sections[g] ?? []).length === 0 ? "Whole grade" : plural((sections[g] ?? []).length, "section")}</small>
              </div>
            ))}
          </section>
        )}

        <section className="sm-two" aria-label="Who can use it">
          <div className="sd-field-wrap">
            <label id="jc-u">Who can use each code</label>
            <ChipGroup label="Who can use each code" value={usage} options={USAGE} onChange={setUsage} />
            <p className="jc-hint">{usage === "single" ? "A code works for one student, then stops." : "The same code works for many students of the grade."}</p>
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="jc-max">Limit <small>(optional)</small></label>
            <input id="jc-max" type="number" min={1} className="sd-field" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="No limit" disabled={usage === "single"} />
            <p className="jc-hint">The most times each code can be used.</p>
          </div>
        </section>

        {warned && withLive.length > 0 && (
          <p ref={warnRef} className="jc-warn" role="alert">{withLive.join(", ")} already {withLive.length === 1 ? "has" : "have"} a working code. New codes are added next to it. The old ones keep working until you switch them off.</p>
        )}
      </div>
    </Modal>
  );
}

function EditModal({ code, onClose, onDone }: { code: JoiningCode; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState(code.code);
  const [usage, setUsage] = useState(code.usage_type);
  const [maxUses, setMaxUses] = useState(code.max_uses ? String(code.max_uses) : "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!text.trim()) { toast.error("The code cannot be empty."); return; }
    setBusy(true);
    try {
      await adminApi.joiningCodes.update({
        codeId: code.id,
        code: text.trim(),
        usageType: usage,
        maxUses: maxUses ? parseInt(maxUses, 10) : null,
        expiresAt: code.expires_at,
      });
      toast.success("Code saved.");
      onDone();
    } catch (e) { toast.error(errMsg(e, "Could not save the code.")); } finally { setBusy(false); }
  };
  return (
    <Modal
      open
      onClose={() => { if (!busy) onClose(); }}
      title="Edit code"
      subtitle={`${code.grade}${code.section ? `, section ${code.section}` : ""}. Expires ${monthYear(code.expires_at)}.`}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="animate-spin" aria-hidden="true" />}Save changes</button>
        </>
      }
    >
      <form className="sm-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="sd-field-wrap">
          <label htmlFor="jc-e-code">Code</label>
          <input id="jc-e-code" className="sd-field jc-mono" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} />
          <p className="jc-hint">Students type this exactly. Changing it stops the old one from working.</p>
        </div>
        <div className="sm-two">
          <div className="sd-field-wrap">
            <label id="jc-e-u">Who can use it</label>
            <ChipGroup label="Who can use it" value={usage} options={USAGE} onChange={setUsage} />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="jc-e-max">Limit <small>(optional)</small></label>
            <input id="jc-e-max" type="number" min={1} className="sd-field" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="No limit" disabled={usage === "single"} />
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
