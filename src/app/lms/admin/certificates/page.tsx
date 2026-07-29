"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { adminApi } from "@/lib/api/admin.api";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import {
  Award,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Download,
  CheckCircle,
  AlertCircle,
  Upload,
  FileText,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Zap,
  RotateCcw,
  Shield,
  Copy,
  ExternalLink,
  ShieldCheck,
  Ban,
} from "lucide-react";

type CertStatus = "active" | "pending" | "broken" | "revoked";

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

export default function AdminCertificatesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // List state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [schoolFilter, setSchoolFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const LIMIT = 20;

  const { schools } = useAdminSchools();
  const selectedSchool = schools.find((s) => s.id === schoolFilter);
  const gradeOptions = selectedSchool?.grades ?? [];
  const selectedGrade = gradeOptions.find((g) => g.name === gradeFilter);
  const sectionOptions = selectedGrade?.sections ?? [];

  // Action states
  const [revoking, setRevoking] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bulkRevoking, setBulkRevoking] = useState(false);
  const [previewCert, setPreviewCert] = useState<Cert | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Template state
  const [templateTab, setTemplateTab] = useState(false);
  const [templateContent, setTemplateContent] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<CertListResponse>({
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

  const { data: templateData, isLoading: templateLoading } = useQuery<{ template: string | null }>({
    queryKey: ["adminCertTemplate"],
    queryFn: async () => {
      const res = await adminApi.certificates.getTemplate();
      return res.data;
    },
    enabled: templateTab,
  });

  const certs = data?.certificates ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const pendingCount = certs.filter((c) => c.status === "pending").length;
  const activeCount = certs.filter((c) => c.status === "active").length;
  const brokenCount = certs.filter((c) => c.status === "broken").length;
  const revokableIds = selected.filter((id) => {
    const c = certs.find((x) => x.id === id);
    return c && c.status !== "revoked";
  });

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const selectableIds = certs.filter((c) => c.status !== "revoked").map((c) => c.id);
    setSelected((prev) => (prev.length === selectableIds.length ? [] : selectableIds));
  };

  const handleRevoke = async (cert: Cert) => {
    if (!(await confirmDialog({
      title: 'Revoke this certificate?',
      description: `Revoke the certificate for ${cert.student_name} (${cert.course_title}). The student will be notified.`,
      confirmText: 'Revoke',
      variant: 'danger',
    }))) return;
    const reason = window.prompt("Reason for revoking (optional, shown to the student):") ?? undefined;
    setRevoking(cert.id);
    try {
      await adminApi.certificates.revoke(cert.id, reason || undefined);
      toast.success("Certificate revoked");
      setSelected((prev) => prev.filter((id) => id !== cert.id));
      queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
    } catch {
      toast.error("Failed to revoke certificate");
    } finally {
      setRevoking(null);
    }
  };

  const handleBulkRevoke = async () => {
    if (revokableIds.length === 0) return;
    if (!(await confirmDialog({
      title: `Revoke ${revokableIds.length} certificate(s)?`,
      description: "The affected students will be notified. This cannot be undone.",
      confirmText: 'Revoke All',
      variant: 'danger',
    }))) return;
    const reason = window.prompt("Reason for revoking (optional, shown to the students):") ?? undefined;
    setBulkRevoking(true);
    try {
      const res = await adminApi.certificates.bulkRevoke(revokableIds, reason || undefined);
      const d = res.data as { revoked?: number };
      toast.success(`Revoked ${d.revoked ?? revokableIds.length} certificate(s)`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
    } catch {
      toast.error("Bulk revoke failed");
    } finally {
      setBulkRevoking(false);
    }
  };

  const handleVerify = async () => {
    if (certs.length === 0) return;
    setVerifying(true);
    try {
      const res = await adminApi.certificates.verify(certs.map((c) => c.id));
      const d = res.data as { results?: Array<{ id: string; status: string }> };
      const brokenFound = (d.results ?? []).filter((r) => r.status === "broken").length;
      toast.success(brokenFound > 0 ? `Verified — found ${brokenFound} broken certificate(s)` : "Verified — all certificates on this page are healthy");
      queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
    } catch {
      toast.error("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleRegenerate = async (cert: Cert) => {
    setRegenerating(cert.id);
    try {
      await adminApi.certificates.regenerate(cert.id);
      toast.success("Certificate regenerated");
      queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
    } catch {
      toast.error("Failed to regenerate certificate");
    } finally {
      setRegenerating(null);
    }
  };

  const handleRegenerateAll = async () => {
    const broken = certs.filter((c) => c.status === "pending");
    if (broken.length === 0) { toast.success("No broken certificates found"); return; }
    if (!(await confirmDialog({
      title: 'Regenerate certificates?',
      description: `Regenerate ${broken.length} broken certificate(s)?`,
      confirmText: 'Regenerate',
    }))) return;
    setBatchLoading(true);
    let ok = 0;
    for (const cert of broken) {
      try { await adminApi.certificates.regenerate(cert.id); ok++; } catch { /* skip */ }
    }
    setBatchLoading(false);
    toast.success(`Regenerated ${ok} of ${broken.length} certificates`);
    queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
  };

  const handleBatchGenerate = async () => {
    if (!(await confirmDialog({
      title: 'Generate all certificates?',
      description: "Generate certificates for ALL eligible students who don't have one yet. This may take a moment.",
      confirmText: 'Generate',
    }))) return;
    setBatchLoading(true);
    try {
      const res = await adminApi.certificates.generateAllEligible();
      const d = res.data as { generated?: number; skipped?: number; warning?: string | null };
      toast.success(`Generated ${d.generated ?? 0} new certificates, skipped ${d.skipped ?? 0}`);
      if (d.warning) {
        toast.error(d.warning);
      }
      queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
    } catch {
      toast.error("Batch generation failed");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied!")).catch(() => {});
  };

  const handleDownload = async (cert: Cert) => {
    try {
      await downloadCertificate(cert.id, cert.short_id);
    } catch {
      toast.error("Failed to download certificate");
    }
  };

  // ─── Template actions ───────────────────────────────────────────────────────

  const handleTemplateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".svg")) { toast.error("Only SVG files are supported"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setTemplateContent(String(ev.target?.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveTemplate = async () => {
    if (!templateContent.trim()) { toast.error("Template is empty"); return; }
    setSavingTemplate(true);
    try {
      await adminApi.certificates.saveTemplate(templateContent);
      toast.success("Template saved — new certificates will use this design");
      queryClient.invalidateQueries({ queryKey: ["adminCertTemplate"] });
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!(await confirmDialog({
      title: 'Remove custom template?',
      description: 'Certificates will fall back to the default design.',
      confirmText: 'Remove',
      variant: 'danger',
    }))) return;
    setDeletingTemplate(true);
    try {
      await adminApi.certificates.deleteTemplate();
      setTemplateContent("");
      toast.success("Custom template removed");
      queryClient.invalidateQueries({ queryKey: ["adminCertTemplate"] });
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setDeletingTemplate(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="h-7 w-7 text-yellow-600" />
            Certificate Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">View, regenerate, revoke, and manage all student certificates</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setTemplateTab(false); queryClient.invalidateQueries({ queryKey: ["adminCertificates"] }); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying || certs.length === 0}>
            {verifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
            Verify
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTemplateTab((v) => !v)}>
            <FileText className="h-4 w-4 mr-1" />
            {templateTab ? "View Certificates" : "Manage Template"}
          </Button>
          <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white" onClick={handleBatchGenerate} disabled={batchLoading}>
            {batchLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            Generate All Eligible
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Total Issued</p>
          <p className="text-2xl font-bold text-yellow-600">{total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Active (this page)</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Broken/Pending (this page)</p>
          <p className="text-2xl font-bold text-red-600">{pendingCount + brokenCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Page</p>
          <p className="text-2xl font-bold text-gray-700">{page}/{totalPages}</p>
        </Card>
      </div>

      {/* ─── Template Management Tab ─── */}
      {templateTab ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-blue-600" />
              Certificate Template
            </CardTitle>
            <CardDescription>
              Upload a custom SVG template. Use <code className="bg-gray-100 px-1 rounded text-xs">{"{{studentName}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">{"{{courseTitle}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">{"{{issuedAt}}"}</code>,{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">{"{{certificateId}}"}</code> as placeholders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {templateLoading ? (
              <div className="flex items-center gap-2 text-gray-500 py-6 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading template...
              </div>
            ) : (
              <>
                {templateData?.template && !templateContent && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-green-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Custom template is active
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setTemplateContent(templateData.template ?? "")}>Edit</Button>
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200" onClick={handleDeleteTemplate} disabled={deletingTemplate}>
                        {deletingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}

                {!templateData?.template && !templateContent && (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm">
                    No custom template — using the built-in default design.
                  </div>
                )}

                {/* Upload area */}
                <div className="flex gap-3 items-center">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Upload SVG Template
                  </Button>
                  {templateContent && (
                    <Button variant="ghost" size="sm" onClick={() => setTemplateContent("")}>
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                  <input ref={fileInputRef} type="file" accept=".svg" className="hidden" onChange={handleTemplateFileUpload} />
                  <span className="text-xs text-gray-400">or paste SVG code below</span>
                </div>

                <textarea
                  className="w-full h-64 font-mono text-xs border rounded-lg p-3 bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder='<?xml version="1.0"?><svg ...>Your template with {{studentName}}, {{courseTitle}}, {{issuedAt}}, {{certificateId}}</svg>'
                  value={templateContent || (templateData?.template ?? "")}
                  onChange={(e) => setTemplateContent(e.target.value)}
                />

                {/* Preview */}
                {(templateContent || templateData?.template) && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-medium">Preview (with sample data):</p>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div
                        className="w-full"
                        dangerouslySetInnerHTML={{
                          __html: (templateContent || (templateData?.template ?? ""))
                            .replace(/\{\{studentName\}\}/g, "John Smith")
                            .replace(/\{\{courseTitle\}\}/g, "Introduction to Scratch")
                            .replace(/\{\{issuedAt\}\}/g, new Date().toISOString().split("T")[0])
                            .replace(/\{\{certificateId\}\}/g, "YM-SAMPLE1"),
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {templateData?.template && (
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleDeleteTemplate} disabled={deletingTemplate}>
                      {deletingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                      Remove Template
                    </Button>
                  )}
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveTemplate} disabled={savingTemplate || !templateContent.trim()}>
                    {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Save Template
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ─── Certificates Table ─── */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">All Certificates</CardTitle>
              <div className="flex gap-2 flex-wrap items-center">
                {/* Status filter */}
                <div className="flex rounded-lg border overflow-hidden text-xs">
                  {(["", "active", "broken", "pending", "revoked"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setStatusFilter(s); setPage(1); }}
                      className={`px-3 py-1.5 ${statusFilter === s ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      {s === "" ? "All" : s === "active" ? "Active" : s === "broken" ? "Broken" : s === "revoked" ? "Revoked" : "Pending"}
                    </button>
                  ))}
                </div>
                {/* School / Grade / Section filters */}
                <select
                  className="h-8 text-sm border border-gray-300 rounded-md px-2 bg-white"
                  value={schoolFilter}
                  onChange={(e) => {
                    setSchoolFilter(e.target.value);
                    setGradeFilter("");
                    setSectionFilter("");
                    setPage(1);
                  }}
                >
                  <option value="">All Schools</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  className="h-8 text-sm border border-gray-300 rounded-md px-2 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  value={gradeFilter}
                  onChange={(e) => {
                    setGradeFilter(e.target.value);
                    setSectionFilter("");
                    setPage(1);
                  }}
                  disabled={!schoolFilter || gradeOptions.length === 0}
                >
                  <option value="">All Grades</option>
                  {gradeOptions.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
                <select
                  className="h-8 text-sm border border-gray-300 rounded-md px-2 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  value={sectionFilter}
                  onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
                  disabled={!gradeFilter || sectionOptions.length === 0}
                >
                  <option value="">All Sections</option>
                  {sectionOptions.map((sec) => (
                    <option key={sec.id} value={sec.name}>{sec.name}</option>
                  ))}
                </select>
                {/* Search */}
                <div className="flex gap-1">
                  <Input
                    placeholder="Search student, course..."
                    className="h-8 text-sm w-52"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button variant="outline" size="sm" className="h-8 px-2" onClick={handleSearch}>
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {pendingCount > 0 && (
                  <Button variant="outline" size="sm" className="h-8 text-orange-600 border-orange-200" onClick={handleRegenerateAll} disabled={batchLoading}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Fix {pendingCount} broken
                  </Button>
                )}
              </div>
            </div>
            {revokableIds.length > 0 && (
              <div className="mt-3 flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-sm text-red-800">{revokableIds.length} selected</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected([])}>
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleBulkRevoke}
                    disabled={bulkRevoking}
                  >
                    {bulkRevoking ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Ban className="h-3.5 w-3.5 mr-1" />}
                    Revoke Selected ({revokableIds.length})
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : certs.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Award className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No certificates found</p>
                {(search || statusFilter || schoolFilter || gradeFilter || sectionFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSearch("");
                      setSearchInput("");
                      setStatusFilter("");
                      setSchoolFilter("");
                      setGradeFilter("");
                      setSectionFilter("");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-gray-500 uppercase tracking-wider">
                        <th className="text-left py-3 px-2 w-8">
                          <input
                            type="checkbox"
                            checked={certs.filter((c) => c.status !== "revoked").length > 0 && selected.length === certs.filter((c) => c.status !== "revoked").length}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th className="text-left py-3 px-2">Student</th>
                        <th className="text-left py-3 px-2">School / Grade</th>
                        <th className="text-left py-3 px-2">Course</th>
                        <th className="text-left py-3 px-2">Cert ID</th>
                        <th className="text-left py-3 px-2">Issued</th>
                        <th className="text-left py-3 px-2">Status</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {certs.map((cert) => (
                        <tr key={cert.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-2">
                            <input
                              type="checkbox"
                              checked={selected.includes(cert.id)}
                              disabled={cert.status === "revoked"}
                              onChange={() => toggleSelected(cert.id)}
                            />
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-medium text-gray-900 truncate max-w-[160px]">{cert.student_name}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[160px]">{cert.student_email}</div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="truncate max-w-[160px] text-gray-700">{cert.school_name ?? "—"}</div>
                            <div className="text-xs text-gray-400">
                              {[cert.grade, cert.section].filter(Boolean).join(" - ") || "—"}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="truncate max-w-[180px] text-gray-700">{cert.course_title}</div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
                              <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">{cert.short_id}</code>
                              <button onClick={() => handleCopy(cert.short_id)} className="text-gray-400 hover:text-gray-600">
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(cert.issued_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2">
                            {cert.status === "active" ? (
                              <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                                <CheckCircle className="h-3 w-3" /> Active
                              </Badge>
                            ) : cert.status === "revoked" ? (
                              <Badge className="bg-gray-200 text-gray-700 text-xs gap-1" title={cert.revoked_reason ?? undefined}>
                                <Ban className="h-3 w-3" /> Revoked
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-xs gap-1">
                                <AlertCircle className="h-3 w-3" /> {cert.status === "broken" ? "Broken" : "Pending"}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-1 justify-end">
                              {cert.status !== "revoked" && cert.status !== "pending" && (
                                <>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Preview" onClick={() => setPreviewCert(cert)}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download" onClick={() => handleDownload(cert)}>
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                  <a href={`/robocoders/lms/verify/${cert.short_id}`} target="_blank" rel="noopener noreferrer" title="Public verify link">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                </>
                              )}
                              {cert.status !== "revoked" && (
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-orange-600"
                                  title="Regenerate"
                                  onClick={() => handleRegenerate(cert)}
                                  disabled={regenerating === cert.id}
                                >
                                  {regenerating === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                              {cert.status !== "revoked" && (
                                <Button
                                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600"
                                  title="Revoke"
                                  onClick={() => handleRevoke(cert)}
                                  disabled={revoking === cert.id}
                                >
                                  {revoking === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">{total} total certificates</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      {previewCert && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPreviewCert(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="font-semibold text-gray-900">{previewCert.certificate_name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{previewCert.student_name} · {previewCert.course_title}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/robocoders/lms/verify/${previewCert.short_id}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" /> Verify Link
                  </Button>
                </a>
                <Button
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  onClick={() => handleDownload(previewCert)}
                >
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewCert(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <div className="border rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewCert.certificate_url} alt={previewCert.certificate_name} className="w-full h-auto" />
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>ID: <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{previewCert.short_id}</code></span>
                <span>Issued: {new Date(previewCert.issued_at).toLocaleDateString()}</span>
                {previewCert.issued_by && <span>By: {previewCert.issued_by}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
