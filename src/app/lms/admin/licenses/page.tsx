"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { adminApi } from "@/lib/api/admin.api";
import { useToast } from "@/components/ui/toast";
import ConfirmModal from "@/components/portal/ConfirmModal";
import LicenseRun from "@/components/admin/licenses/LicenseRun";
import KeysTab from "@/components/admin/licenses/KeysTab";
import MakeTab from "@/components/admin/licenses/MakeTab";
import ToolsTab from "@/components/admin/licenses/ToolsTab";
import EditModal, { type EditValues } from "@/components/admin/licenses/EditModal";
import {
  MACHINE_ID_RE,
  SOON_DAYS,
  errorText,
  licensesOf,
  payloadOf,
  plural,
  stageOf,
  type LicenseItem,
  type Stage,
} from "@/components/admin/licenses/utils";
import "@/components/school-admin/overview.css"; // hero meta, so- grid
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/licenses/licenses.css";

type Tab = "keys" | "make" | "tools";

export default function LicensesPage() {
  const toast = useToast();
  const { schools, isLoading: schoolsLoading } = useAdminSchools();
  const schoolList = useMemo(() => (schools ?? []).map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name)), [schools]);

  // Licenses matching the school and the search (filtered on the server)
  const [allLicenses, setAllLicenses] = useState<LicenseItem[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [filterSchoolId, setFilterSchoolId] = useState<string>("all");
  // searchInput is what the box shows; filterSearch is the debounced value sent to the server.
  const [searchInput, setSearchInput] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [tab, setTab] = useState<Tab>("keys");

  const [editLic, setEditLic] = useState<LicenseItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteLic, setDeleteLic] = useState<LicenseItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFilterSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadAllLicenses = useCallback(async () => {
    setLoadingAll(true);
    setLoadError(false);
    try {
      const { data } = await adminApi.licenses.list({
        schoolId: filterSchoolId !== "all" ? filterSchoolId : undefined,
        search: filterSearch || undefined,
      });
      setAllLicenses(licensesOf(data));
    } catch (e: unknown) {
      setLoadError(true);
      toast.error(errorText(e, "The licenses did not load."));
    } finally {
      setLoadingAll(false);
    }
  }, [filterSchoolId, filterSearch, toast]);

  useEffect(() => { void loadAllLicenses(); }, [loadAllLicenses]);

  const schoolName = (id: string) => schoolList.find((s) => s.id === id)?.name ?? "Unknown school";

  /* ───────── derived ───────── */
  const counts: Record<Stage, number> = { active: 0, soon: 0, expired: 0, off: 0 };
  allLicenses.forEach((l) => { counts[stageOf(l)] += 1; });
  const mismatches = allLicenses.filter((l) => l.key_build_mismatch).length;
  const schoolsCovered = new Set(allLicenses.map((l) => l.school_id)).size;
  const shown = allLicenses.filter((l) => (!stage || stageOf(l) === stage) && (!mismatchOnly || l.key_build_mismatch));
  const hasFilters = filterSchoolId !== "all" || !!searchInput || stage !== null || mismatchOnly;
  const clearFilters = () => { setFilterSchoolId("all"); setSearchInput(""); setFilterSearch(""); setStage(null); setMismatchOnly(false); };
  const goKeys = (s: Stage | null, mm = false) => { setTab("keys"); setStage(s); setMismatchOnly(mm); };

  /* ───────── actions ───────── */
  const added = (created: LicenseItem | undefined) => {
    if (created) setAllLicenses((prev) => [created, ...prev]);
    else void loadAllLicenses();
  };

  const saveEdit = async (v: EditValues, regenerate: boolean) => {
    if (!editLic) return;
    const label = v.systemLabel.trim();
    if (!label) return toast.error("The computer needs a name.");
    // Only send what changed, so the key is not re-issued for nothing.
    const payload: Record<string, unknown> = {};
    if (label !== editLic.system_label) payload.systemLabel = label;
    const notes = v.notes.trim();
    if (notes !== (editLic.notes ?? "")) payload.notes = notes || null;
    if (v.isActive !== editLic.is_active) payload.isActive = v.isActive;
    const machineId = v.machineId.trim().toUpperCase();
    if (machineId !== editLic.machine_id) {
      if (!MACHINE_ID_RE.test(machineId)) return toast.error("The machine ID is 16 letters and numbers (0 to 9, A to F).");
      payload.machineId = machineId;
    }
    const durationDays = Math.floor(Number(v.durationDays));
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 20000) return toast.error("Days valid must be between 1 and 20000.");
    if (durationDays !== editLic.duration_days) payload.durationDays = durationDays;
    if (v.startDate && v.startDate !== editLic.start_date) payload.startDate = v.startDate;
    if (regenerate) payload.regenerate = true;
    if (Object.keys(payload).length === 0) { setEditLic(null); return; }

    setSavingEdit(true);
    try {
      const { data } = await adminApi.licenses.update(editLic.id, payload);
      const updated = payloadOf(data).license as LicenseItem | undefined;
      if (updated) setAllLicenses((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      else await loadAllLicenses();
      toast.success(regenerate ? "A new key was made. Give it to the computer." : "License saved.");
      setEditLic(null);
    } catch (e) {
      toast.error(errorText(e, "Could not save the license."));
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteLic) return;
    setDeleting(true);
    try {
      await adminApi.licenses.delete(deleteLic.id);
      setAllLicenses((prev) => prev.filter((l) => l.id !== deleteLic.id));
      toast.success("License deleted.");
      setDeleteLic(null);
    } catch (e) {
      toast.error(errorText(e, "Could not delete the license."));
    } finally {
      setDeleting(false);
    }
  };

  /* ───────── copy ───────── */
  let status: React.ReactNode;
  if (loadingAll && allLicenses.length === 0) status = "Loading licenses…";
  else if (loadError) status = "The licenses did not load. Try again.";
  else if (allLicenses.length === 0) status = hasFilters ? "No licenses match." : "No licenses yet. Make a key for a lab computer.";
  else if (mismatches > 0) status = <><strong>{plural(mismatches, "key")}</strong> will be rejected by the current build. Make {mismatches === 1 ? "it" : "them"} again.</>;
  else if (counts.expired > 0 || counts.soon > 0) status = <><strong>{plural(counts.expired + counts.soon, "license")}</strong> {counts.expired + counts.soon === 1 ? "has" : "have"} run out or {counts.expired + counts.soon === 1 ? "is" : "are"} about to.</>;
  else status = <><strong>{plural(counts.active, "computer")}</strong> {counts.active === 1 ? "is" : "are"} licensed across {plural(schoolsCovered, "school")}.</>;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="lc-title">
        <div className="sd-hero-copy">
          <h1 id="lc-title" className="mc-hero-title">RoboCoders licenses</h1>
          <p className="sd-where">Offline keys, one for each lab computer</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => setTab("make")}><Plus aria-hidden="true" />Make keys</button>
            {mismatches > 0 && <button className="sd-btn sd-btn--ghost-dark" onClick={() => goKeys(null, true)}>Show {plural(mismatches, "key")} to redo</button>}
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => setTab("tools")}>Add or check a key</button>
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void loadAllLicenses()} disabled={loadingAll} aria-label={loadingAll ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loadingAll ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {loadingAll && allLicenses.length === 0 ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <LicenseRun counts={counts} selected={stage} onSelect={(s) => goKeys(s)} caption={filterSearch ? "Matching your search" : filterSchoolId !== "all" ? schoolName(filterSchoolId) : "Across every school"} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="License numbers">
        <button type="button" aria-pressed={!stage && !mismatchOnly && tab === "keys"} onClick={() => goKeys(null)}>
          <span className="sd-l">Computers</span><b className="sd-n">{allLicenses.length}</b><small>{plural(schoolsCovered, "school")}</small>
        </button>
        <button type="button" aria-pressed={stage === "active"} onClick={() => goKeys(stage === "active" ? null : "active")}>
          <span className="sd-l">Working now</span><b className="sd-n">{counts.active + counts.soon}</b><small>{counts.soon > 0 ? `${counts.soon} running out soon` : "None running out soon"}</small>
        </button>
        <button type="button" aria-pressed={stage === "soon"} className={counts.soon > 0 ? "lc-hot" : undefined} onClick={() => goKeys(stage === "soon" ? null : "soon")}>
          <span className="sd-l">Renew within {SOON_DAYS} days</span><b className="sd-n">{counts.soon}</b><small>{counts.soon > 0 ? "Tap to see which" : "Nothing to renew"}</small>
        </button>
        <button type="button" aria-pressed={mismatchOnly} className={mismatches > 0 ? "lc-hot" : undefined} onClick={() => goKeys(null, !mismatchOnly)}>
          <span className="sd-l">Keys to redo</span><b className="sd-n">{mismatches}</b><small>{mismatches > 0 ? "Rejected by the current build" : "All keys fit the build"}</small>
        </button>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Keys, make keys, tools" style={{ justifySelf: "start" }}>
        {([["keys", "Keys", allLicenses.length], ["make", "Make keys", undefined], ["tools", "Add or check", undefined]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" className="mc-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}{n != null && <b>{n}</b>}</button>
        ))}
      </div>

      {tab === "keys" && (
        loadError && allLicenses.length === 0 ? (
          <section className="sd-panel"><div className="sd-empty"><b>We could not load the licenses</b><p>Check your connection, then try again.</p><button className="sd-btn sd-btn--amber" onClick={() => void loadAllLicenses()}>Try again</button></div></section>
        ) : (
          <KeysTab
            licenses={shown}
            loading={loadingAll}
            hasFilters={hasFilters}
            schools={schoolList}
            schoolId={filterSchoolId}
            onSchool={setFilterSchoolId}
            searchInput={searchInput}
            onSearch={setSearchInput}
            stage={stage}
            mismatchOnly={mismatchOnly}
            onClear={clearFilters}
            schoolName={schoolName}
            onEdit={setEditLic}
            onDelete={setDeleteLic}
            onMake={() => setTab("make")}
          />
        )
      )}
      {tab === "make" && (
        <MakeTab
          schools={schoolList}
          schoolsLoading={schoolsLoading}
          onCreated={added}
          onConflict={(found) => { setFilterSchoolId(found.school_id); setSearchInput(found.machine_id); setFilterSearch(found.machine_id); setTab("keys"); setEditLic(found); }}
        />
      )}
      {tab === "tools" && <ToolsTab schools={schoolList} schoolsLoading={schoolsLoading} onImported={added} />}

      {editLic && <EditModal key={editLic.id} license={editLic} schoolName={schoolName(editLic.school_id)} busy={savingEdit} onClose={() => setEditLic(null)} onSave={(v, regen) => void saveEdit(v, regen)} />}

      <ConfirmModal
        open={!!deleteLic}
        onClose={() => setDeleteLic(null)}
        title="Delete this license?"
        subtitle={deleteLic ? `${deleteLic.system_label}, ${deleteLic.machine_id}` : undefined}
        confirmLabel="Delete license"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      >
        <p>This removes the record kept here. The key already typed into that computer keeps working until it expires.</p>
      </ConfirmModal>
    </div>
  );
}
