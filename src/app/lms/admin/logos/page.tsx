"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, ImageIcon, Loader2, Pencil, Plus, RefreshCw, Replace, Search, Trash2, TriangleAlert, Upload } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import RowMenu from "@/components/portal/RowMenu";
import { Pager } from "@/components/portal/notifications";
import LogoRun, { type LogoView } from "@/components/admin/logos/LogoRun";
import EditLogoModal, { type LogoItem, type SchoolOption } from "@/components/admin/logos/EditLogoModal";
import { LogoFramer, DEFAULT_FRAMING, isDefaultFraming, renderFramedLogo, type Framing } from "@/components/admin/LogoFramer";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/logos/logos.css";

type Tab = "manage" | "upload";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** The logos endpoint answers in a few shapes; this finds the list and the total in any of them. */
function readLogos(data: unknown): { items: LogoItem[]; total: number } {
  const root = (data ?? {}) as Record<string, unknown>;
  const payload = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? (root.data as Record<string, unknown>) : root;
  return {
    items: asArray<LogoItem>(payload.logos ?? payload.data ?? payload.items ?? payload),
    total: Number(payload.total ?? root.total ?? 0),
  };
}

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : "") || fallback;

const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function LogoManagementPage() {
  const { schools: rawSchools, isLoading: schoolsLoading } = useAdminSchools();
  const schools = useMemo<SchoolOption[]>(() => rawSchools.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name)), [rawSchools]);

  const [tab, setTab] = useState<Tab>("manage");
  const [view, setView] = useState<LogoView>("have");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(24);
  const [offset, setOffset] = useState(0);
  // searchInput is what the box shows; search is the debounced value sent to the backend.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Which schools already have a (non-deleted) logo, and how many logos exist in all. The pickers flag
  // "already has a logo" so nobody creates an orphaned duplicate by accident.
  const [schoolIdsWithLogo, setSchoolIdsWithLogo] = useState<Set<string>>(new Set());
  const [allCount, setAllCount] = useState<number | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [framing, setFraming] = useState<Framing>(DEFAULT_FRAMING);
  const [uploadSchoolId, setUploadSchoolId] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceForId = useRef<string | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{ id: string; hard: boolean; schoolName: string } | null>(null);

  const [editLogo, setEditLogo] = useState<LogoItem | null>(null);
  const [editSchoolId, setEditSchoolId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchLogos = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.logos.list({ limit, offset, search: search || undefined });
      const r = readLogos(data);
      setLogos(r.items);
      setTotal(r.total);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, search]);

  useEffect(() => {
    void fetchLogos();
  }, [fetchLogos]);

  const refreshSchoolLogoSet = useCallback(async () => {
    try {
      const { data } = await adminApi.logos.list({ limit: 500 });
      const r = readLogos(data);
      setSchoolIdsWithLogo(new Set(r.items.map((l) => l.school_id).filter((id): id is string => !!id)));
      setAllCount(r.total || r.items.length);
    } catch {
      /* non-critical: the "already has a logo" hint just will not show */
    }
  }, []);

  useEffect(() => {
    void refreshSchoolLogoSet();
  }, [refreshSchoolLogoSet]);

  const refreshAll = () => {
    void fetchLogos();
    void refreshSchoolLogoSet();
  };

  const schoolsWithout = useMemo(() => schools.filter((s) => !schoolIdsWithLogo.has(s.id)), [schools, schoolIdsWithLogo]);
  const counts = { have: schools.length - schoolsWithout.length, missing: schoolsWithout.length };
  const needle = searchInput.trim().toLowerCase();
  const missingShown = needle ? schoolsWithout.filter((s) => s.name.toLowerCase().includes(needle)) : schoolsWithout;
  const ready = !schoolsLoading && allCount != null;
  const showingMissing = view === "missing";

  const goUpload = (schoolId?: string) => {
    if (schoolId) setUploadSchoolId(schoolId);
    setTab("upload");
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setFraming(DEFAULT_FRAMING);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  };

  const clearUpload = () => {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFraming(DEFAULT_FRAMING);
    setUploadSchoolId("");
    setUploadDescription("");
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
  };

  const validateFileClient = async (f: File): Promise<{ ok: boolean; error?: string }> => {
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(f.type)) return { ok: false, error: "Only JPG, PNG or SVG files are allowed" };
    if (f.size > 2 * 1024 * 1024) return { ok: false, error: "The file is over 2 MB. Choose a smaller one." };
    // SVGs have no pixel dimensions, so there is no size check
    if (f.type === "image/svg+xml") return { ok: true };
    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(f);
      img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.width, h: img.height }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
    if (!dims || dims.w < 300 || dims.h < 300) return { ok: false, error: "The image must be at least 300 × 300 px" };
    return { ok: true };
  };

  const handleUpload = async () => {
    if (!uploadSchoolId) { toast.error("Choose a school first"); return; }
    if (!file) { toast.error("Choose a logo file first"); return; }
    const v = await validateFileClient(file);
    if (!v.ok) { toast.error(v.error!); return; }
    try {
      setUploading(true);
      const toUpload = previewUrl && !isDefaultFraming(framing) ? await renderFramedLogo(previewUrl, framing, file) : file;
      const fd = new FormData();
      fd.append("file", toUpload);
      fd.append("school_id", uploadSchoolId);
      if (uploadDescription.trim()) fd.append("description", uploadDescription.trim());
      await adminApi.logos.create(fd);
      toast.success("Logo uploaded");
      clearUpload();
      setOffset(0);
      setView("have");
      setTab("manage"); // so the new logo is right there
      refreshAll();
    } catch (e) {
      toast.error(errText(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (id: string, f: File, inputEl: HTMLInputElement) => {
    const v = await validateFileClient(f);
    inputEl.value = ""; // so the same file can be picked again
    if (!v.ok) { toast.error(v.error!); return; }
    try {
      setActionLoadingId(id);
      const fd = new FormData();
      fd.append("replace_image", "true");
      fd.append("file", f);
      await adminApi.logos.update(id, fd);
      toast.success("Logo image replaced");
      void fetchLogos();
    } catch (e) {
      toast.error(errText(e, "Replace failed"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteDialog) return;
    const { id, hard } = deleteDialog;
    setDeleteDialog(null);
    try {
      setActionLoadingId(id);
      await adminApi.logos.delete(id, hard);
      toast.success(hard ? "Logo deleted permanently" : "Logo hidden");
      refreshAll();
    } catch (e) {
      toast.error(errText(e, "Delete failed"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEdit = (logo: LogoItem) => {
    setEditLogo(logo);
    setEditSchoolId(logo.school_id ?? "");
    setEditDescription(logo.description ?? "");
  };

  const isEditDirty = !!editLogo && (editSchoolId !== (editLogo.school_id ?? "") || editDescription !== (editLogo.description ?? ""));
  const requestCloseEdit = () => { void requestClose(isEditDirty, () => setEditLogo(null)); };

  const handleEditSave = async () => {
    if (!editLogo) return;
    try {
      setEditSaving(true);
      const fd = new FormData();
      if (editSchoolId) fd.append("school_id", editSchoolId);
      fd.append("description", editDescription.trim());
      await adminApi.logos.update(editLogo.id, fd);
      toast.success("Logo updated");
      setEditLogo(null);
      refreshAll();
    } catch (e) {
      toast.error(errText(e, "Update failed"));
    } finally {
      setEditSaving(false);
    }
  };

  let statusLine: React.ReactNode;
  if (!ready) statusLine = "Checking the logos…";
  else if (schools.length === 0) statusLine = "No schools on the platform yet.";
  else if (counts.missing > 0) statusLine = <><strong>{plural(counts.missing, "school")}</strong> {counts.missing === 1 ? "still needs" : "still need"} a logo.</>;
  else statusLine = <><strong>Every school has a logo.</strong> They show on public pages.</>;

  const runCaption = !ready ? "Loading…" : counts.missing > 0 ? `${plural(counts.missing, "school")} to add` : schools.length ? "Every school is covered" : "No schools yet";
  const dash = loadError && allCount == null;
  const selectedHasLogo = !!uploadSchoolId && schoolIdsWithLogo.has(uploadSchoolId);

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="lg-title">
        <div className="sd-hero-copy">
          <h1 id="lg-title" className="mc-hero-title">School logos</h1>
          <p className="sd-where">The face of each school</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => goUpload()}><Upload aria-hidden="true" />Upload a logo</button>
            {counts.missing > 0 && !showingMissing && (
              <button className="sd-btn sd-btn--ghost-dark" onClick={() => { setTab("manage"); setView("missing"); }}>Show {plural(counts.missing, "school")} without one</button>
            )}
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={refreshAll} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {!ready ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <LogoRun counts={counts} view={view} onSelect={(v) => { setTab("manage"); setView(v); }} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Logo numbers">
        <button type="button" aria-pressed={tab === "manage" && !showingMissing} onClick={() => { setTab("manage"); setView("have"); }}>
          <span className="sd-l">Logos on file</span><b className="sd-n">{dash || allCount == null ? "–" : allCount}</b><small>{dash ? "Not loaded" : "Hidden logos are not counted"}</small>
        </button>
        <button type="button" aria-pressed={false} onClick={() => { setTab("manage"); setView("have"); }}>
          <span className="sd-l">Schools covered</span><b className="sd-n">{ready ? `${counts.have} of ${schools.length}` : "–"}</b><small>{ready && schools.length > 0 ? `${Math.round((counts.have / schools.length) * 100)}% have a logo` : " "}</small>
        </button>
        <button type="button" aria-pressed={tab === "manage" && showingMissing} className={counts.missing > 0 ? "lg-hot" : undefined} onClick={() => { setTab("manage"); setView(showingMissing ? "have" : "missing"); }}>
          <span className="sd-l">Schools without a logo</span><b className="sd-n">{ready ? counts.missing : "–"}</b><small>{ready ? (counts.missing > 0 ? "Tap to see which" : "Nothing to add") : " "}</small>
        </button>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Browse or upload" style={{ justifySelf: "start" }}>
        <button role="tab" className="mc-tab" aria-selected={tab === "manage"} onClick={() => setTab("manage")}>Logos{allCount != null && <b>{allCount}</b>}</button>
        <button role="tab" className="mc-tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}>Upload new</button>
      </div>

      {tab === "upload" && (
        <section className="sd-panel mc-swap" aria-label="Upload a logo">
          <div className="sd-panel-head"><h2>Upload a logo</h2></div>
          <div className="lg-up">
            <div className="lg-up-form">
              <div className="sd-field-wrap">
                <label htmlFor="lg-school">School</label>
                <select id="lg-school" className="sd-field" value={uploadSchoolId} onChange={(e) => setUploadSchoolId(e.target.value)}>
                  <option value="">Choose a school…</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{schoolIdsWithLogo.has(s.id) ? " (already has a logo)" : ""}</option>
                  ))}
                </select>
                {selectedHasLogo && <p className="lg-warn"><TriangleAlert aria-hidden="true" />This school already has a logo. Use Replace image or Edit on the existing one instead.</p>}
              </div>
              <div className="sd-field-wrap">
                <label htmlFor="lg-desc">Description (optional)</label>
                <input id="lg-desc" className="sd-field" value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="e.g. Official school logo" />
              </div>
              <div className="sd-field-wrap">
                <label htmlFor="lg-file">Logo file</label>
                <div className="lg-drop" data-has={!!file}>
                  <input ref={uploadFileInputRef} id="lg-file" type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onFileChange} />
                  <ImageIcon aria-hidden="true" />
                  {file ? <><b>{file.name}</b><small>{sizeText(file.size)}. Choose another to change it.</small></> : <><b>Choose a file</b><small>or drop it here</small></>}
                </div>
                <p className="lg-rules">JPG, PNG or SVG. Up to 2 MB. At least 300 × 300 px for JPG and PNG.</p>
              </div>
              <div className="lg-up-acts">
                <button className="sd-btn sd-btn--amber" onClick={() => void handleUpload()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                  {uploading ? "Uploading…" : "Upload logo"}
                </button>
                {(file || uploadSchoolId || uploadDescription) && !uploading && <button className="sd-btn sd-btn--line" onClick={clearUpload}>Start over</button>}
              </div>
            </div>
            <div className="lg-up-prev">
              {previewUrl ? (
                <LogoFramer src={previewUrl} framing={framing} onChange={setFraming} />
              ) : (
                <div className="lg-prev-empty">
                  <ImageIcon aria-hidden="true" />
                  <p>Pick a file and it appears here. You can move and zoom it to fit the square the school logo is shown in.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "manage" && (
        <>
          <div className="lg-bar">
            <div className="sd-search" style={{ flex: "1 1 18rem", maxWidth: "30rem", width: "auto" }}>
              <Search aria-hidden="true" />
              <input type="search" placeholder="Search by school name" aria-label="Search logos by school name" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            {showingMissing && <span className="sm-chip" data-class="true">No logo yet</span>}
            {showingMissing && <button className="sd-btn sd-btn--line" onClick={() => setView("have")}>Show logos</button>}
          </div>

          {showingMissing ? (
            missingShown.length === 0 ? (
              <section className="sd-panel">
                <div className="sd-empty">
                  <b>{needle ? "No school matches" : "Every school has a logo"}</b>
                  <p>{needle ? "Try a different name." : "Nothing to add right now."}</p>
                  <button className="sd-btn sd-btn--line" onClick={() => { setSearchInput(""); setView("have"); }}>Show logos</button>
                </div>
              </section>
            ) : (
              <section className="sd-panel lg-gaps mc-swap" aria-label="Schools without a logo">
                {missingShown.map((s) => (
                  <div key={s.id} className="lg-gap">
                    <span><b>{s.name}</b><small>No logo on file</small></span>
                    <button className="sd-btn sd-btn--amber" onClick={() => goUpload(s.id)}><Plus aria-hidden="true" />Upload a logo</button>
                  </div>
                ))}
              </section>
            )
          ) : loading && logos.length === 0 ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : loadError && logos.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>We could not load the logos</b>
                <p>Check your connection, then try again.</p>
                <button className="sd-btn sd-btn--amber" onClick={() => void fetchLogos()}>Try again</button>
              </div>
            </section>
          ) : logos.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{search ? "No logos match" : "No logos yet"}</b>
                <p>{search ? "Try a different school name." : "Upload each school's logo and it shows on its public pages."}</p>
                {search ? <button className="sd-btn sd-btn--line" onClick={() => setSearchInput("")}>Clear search</button> : <button className="sd-btn sd-btn--amber" onClick={() => goUpload()}><Upload aria-hidden="true" />Upload a logo</button>}
              </div>
            </section>
          ) : (
            <section className="mc-swap" aria-label="Logos">
              <div className="lg-grid">
                {logos.map((logo) => (
                  <article key={logo.id} className="lg-card" data-busy={actionLoadingId === logo.id}>
                    <div className="lg-tile">
                      <Image src={logo.image_url} alt={`${logo.school_name} logo`} fill sizes="240px" className="lg-img" unoptimized />
                    </div>
                    <div className="lg-meta">
                      <span>
                        <b>{logo.school_name}</b>
                        <small>{logo.description || "No description"}</small>
                        {logo.upload_date && <small>Added {new Date(logo.upload_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small>}
                      </span>
                      {actionLoadingId === logo.id ? (
                        <span className="lg-busy"><Loader2 className="animate-spin" aria-hidden="true" width={16} height={16} />Working…</span>
                      ) : (
                        <RowMenu
                          label={`Actions for ${logo.school_name}`}
                          items={[
                            { label: "Edit details", icon: Pencil, onClick: () => openEdit(logo) },
                            { label: "Replace image", icon: Replace, onClick: () => { replaceForId.current = logo.id; replaceInputRef.current?.click(); } },
                            { label: "Hide logo", icon: EyeOff, onClick: () => setDeleteDialog({ id: logo.id, hard: false, schoolName: logo.school_name }), separatorBefore: true },
                            { label: "Delete permanently", icon: Trash2, onClick: () => setDeleteDialog({ id: logo.id, hard: true, schoolName: logo.school_name }), danger: true },
                          ]}
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <Pager offset={offset} count={logos.length} total={total} pageSize={limit} busy={loading} noun="logos" sizes={[12, 24, 48]} onSize={(n) => { setLimit(n); setOffset(0); }} onPrev={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />
            </section>
          )}
        </>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          const id = replaceForId.current;
          if (f && id) void handleReplace(id, f, e.target);
        }}
      />

      <ConfirmModal
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        title={deleteDialog?.hard ? "Delete this logo permanently?" : "Hide this logo?"}
        subtitle={deleteDialog?.schoolName}
        confirmLabel={deleteDialog?.hard ? "Delete permanently" : "Hide logo"}
        danger={!!deleteDialog?.hard}
        onConfirm={() => void handleDeleteConfirmed()}
      >
        <p style={{ margin: 0 }}>
          {deleteDialog?.hard
            ? <>This removes the logo for <strong>{deleteDialog.schoolName}</strong> for good. It cannot be undone.</>
            : <>The logo for <strong>{deleteDialog?.schoolName}</strong> stops showing on public pages. It stays in the database and can be restored from there.</>}
        </p>
      </ConfirmModal>

      <EditLogoModal
        logo={editLogo}
        schools={schools}
        withLogo={schoolIdsWithLogo}
        schoolId={editSchoolId}
        description={editDescription}
        onSchool={setEditSchoolId}
        onDescription={setEditDescription}
        saving={editSaving}
        onSave={() => void handleEditSave()}
        onClose={requestCloseEdit}
      />
    </div>
  );
}
