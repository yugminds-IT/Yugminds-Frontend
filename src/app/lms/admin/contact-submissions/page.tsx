"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  RefreshCw,
  Search,
  Eye,
  Trash2,
  AlertCircle,
  MessageSquare,
  X,
  CheckCircle,
  Archive,
  Reply,
  Phone,
  Mail,
  Tag,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Undo2,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";

interface ContactSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  area_code: string;
  phone_number: string | null;
  purpose: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  admin_notes: string | null;
  source: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusCounts {
  new: number;
  read: number;
  replied: number;
  archived: number;
  deleted: number;
}

interface ToastMsg { id: number; text: string; kind: "success" | "error" }
let _tid = 0;

function Toast({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto ${t.kind === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          {t.kind === "success" ? <CheckCircle className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          <span>{t.text}</span>
          <button onClick={() => remove(t.id)} className="ml-2 opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const show = useCallback((text: string, kind: "success" | "error" = "success") => {
    const id = ++_tid;
    setToasts((p) => [...p, { id, text, kind }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  }, []);
  const remove = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, show, remove };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PURPOSE_LABELS: Record<string, string> = {
  general: "General Inquiry",
  school: "School Partnership",
  parent: "Parent Inquiry",
  student: "Student Enrollment",
  support: "Technical Support",
  other: "Other",
};

const STATUS_CFG = {
  new:      { label: "New",      cls: "bg-blue-100 text-blue-700 border-blue-200",     icon: <MessageSquare className="h-3 w-3 mr-1" /> },
  read:     { label: "Read",     cls: "bg-gray-100 text-gray-700 border-gray-200",     icon: <Eye className="h-3 w-3 mr-1" /> },
  replied:  { label: "Replied",  cls: "bg-green-100 text-green-700 border-green-200",  icon: <Reply className="h-3 w-3 mr-1" /> },
  archived: { label: "Archived", cls: "bg-amber-100 text-amber-700 border-amber-200",  icon: <Archive className="h-3 w-3 mr-1" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200", icon: null };
  return (
    <Badge variant="outline" className={`${cfg.cls} flex items-center w-fit gap-0.5`}>
      {cfg.icon}{cfg.label}
    </Badge>
  );
}

const STATUS_TABS = [
  { key: "all",      label: "All",      countKey: null },
  { key: "new",      label: "New",      countKey: "new" },
  { key: "read",     label: "Read",     countKey: "read" },
  { key: "replied",  label: "Replied",  countKey: "replied" },
  { key: "archived", label: "Archived", countKey: "archived" },
  { key: "deleted",  label: "Deleted",  countKey: "deleted" },
] as const;

export default function ContactSubmissionsPage() {
  const { toasts, show: toast, remove: removeToast } = useToast();

  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ new: 0, read: 0, replied: 0, archived: 0, deleted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactSubmission | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<ContactSubmission | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [adminNotes, setAdminNotes] = useState("");
  const [statusEdit, setStatusEdit] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const p = resetPage ? 1 : page;
      const res = await adminApi.contactSubmissions.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        page: p,
        limit: LIMIT,
        search: search.trim() || undefined,
      });
      const data = res.data as {
        submissions: ContactSubmission[];
        total: number;
        status_counts: StatusCounts;
      };
      setSubmissions(data.submissions);
      setTotal(data.total);
      setStatusCounts(data.status_counts);
      if (resetPage) setPage(1);
    } catch {
      toast("Failed to load submissions", "error");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, toast]);

  useEffect(() => { load(); }, [load]);

  const openView = async (sub: ContactSubmission) => {
    setSelected(sub);
    setAdminNotes(sub.admin_notes ?? "");
    setStatusEdit(sub.status);
    setViewOpen(true);
    // auto-mark as read if new
    if (sub.status === "new") {
      try {
        await adminApi.contactSubmissions.update(sub.id, { status: "read" });
        setSubmissions((prev) => prev.map((s) => s.id === sub.id ? { ...s, status: "read" } : s));
        setStatusCounts((prev) => ({ ...prev, new: Math.max(0, prev.new - 1), read: prev.read + 1 }));
        setSelected((prev) => prev ? { ...prev, status: "read" } : prev);
        setStatusEdit("read");
      } catch {
        // non-critical, ignore
      }
    }
  };

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.contactSubmissions.update(selected.id, {
        status: statusEdit,
        admin_notes: adminNotes,
      });
      toast("Saved successfully");
      setSubmissions((prev) => prev.map((s) =>
        s.id === selected.id ? { ...s, status: statusEdit as ContactSubmission["status"], admin_notes: adminNotes } : s
      ));
      setViewOpen(false);
      load();
    } catch {
      toast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.contactSubmissions.delete(deleteTarget.id);
      toast("Submission moved to Deleted — restore it any time before purging");
      setSubmissions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setTotal((t) => t - 1);
      setStatusCounts((prev) => ({
        ...prev,
        [deleteTarget.status]: Math.max(0, prev[deleteTarget.status as keyof StatusCounts] - 1),
        deleted: prev.deleted + 1,
      }));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch {
      toast("Failed to delete submission", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (sub: ContactSubmission) => {
    setRestoringId(sub.id);
    try {
      await adminApi.contactSubmissions.restore(sub.id);
      toast("Submission restored");
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
      setTotal((t) => t - 1);
      setStatusCounts((prev) => ({
        ...prev,
        [sub.status]: prev[sub.status as keyof StatusCounts] + 1,
        deleted: Math.max(0, prev.deleted - 1),
      }));
    } catch {
      toast("Failed to restore submission", "error");
    } finally {
      setRestoringId(null);
    }
  };

  const confirmPurge = async () => {
    if (!purgeTarget) return;
    setPurging(true);
    try {
      await adminApi.contactSubmissions.purge(purgeTarget.id);
      toast("Submission permanently deleted");
      setSubmissions((prev) => prev.filter((s) => s.id !== purgeTarget.id));
      setTotal((t) => t - 1);
      setStatusCounts((prev) => ({ ...prev, deleted: Math.max(0, prev.deleted - 1) }));
      setPurgeOpen(false);
      setPurgeTarget(null);
    } catch {
      toast("Failed to permanently delete submission", "error");
    } finally {
      setPurging(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6 p-6">
      <Toast toasts={toasts} remove={removeToast} />

      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contact Submissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Messages from the Robocoders contact form</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={loading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["new", "read", "replied", "archived"] as const).map((k) => (
          <button
            key={k}
            onClick={() => { setStatusFilter(k); setPage(1); }}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${statusFilter === k ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{STATUS_CFG[k].label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{statusCounts[k]}</p>
          </button>
        ))}
        <button
          onClick={() => { setStatusFilter("deleted"); setPage(1); }}
          className={`rounded-xl border px-4 py-3 text-left transition-all ${statusFilter === "deleted" ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Deleted</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{statusCounts.deleted}</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(true); }}
          />
        </div>
        <div className="flex items-center gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {tab.label}
              {tab.countKey && statusCounts[tab.countKey] > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${statusFilter === tab.key ? "bg-white/20" : "bg-slate-300 text-slate-700"}`}>
                  {statusCounts[tab.countKey]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading submissions…</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="font-medium">No submissions found</p>
            <p className="text-sm">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Sender</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Purpose</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Message</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Received</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((sub) => (
                  <tr
                    key={sub.id}
                    className={`transition-colors hover:bg-slate-50 ${sub.status === "new" ? "bg-blue-50/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-medium text-slate-900 ${sub.status === "new" ? "font-semibold" : ""}`}>
                          {sub.first_name} {sub.last_name}
                          {sub.status === "new" && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{sub.email}</p>
                        {sub.phone_number && (
                          <p className="text-xs text-slate-400">{sub.area_code} {sub.phone_number}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700">
                        <Tag className="h-3 w-3 mr-1 opacity-70" />
                        {PURPOSE_LABELS[sub.purpose] ?? sub.purpose}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-600 truncate">{sub.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-500 text-xs">{timeAgo(sub.created_at)}</p>
                      <p className="text-slate-400 text-xs">{new Date(sub.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {statusFilter === "deleted" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 gap-1.5 border-green-500 text-green-700 hover:bg-green-50"
                              disabled={restoringId === sub.id}
                              onClick={() => handleRestore(sub)}
                            >
                              {restoringId === sub.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="h-3.5 w-3.5" />
                              )}
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              onClick={() => { setPurgeTarget(sub); setPurgeOpen(true); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 gap-1.5"
                              onClick={() => openView(sub)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              onClick={() => { setDeleteTarget(sub); setDeleteOpen(true); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-slate-900">Page {page} of {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* View / Edit Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Contact Submission
            </DialogTitle>
            <DialogDescription>
              Received {selected ? formatDate(selected.created_at) : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5 py-1">
              {/* Sender info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sender</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="font-semibold text-slate-900">{selected.first_name} {selected.last_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Purpose</p>
                    <p className="font-medium text-slate-900">{PURPOSE_LABELS[selected.purpose] ?? selected.purpose}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <a href={`mailto:${selected.email}`} className="text-blue-600 hover:underline text-sm">{selected.email}</a>
                  </div>
                  {selected.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">{selected.area_code} {selected.phone_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Message</p>
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <Select value={statusEdit} onValueChange={setStatusEdit}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Admin notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Admin Notes</label>
                <Textarea
                  placeholder="Add internal notes about this submission…"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <p className="text-xs text-slate-400">Notes are private and only visible to admins.</p>
              </div>

              {/* Quick reply link */}
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>Reply via email to <strong>{selected.email}</strong></span>
                </div>
                <a
                  href={`mailto:${selected.email}?subject=Re: Your inquiry – Robocoders&body=Hi ${selected.first_name},%0A%0A`}
                  className="shrink-0 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  Open Mail
                </a>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewOpen(false)}>Cancel</Button>
            <Button onClick={saveChanges} disabled={saving} className="gap-2 bg-slate-900 hover:bg-slate-800">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog (soft-delete — restorable from the Deleted tab) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Submission
            </DialogTitle>
            <DialogDescription>
              Move this submission from{" "}
              <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> to Deleted?
              You can restore it from the Deleted tab any time before it's purged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purge Confirm Dialog (permanent, irreversible) */}
      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Forever
            </DialogTitle>
            <DialogDescription>
              Permanently delete the submission from{" "}
              <strong>{purgeTarget?.first_name} {purgeTarget?.last_name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPurgeOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmPurge}
              disabled={purging}
              className="gap-2"
            >
              {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
