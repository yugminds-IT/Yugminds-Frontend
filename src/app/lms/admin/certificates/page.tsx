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
} from "lucide-react";

type CertStatus = "active" | "pending";

interface Cert {
  id: string;
  short_id: string;
  student_id: number;
  student_name: string;
  student_email: string;
  course_id: string;
  course_title: string;
  certificate_name: string;
  certificate_url: string;
  status: CertStatus;
  issued_at: string;
  issued_by: string | null;
}

interface CertListResponse {
  total: number;
  page: number;
  limit: number;
  certificates: Cert[];
}

function certDownloadAttr(url: string, baseName: string): { href: string; download: string } {
  const mime = url.match(/^data:([^;]+)/)?.[1] ?? "";
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg"
    : mime.includes("png") ? "png"
    : mime.includes("svg") ? "svg"
    : "jpg";
  return { href: url, download: `${baseName}.${ext}` };
}

export default function AdminCertificatesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // List state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const LIMIT = 20;

  // Action states
  const [revoking, setRevoking] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [previewCert, setPreviewCert] = useState<Cert | null>(null);

  // Template state
  const [templateTab, setTemplateTab] = useState(false);
  const [templateContent, setTemplateContent] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<CertListResponse>({
    queryKey: ["adminCertificates", page, search, statusFilter],
    queryFn: async () => {
      const res = await adminApi.certificates.list({ page, limit: LIMIT, search: search || undefined, status: statusFilter || undefined });
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

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleRevoke = async (cert: Cert) => {
    if (!(await confirmDialog({
      title: 'Revoke this certificate?',
      description: `Revoke the certificate for ${cert.student_name} (${cert.course_title}). This cannot be undone.`,
      confirmText: 'Revoke',
      variant: 'danger',
    }))) return;
    setRevoking(cert.id);
    try {
      await adminApi.certificates.revoke(cert.id);
      toast.success("Certificate revoked");
      queryClient.invalidateQueries({ queryKey: ["adminCertificates"] });
    } catch {
      toast.error("Failed to revoke certificate");
    } finally {
      setRevoking(null);
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
      const res = await adminApi.certificates.batchGenerate({});
      const d = res.data as { generated?: number; skipped?: number };
      toast.success(`Generated ${d.generated ?? 0} new certificates, skipped ${d.skipped ?? 0} already existing`);
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
          <p className="text-2xl font-bold text-red-600">{pendingCount}</p>
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
                  {(["", "active", "pending"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setStatusFilter(s); setPage(1); }}
                      className={`px-3 py-1.5 ${statusFilter === s ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                    >
                      {s === "" ? "All" : s === "active" ? "Active" : "Broken"}
                    </button>
                  ))}
                </div>
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
                {(search || statusFilter) && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(""); setSearchInput(""); setStatusFilter(""); setPage(1); }}>
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
                        <th className="text-left py-3 px-2">Student</th>
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
                            <div className="font-medium text-gray-900 truncate max-w-[160px]">{cert.student_name}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[160px]">{cert.student_email}</div>
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
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-xs gap-1">
                                <AlertCircle className="h-3 w-3" /> Broken
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-1 justify-end">
                              {cert.status === "active" && (
                                <>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Preview" onClick={() => setPreviewCert(cert)}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <a {...certDownloadAttr(cert.certificate_url, cert.short_id)} title="Download">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                  <a href={`/robocoders/lms/verify/${cert.short_id}`} target="_blank" rel="noopener noreferrer" title="Public verify link">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                </>
                              )}
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0 text-orange-600"
                                title="Regenerate"
                                onClick={() => handleRegenerate(cert)}
                                disabled={regenerating === cert.id}
                              >
                                {regenerating === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600"
                                title="Revoke"
                                onClick={() => handleRevoke(cert)}
                                disabled={revoking === cert.id}
                              >
                                {revoking === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
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
                <a {...certDownloadAttr(previewCert.certificate_url, previewCert.short_id)}>
                  <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </a>
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
