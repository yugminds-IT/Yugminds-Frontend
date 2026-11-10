"use client";

import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin.api";
import { getVerifyCertUrl } from "@/lib/brand-host";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { requestClose, useBeforeUnloadWhenDirty } from "@/hooks/useUnsavedCloseGuard";
import Modal from "@/components/portal/Modal";
import ConfirmModal from "@/components/portal/ConfirmModal";
import RowMenu from "@/components/portal/RowMenu";
import { Pager } from "@/components/portal/notifications";
import CertRun, { CERT_LABEL, CERT_ORDER, type CertStatus } from "@/components/admin/certificates/CertRun";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/certificates/certs.css";

interface Cert {
  id: string;
  short_id: string;
  student_id: number;
  student_name: string;
  student_email: string;
  school_id?: string | null;
  school_name?: string | null;
  grade?: string | null;
  section?: string | null;
  course_id: string;
  course_title: string;
  certificate_name: string;
  certificate_url: string;
  status: CertStatus;
  issued_at: string;
  issued_by: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

interface CertListResponse {
  total: number;
  page: number;
  limit: number;
  certificates: Cert[];
}

const LIMIT = 20;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function apiErrorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return typeof msg === "string" && msg ? msg : fallback;
}

/**
 * Downloads a certificate through the authenticated backend proxy.
 * A plain `<a download>` is a no-op for cross-origin (S3/CDN) URLs, and a
 * direct browser `fetch()` of the S3 URL fails unless the bucket has CORS
 * configured for this origin — the backend already holds S3 credentials, so
 * proxying through it sidesteps both problems.
 */
async function downloadCertificate(id: string, baseName: string) {
  const res = await adminApi.certificates.download(id);
  const blob = res.data as Blob;
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("svg") ? "svg" : "jpg";
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${baseName}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

type Confirm = "generate" | "redraw" | "fix" | "removeTemplate";

export default function AdminCertificatesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // List state
  const [tab, setTab] = useState<"certs" | "template">("certs");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<CertStatus | null>(null);
  const [schoolFilter, setSchoolFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");

  const { schools } = useAdminSchools();
  const selectedSchool = schools.find((s) => s.id === schoolFilter);
  const gradeOptions = selectedSchool?.grades ?? [];
  const selectedGrade = gradeOptions.find((g) => g.name === gradeFilter);
  const sectionOptions = selectedGrade?.sections ?? [];

  // Action states
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [previewCert, setPreviewCert] = useState<Cert | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [revokeIds, setRevokeIds] = useState<string[] | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  // Template state
  const [templateContent, setTemplateContent] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data, isLoading, isError, refetch } = useQuery<CertListResponse>({
    queryKey: ["adminCertificates", page, search, statusFilter, schoolFilter, gradeFilter, sectionFilter],
    queryFn: async () => {
      const res = await adminApi.certificates.list({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
        school_id: schoolFilter || undefined,
        grade: gradeFilter || undefined,
        section: sectionFilter || undefined,
      });
      return res.data;
    },
  });

  // Totals per status for the school/grade/section you are looking at (the list itself is paged).
  const { data: counts } = useQuery<Record<CertStatus, number>>({
    queryKey: ["adminCertCounts", schoolFilter, gradeFilter, sectionFilter],
    queryFn: async () => {
      const results = await Promise.all(
        CERT_ORDER.map((s) =>
          adminApi.certificates
            .list({ page: 1, limit: 1, status: s, school_id: schoolFilter || undefined, grade: gradeFilter || undefined, section: sectionFilter || undefined })
            .then((r) => (r.data as CertListResponse).total ?? 0)
            .catch(() => 0),
        ),
      );
      return { active: results[0], pending: results[1], broken: results[2], revoked: results[3] };
    },
  });

  const { data: templateData, isLoading: templateLoading } = useQuery<{ template: string | null }>({
    queryKey: ["adminCertTemplate"],
    queryFn: async () => {
      const res = await adminApi.certificates.getTemplate();
      return res.data;
    },
    enabled: tab === "template",
  });

  const savedTemplate = templateData?.template ?? "";
  const templateIsDirty = useMemo(() => {
    if (tab !== "template") return false;
    // Dirty once the editor has local edits that differ from the last saved template.
    return templateContent !== "" && templateContent !== savedTemplate;
  }, [tab, templateContent, savedTemplate]);
  useBeforeUnloadWhenDirty(templateIsDirty);

  const certs = data?.certificates ?? [];
  const total = data?.total ?? 0;
  const runCounts: Record<CertStatus, number> = counts ?? { active: 0, pending: 0, broken: 0, revoked: 0 };
  const needFixing = runCounts.pending + runCounts.broken;
  const fixableOnPage = certs.filter((c) => c.status === "pending" || c.status === "broken");
  const selectable = certs.filter((c) => c.status !== "revoked");
  const revokableIds = selected.filter((id) => certs.find((x) => x.id === id && x.status !== "revoked"));
  const hasFilters = !!search || statusFilter !== null || !!schoolFilter || !!gradeFilter || !!sectionFilter;

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
    void queryClient.invalidateQueries({ queryKey: ["adminCertCounts"] });
  };

  // ─── Actions ───────────────────────────────────────────────────────────────

  const goTab = (next: "certs" | "template") => {
    if (next === tab) return;
    if (tab === "template") {
      void requestClose(templateIsDirty, () => { setTemplateContent(""); setTab(next); });
    } else setTab(next);
  };

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };
  const clearFilters = () => {
    setSearch(""); setSearchInput(""); setStatusFilter(null); setSchoolFilter(""); setGradeFilter(""); setSectionFilter(""); setPage(1);
  };
  const pickStatus = (s: CertStatus | null) => { setStatusFilter(s); setPage(1); setSelected([]); };

  const toggleSelected = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = () => setSelected((prev) => (prev.length === selectable.length ? [] : selectable.map((c) => c.id)));

  const openRevoke = (ids: string[]) => { setRevokeReason(""); setRevokeIds(ids); };

  const confirmRevoke = async () => {
    if (!revokeIds?.length) return;
    setRevoking(true);
    try {
      if (revokeIds.length === 1) {
        await adminApi.certificates.revoke(revokeIds[0], revokeReason.trim() || undefined);
        toast.success("Certificate revoked. The student was told.");
      } else {
        const res = await adminApi.certificates.bulkRevoke(revokeIds, revokeReason.trim() || undefined);
        const d = res.data as { revoked?: number };
        toast.success(`Revoked ${plural(d.revoked ?? revokeIds.length, "certificate")}. The students were told.`);
      }
      setSelected((prev) => prev.filter((id) => !revokeIds.includes(id)));
      setRevokeIds(null);
      refreshAll();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not revoke. Try again."));
    } finally {
      setRevoking(false);
    }
  };

  const handleVerify = async () => {
    if (certs.length === 0) return;
    setVerifying(true);
    try {
      const res = await adminApi.certificates.verify(certs.map((c) => c.id));
      const d = res.data as { results?: Array<{ id: string; status: string }> };
      const brokenFound = (d.results ?? []).filter((r) => r.status === "broken").length;
      toast.success(brokenFound > 0 ? `Checked this page. ${plural(brokenFound, "certificate")} broken.` : "Checked this page. Every certificate is healthy.");
      refreshAll();
    } catch {
      toast.error("The check did not finish. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleRegenerate = async (cert: Cert) => {
    setRegenerating(cert.id);
    try {
      await adminApi.certificates.regenerate(cert.id);
      toast.success(`Redrew the certificate for ${cert.student_name}.`);
      refreshAll();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not redraw the certificate."));
    } finally {
      setRegenerating(null);
    }
  };

  const runConfirmed = async () => {
    const kind = confirm;
    if (!kind) return;
    if (kind === "removeTemplate") {
      setDeletingTemplate(true);
      try {
        await adminApi.certificates.deleteTemplate();
        setTemplateContent("");
        toast.success("Custom template removed. Certificates use the default design again.");
        void queryClient.invalidateQueries({ queryKey: ["adminCertTemplate"] });
        setConfirm(null);
      } catch {
        toast.error("Could not remove the template.");
      } finally {
        setDeletingTemplate(false);
      }
      return;
    }
    setBatchLoading(true);
    try {
      if (kind === "fix") {
        let ok = 0;
        for (const cert of fixableOnPage) {
          try { await adminApi.certificates.regenerate(cert.id); ok++; } catch { /* skip */ }
        }
        toast.success(`Fixed ${ok} of ${fixableOnPage.length} certificates.`);
      } else if (kind === "redraw") {
        const res = await adminApi.certificates.regenerateAll();
        const d = res.data as { regenerated?: number; failed?: number };
        if (d.failed) toast.error(`Redrew ${d.regenerated ?? 0} certificates. ${d.failed} failed.`);
        else toast.success(`Redrew ${d.regenerated ?? 0} certificates.`);
      } else {
        const res = await adminApi.certificates.generateAllEligible();
        const d = res.data as { generated?: number; skipped?: number; failed?: number; warning?: string | null };
        toast.success(`Made ${d.generated ?? 0} new certificates. ${d.skipped ?? 0} skipped.`);
        if (d.warning) toast.error(d.warning);
      }
      setConfirm(null);
      refreshAll();
    } catch (e) {
      toast.error(apiErrorMessage(e, "That did not finish. Try again."));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied.")).catch(() => {});
  };

  const handleDownload = async (cert: Cert) => {
    try {
      await downloadCertificate(cert.id, cert.short_id);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not download the certificate."));
    }
  };

  // ─── Template actions ───────────────────────────────────────────────────────

  const handleTemplateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".svg")) { toast.error("Only SVG files work as a template."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setTemplateContent(String(ev.target?.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveTemplate = async () => {
    if (!templateContent.trim()) { toast.error("The template is empty."); return; }
    setSavingTemplate(true);
    try {
      await adminApi.certificates.saveTemplate(templateContent);
      toast.success("Template saved. New certificates use it. Redraw all certificates to update the old ones.");
      await queryClient.invalidateQueries({ queryKey: ["adminCertTemplate"] });
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not save the template."));
    } finally {
      setSavingTemplate(false);
    }
  };

  const sampleSvg = (templateContent || savedTemplate)
    .replace(/\{\{studentName\}\}/g, "John Smith")
    .replace(/\{\{courseTitle\}\}/g, "Introduction to Scratch")
    .replace(/\{\{issuedAt\}\}/g, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))
    .replace(/\{\{certificateId\}\}/g, "YM-SAMPLE1");

  // ─── Copy ───────────────────────────────────────────────────────────────────

  let status: React.ReactNode;
  if (isError) status = "The certificates did not load. Try again.";
  else if (isLoading && !data) status = "Loading certificates…";
  else if (needFixing > 0) status = <><strong>{plural(needFixing, "certificate")}</strong> {needFixing === 1 ? "needs" : "need"} fixing.</>;
  else if (runCounts.active + runCounts.revoked === 0) status = "No certificates yet. Students get one when they finish a course.";
  else status = <><strong>{plural(runCounts.active, "certificate")}</strong> {runCounts.active === 1 ? "is" : "are"} active and healthy.</>;

  const confirmCopy: Record<Confirm, { title: string; body: string; label: string; danger?: boolean }> = {
    generate: { title: "Make certificates for everyone eligible?", body: "Students who finished a course and do not have a certificate yet get one now. This can take a moment.", label: "Make certificates" },
    redraw: { title: "Redraw every certificate?", body: "Each certificate image is made again with the current template and fonts. Certificate IDs and issue dates stay the same.", label: "Redraw all" },
    fix: { title: `Fix ${plural(fixableOnPage.length, "certificate")} on this page?`, body: "Pending and broken certificates on this page are drawn again.", label: "Fix them" },
    removeTemplate: { title: "Remove the custom template?", body: "Certificates fall back to the built-in design.", label: "Remove template", danger: true },
  };

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="ce-title">
        <div className="sd-hero-copy">
          <h1 id="ce-title" className="mc-hero-title">Certificates</h1>
          <p className="sd-where">Proof that students finished a course</p>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            <button className="sd-btn sd-btn--amber" onClick={() => setConfirm("generate")} disabled={batchLoading}>
              {batchLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Zap aria-hidden="true" />}Make for everyone eligible
            </button>
            <button className="sd-btn sd-btn--ghost-dark" onClick={() => goTab(tab === "certs" ? "template" : "certs")}>
              {tab === "certs" ? "Edit the template" : "Back to certificates"}
            </button>
            <RowMenu
              label="More certificate actions"
              align="start"
              buttonClassName="sd-btn sd-btn--ghost-dark"
              button={<><Wrench aria-hidden="true" />Maintenance</>}
              items={[
                { label: "Check this page", icon: ShieldCheck, onClick: () => void handleVerify() },
                { label: "Redraw all certificates", icon: RotateCcw, onClick: () => setConfirm("redraw") },
                { label: "Refresh", icon: RefreshCw, onClick: refreshAll },
              ]}
            />
          </div>
          <div className="so-meta">
            {verifying && <p className="so-live" data-on="true"><i aria-hidden="true" />Checking…</p>}
          </div>
        </div>
        {isLoading && !counts ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <CertRun counts={runCounts} selected={statusFilter} onSelect={pickStatus} caption={schoolFilter ? "For the school you picked" : "Across every school"} />
        )}
      </section>

      <div className="mc-tabs" role="tablist" aria-label="Certificates and template" style={{ justifySelf: "start" }}>
        <button role="tab" className="mc-tab" aria-selected={tab === "certs"} onClick={() => goTab("certs")}>Certificates<b>{runCounts.active + runCounts.pending + runCounts.broken + runCounts.revoked}</b></button>
        <button role="tab" className="mc-tab" aria-selected={tab === "template"} onClick={() => goTab("template")}>Template</button>
      </div>

      {tab === "certs" ? (
        <>
          <div className="ce-bar">
            <form className="sd-search" onSubmit={submitSearch} role="search">
              <Search aria-hidden="true" />
              <input type="search" placeholder="Search by student or course, then press Enter" aria-label="Search certificates" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </form>
            <select className="sd-field" aria-label="School" value={schoolFilter} onChange={(e) => { setSchoolFilter(e.target.value); setGradeFilter(""); setSectionFilter(""); setPage(1); }}>
              <option value="">All schools</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="sd-field" aria-label="Grade" value={gradeFilter} disabled={!schoolFilter || gradeOptions.length === 0} onChange={(e) => { setGradeFilter(e.target.value); setSectionFilter(""); setPage(1); }}>
              <option value="">All grades</option>
              {gradeOptions.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
            <select className="sd-field" aria-label="Section" value={sectionFilter} disabled={!gradeFilter || sectionOptions.length === 0} onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}>
              <option value="">All sections</option>
              {sectionOptions.map((sec) => <option key={sec.id} value={sec.name}>{sec.name}</option>)}
            </select>
            {statusFilter && <span className="sm-chip" data-class="true">{CERT_LABEL[statusFilter]}</span>}
            {hasFilters && <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>}
            {fixableOnPage.length > 0 && (
              <button className="sd-btn sd-btn--line" style={{ marginLeft: "auto" }} onClick={() => setConfirm("fix")} disabled={batchLoading}>
                <RotateCcw aria-hidden="true" />Fix {fixableOnPage.length} on this page
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
          ) : isError ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>We could not load the certificates</b>
                <p>Check your connection, then try again.</p>
                <button className="sd-btn sd-btn--amber" onClick={() => void refetch()}>Try again</button>
              </div>
            </section>
          ) : certs.length === 0 ? (
            <section className="sd-panel">
              <div className="sd-empty">
                <b>{hasFilters ? "No certificates match" : "No certificates yet"}</b>
                <p>{hasFilters ? "Try a different search, or clear the filters." : "Students get a certificate when they finish a course. You can also make them now for everyone who is eligible."}</p>
                {hasFilters
                  ? <button className="sd-btn sd-btn--line" onClick={clearFilters}>Clear filters</button>
                  : <button className="sd-btn sd-btn--amber" onClick={() => setConfirm("generate")}><Zap aria-hidden="true" />Make for everyone eligible</button>}
              </div>
            </section>
          ) : (
            <section className="sd-panel ce-list mc-swap" aria-label="Certificates">
              <div className="ce-head">
                <input type="checkbox" className="ce-check" aria-label="Select every certificate on this page" checked={selectable.length > 0 && selected.length === selectable.length} onChange={toggleSelectAll} />
                <span>Student</span>
                <span>School</span>
                <span>Course</span>
                <span>Certificate ID</span>
                <span>Issued</span>
                <span>Status</span>
                <span />
              </div>
              {certs.map((cert) => {
                const canView = cert.status !== "revoked" && cert.status !== "pending";
                const items = [
                  ...(canView ? [
                    { label: "Download", icon: Download, onClick: () => void handleDownload(cert) },
                    { label: "Open public verify page", icon: ExternalLink, onClick: () => window.open(getVerifyCertUrl(cert.short_id), "_blank", "noopener,noreferrer") },
                  ] : []),
                  ...(cert.status !== "revoked" ? [
                    { label: "Redraw certificate", icon: RotateCcw, onClick: () => void handleRegenerate(cert) },
                    { label: "Revoke certificate", icon: Ban, onClick: () => openRevoke([cert.id]), danger: true, separatorBefore: true },
                  ] : []),
                ];
                return (
                  <div key={cert.id} className="ce-row" data-picked={selected.includes(cert.id)} data-revoked={cert.status === "revoked"}>
                    <input type="checkbox" className="ce-check" aria-label={`Select ${cert.student_name}`} checked={selected.includes(cert.id)} disabled={cert.status === "revoked"} onChange={() => toggleSelected(cert.id)} />
                    <span className="ce-who"><b>{cert.student_name}</b><small>{cert.student_email}</small></span>
                    <span className="ce-school"><b>{cert.school_name ?? "No school"}</b><small>{[cert.grade, cert.section].filter(Boolean).join(" · ") || " "}</small></span>
                    <span className="ce-course">{cert.course_title}</span>
                    <span className="ce-id">
                      <code>{cert.short_id}</code>
                      <button type="button" onClick={() => handleCopy(cert.short_id)} aria-label={`Copy ${cert.short_id}`}><Copy /></button>
                    </span>
                    <span className="ce-issued">{day(cert.issued_at)}{cert.status === "revoked" && cert.revoked_reason && <small title={cert.revoked_reason}>Reason given</small>}</span>
                    <span className="ce-chip" data-s={cert.status}>{CERT_LABEL[cert.status]}</span>
                    <span className="ce-acts">
                      {canView && <button type="button" className="pl-ico" aria-label={`Preview ${cert.student_name}'s certificate`} onClick={() => setPreviewCert(cert)}><Eye /></button>}
                      {regenerating === cert.id ? <Loader2 className="animate-spin" aria-label="Redrawing" style={{ width: "1.2rem", height: "1.2rem", margin: "0 0.5rem" }} /> : items.length > 0 && <RowMenu label={`Actions for ${cert.student_name}'s certificate`} items={items} />}
                    </span>
                  </div>
                );
              })}
              <Pager offset={(page - 1) * LIMIT} count={certs.length} total={total} pageSize={LIMIT} noun="certificates" onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
            </section>
          )}

          {revokableIds.length > 0 && (
            <div className="ce-selbar" role="region" aria-label="Selected certificates">
              <b>{plural(revokableIds.length, "certificate")} selected</b>
              <div>
                <button className="sd-btn sd-btn--line" onClick={() => setSelected([])}>Clear</button>
                <button className="sd-btn sd-btn--danger" onClick={() => openRevoke(revokableIds)}><Ban aria-hidden="true" />Revoke</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <section className="sd-panel" aria-labelledby="ce-tpl">
          <div className="sd-panel-head">
            <div>
              <h2 id="ce-tpl">Certificate template</h2>
              <p>Upload your own SVG design. These placeholders are filled in for each student:</p>
              <div className="ce-holders">
                {["{{studentName}}", "{{courseTitle}}", "{{issuedAt}}", "{{certificateId}}"].map((h) => <code key={h}>{h}</code>)}
              </div>
            </div>
          </div>
          {templateLoading ? (
            <><div className="sd-skel" /><div className="sd-skel" /></>
          ) : (
            <>
              <div className="ce-state" data-on={!!templateData?.template}>
                {templateData?.template ? (
                  <>
                    <span><CheckCircle2 aria-hidden="true" />A custom template is in use</span>
                    <div>
                      {!templateContent && <button className="sd-btn sd-btn--line" onClick={() => setTemplateContent(templateData.template ?? "")}>Edit it</button>}
                      <button className="sd-btn sd-btn--line" onClick={() => setConfirm("removeTemplate")} disabled={deletingTemplate}>
                        {deletingTemplate ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <span>No custom template. Certificates use the built-in design.</span>
                )}
              </div>

              <div className="ce-two" style={{ marginTop: "1.25rem" }}>
                <div className="sd-field-wrap">
                  <div className="ce-tools">
                    <label htmlFor="ce-code" style={{ marginRight: "auto" }}>SVG code</label>
                    <button className="sd-btn sd-btn--line" onClick={() => fileInputRef.current?.click()}><Upload aria-hidden="true" />Upload an SVG</button>
                    {templateContent && <button className="sd-btn sd-btn--line" onClick={() => setTemplateContent("")}><X aria-hidden="true" />Clear</button>}
                    <input ref={fileInputRef} type="file" accept=".svg" className="hidden" onChange={handleTemplateFileUpload} aria-label="Upload an SVG template" />
                  </div>
                  <textarea
                    id="ce-code"
                    className="ce-code"
                    spellCheck={false}
                    placeholder="Upload a file, or paste your SVG here"
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                  />
                </div>
                <div className="sd-field-wrap">
                  <label>Preview with sample data</label>
                  <div className="ce-sample">
                    {(templateContent || savedTemplate) ? (
                      // <img> renders the SVG without running any scripts it contains.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="Certificate template preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg)}`} />
                    ) : (
                      <p className="ce-sample-empty">The preview shows here once you add a template.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="ce-foot">
                <button className="sd-btn sd-btn--amber" onClick={() => void handleSaveTemplate()} disabled={savingTemplate || !templateContent.trim() || templateContent === savedTemplate}>
                  {savingTemplate ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}Save template
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <Modal
        open={!!previewCert}
        onClose={() => setPreviewCert(null)}
        wide
        title={previewCert?.certificate_name ?? "Certificate"}
        subtitle={previewCert ? `${previewCert.student_name}, ${previewCert.course_title}` : undefined}
        footer={
          previewCert && (
            <>
              <a className="sd-btn sd-btn--line" href={getVerifyCertUrl(previewCert.short_id)} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open verify page</a>
              <button className="sd-btn sd-btn--amber" onClick={() => void handleDownload(previewCert)}><Download aria-hidden="true" />Download</button>
            </>
          )
        }
      >
        {previewCert && (
          <div className="ce-preview">
            <div className="ce-preview-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewCert.certificate_url} alt={previewCert.certificate_name} />
            </div>
            <p className="ce-facts">
              <span>ID <b>{previewCert.short_id}</b></span>
              <span>Issued <b>{day(previewCert.issued_at)}</b></span>
              {previewCert.issued_by && <span>By <b>{previewCert.issued_by}</b></span>}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={revokeIds !== null}
        onClose={() => { if (!revoking) setRevokeIds(null); }}
        title={`Revoke ${plural(revokeIds?.length ?? 0, "certificate")}?`}
        subtitle="The students are told. This cannot be undone."
        footer={
          <>
            <button className="sd-btn sd-btn--line" onClick={() => setRevokeIds(null)} disabled={revoking}>Cancel</button>
            <button className="sd-btn sd-btn--danger" onClick={() => void confirmRevoke()} disabled={revoking}>
              {revoking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Ban aria-hidden="true" />}Revoke
            </button>
          </>
        }
      >
        <div className="sd-field-wrap">
          <label htmlFor="ce-reason">Reason <small>(optional, the student sees it)</small></label>
          <textarea id="ce-reason" className="sd-field" rows={3} placeholder="For example, issued by mistake" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
        </div>
      </Modal>

      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? confirmCopy[confirm].title : ""}
        confirmLabel={confirm ? confirmCopy[confirm].label : ""}
        danger={confirm ? confirmCopy[confirm].danger : false}
        busy={batchLoading || deletingTemplate}
        onConfirm={() => void runConfirmed()}
      >
        <p>{confirm ? confirmCopy[confirm].body : ""}</p>
      </ConfirmModal>
    </div>
  );
}
