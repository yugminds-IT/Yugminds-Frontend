"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, CheckCircle, XCircle, Clock, Search, Eye, Trash2, AlertCircle, KeyRound, X, Loader2, EyeOff } from "lucide-react";
import { schoolAdminApi } from "@/lib/api/school-admin.api";

interface PasswordResetRequest {
  id: string;
  user_id: string;
  email: string;
  user_role: string;
  status: "pending" | "approved" | "rejected" | "completed";
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  school_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: { id: string; full_name?: string; email: string; role: string; school_id?: string };
  schools?: { id: string; name: string };
}

interface ToastMsg { id: number; text: string; kind: "success" | "error" }
let _tid = 0;

function Toast({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto ${t.kind === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
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
  return new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

const STATUS_CFG = {
  pending:   { label: "Pending",   cls: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3 mr-1" /> },
  approved:  { label: "Approved",  cls: "bg-blue-100 text-blue-700",     icon: <CheckCircle className="h-3 w-3 mr-1" /> },
  rejected:  { label: "Rejected",  cls: "bg-red-100 text-red-700",       icon: <XCircle className="h-3 w-3 mr-1" /> },
  completed: { label: "Completed", cls: "bg-green-100 text-green-700",   icon: <CheckCircle className="h-3 w-3 mr-1" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? { label: status, cls: "bg-gray-100 text-gray-700", icon: null };
  return <Badge className={`${cfg.cls} flex items-center w-fit`}>{cfg.icon}{cfg.label}</Badge>;
}

const PAGE_SIZE = 20;

export default function PasswordResetRequestsPage() {
  const { toasts, show: toast, remove: removeToast } = useToast();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  // searchInput is what the box shows; searchQuery is the debounced value
  // actually sent to the backend (avoids a request per keystroke).
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected" | "completed">("all");
  const [pendingCount, setPendingCount] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; type: "view" | "approve" | "reject" | "delete"; request: PasswordResetRequest | null }>({ open: false, type: "view", request: null });
  const [notes, setNotes] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever the tab, search, or status filter changes.
  useEffect(() => {
    setPageOffset(0);
  }, [activeTab, searchQuery, statusFilter]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 'resolved' is a server-side sentinel meaning "anything but pending" —
      // used by the History tab when no specific status is picked.
      const status = activeTab === "pending" ? "pending" : statusFilter === "all" ? "resolved" : statusFilter;
      const { data } = await schoolAdminApi.passwordResetRequests.list({
        status,
        limit: PAGE_SIZE,
        offset: pageOffset,
        search: searchQuery || undefined,
      });
      let list: PasswordResetRequest[] = [];
      let listTotal = 0;
      if (Array.isArray(data)) {
        list = data;
        listTotal = data.length;
      } else if (data && Array.isArray((data as { requests?: PasswordResetRequest[] }).requests)) {
        const payload = data as { requests: PasswordResetRequest[]; total?: number };
        list = payload.requests;
        listTotal = payload.total ?? list.length;
      }
      setRequests(list);
      setTotal(listTotal);
    } catch (err) {
      toast(`Failed to load: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, activeTab, statusFilter, pageOffset, searchQuery]);

  const loadPendingCount = useCallback(async () => {
    try {
      const { data } = await schoolAdminApi.passwordResetRequests.pendingCount();
      setPendingCount(Number((data as { count?: number })?.count ?? 0));
    } catch {
      // non-critical — badge just won't update
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);
  useEffect(() => { loadPendingCount(); }, [loadPendingCount]);

  const openDialog = (request: PasswordResetRequest, type: typeof dialog.type) => {
    setDialog({ open: true, type, request });
    setNotes("");
    setTempPassword("");
    setShowTempPassword(false);
  };

  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

  const confirmAction = async () => {
    const { type, request } = dialog;
    if (!request) return;

    if (type === "approve" && !tempPassword.trim()) {
      toast("Please enter a temporary password before approving", "error");
      return;
    }

    setActionLoading(true);
    try {
      if (type === "delete") {
        await schoolAdminApi.passwordResetRequests.delete(request.id);
        toast("Request deleted");
        closeDialog();
        loadRequests();
        return;
      }

      const newStatus = type === "approve" ? "approved" : "rejected";
      await schoolAdminApi.passwordResetRequests.update({
        id: request.id,
        status: newStatus,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(type === "approve" ? { temp_password: tempPassword.trim() } : {}),
      });

      toast(
        type === "approve"
          ? "Approved — temporary password set and user notified"
          : "Request rejected — user notified",
      );
      // The request has moved out of "pending" — re-fetch rather than patch
      // it in place, since the Pending tab is now scoped server-side and the
      // resolved request should disappear from it immediately.
      closeDialog();
      loadRequests();
      loadPendingCount();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ?? (err instanceof Error ? err.message : "Unknown error");
      toast(`Failed: ${msg}`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Search/status/tab filtering now happens server-side (see loadRequests),
  // so `requests` already reflects the current tab + filters.
  const filtered = Array.isArray(requests) ? requests : [];

  return (
    <div className="p-8 bg-white">
      <Toast toasts={toasts} remove={removeToast} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <KeyRound className="h-7 w-7 text-blue-600" />
            Password Reset Requests
            {pendingCount > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-sm">{pendingCount} pending</Badge>}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Manage password reset requests from your students and teachers</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "pending" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Pending Requests {pendingCount > 0 && <span className="ml-1.5 text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5">{pendingCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Password Reset History {activeTab === "history" && total > 0 && <span className="ml-1.5 text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">{total}</span>}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search by email, name, role, approver…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-10" />
        </div>
        {activeTab === "history" && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{activeTab === "pending" ? "Pending Requests" : "Password Reset History"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeTab === "pending"
                ? `${total} pending request${total !== 1 ? "s" : ""} awaiting review`
                : `${total} resolved request${total !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <KeyRound className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No password reset requests found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                {activeTab === "history" && <TableHead>Resolved</TableHead>}
                {activeTab === "history" && <TableHead>Resolved By</TableHead>}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <TableRow key={req.id} className={req.status === "pending" ? "bg-yellow-50/30" : ""}>
                  <TableCell><p className="text-sm font-medium text-gray-900">{req.profiles?.full_name || "—"}</p></TableCell>
                  <TableCell><p className="text-sm text-gray-700">{req.email}</p></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{req.user_role.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell><StatusBadge status={req.status} /></TableCell>
                  <TableCell>
                    <p className="text-xs text-gray-600">{formatDate(req.requested_at)}</p>
                    <p className="text-xs text-gray-400">{timeAgo(req.requested_at)}</p>
                  </TableCell>
                  {activeTab === "history" && (
                    <TableCell>
                      {req.approved_at ? (
                        <>
                          <p className="text-xs text-gray-600">{formatDate(req.approved_at)}</p>
                          <p className="text-xs text-gray-400">{timeAgo(req.approved_at)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">—</p>
                      )}
                    </TableCell>
                  )}
                  {activeTab === "history" && (
                    <TableCell>
                      <p className="text-sm text-gray-700">{req.approved_by_name || "—"}</p>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {req.status === "pending" && (
                        <>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-green-600 hover:bg-green-50" onClick={() => openDialog(req, "approve")}>
                            <CheckCircle className="h-3 w-3 mr-1" />Approve
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-red-600 hover:bg-red-50" onClick={() => openDialog(req, "reject")}>
                            <XCircle className="h-3 w-3 mr-1" />Reject
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => openDialog(req, "view")}>
                            <Eye className="h-3 w-3 mr-1" />View
                          </Button>
                        </>
                      )}
                      {activeTab === "history" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => openDialog(req, "view")}>
                            <Eye className="h-3 w-3 mr-1" />View
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-1.5 text-red-500 hover:bg-red-50" onClick={() => openDialog(req, "delete")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-gray-600">
            <span>
              {Math.min(pageOffset + 1, total)}–{Math.min(pageOffset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={pageOffset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageOffset((o) => o + PAGE_SIZE)}
                disabled={pageOffset + PAGE_SIZE >= total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialog.type === "view" && <><Eye className="h-4 w-4" />Request Details</>}
              {dialog.type === "approve" && <><CheckCircle className="h-4 w-4 text-green-600" />Approve Request</>}
              {dialog.type === "reject" && <><XCircle className="h-4 w-4 text-red-600" />Reject Request</>}
              {dialog.type === "delete" && <><Trash2 className="h-4 w-4 text-red-600" />Delete Request</>}
            </DialogTitle>
            <DialogDescription>
              {dialog.type === "approve" && "Set a temporary password for this user. They will be notified and must change it on first login."}
              {dialog.type === "reject" && "The user will be notified that their request was rejected."}
              {dialog.type === "delete" && "This will permanently remove the request record."}
              {dialog.type === "view" && "Full details of this password reset request."}
            </DialogDescription>
          </DialogHeader>

          {dialog.request && (
            <div className="space-y-3 py-1">
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{dialog.request.profiles?.full_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium">{dialog.request.email}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Role</span><Badge variant="outline" className="capitalize text-xs">{dialog.request.user_role.replace(/_/g, " ")}</Badge></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><StatusBadge status={dialog.request.status} /></div>
                <div className="flex justify-between"><span className="text-gray-500">Requested</span><span>{formatDate(dialog.request.requested_at)}</span></div>
                {dialog.request.approved_at && <div className="flex justify-between"><span className="text-gray-500">Resolved</span><span>{formatDate(dialog.request.approved_at)}</span></div>}
                {dialog.request.approved_by_name && <div className="flex justify-between"><span className="text-gray-500">Resolved by</span><span className="font-medium">{dialog.request.approved_by_name}</span></div>}
                {dialog.request.notes && (
                  <div><span className="text-gray-500 block mb-1">Notes</span>
                    <p className="text-gray-700 text-xs bg-white rounded border p-2 whitespace-pre-wrap">{dialog.request.notes}</p>
                  </div>
                )}
              </div>

              {dialog.type === "approve" && (
                <div className="space-y-2">
                  <Label htmlFor="sa-temp-password" className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" />
                    Temporary Password <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <input
                      id="sa-temp-password"
                      type={showTempPassword ? "text" : "password"}
                      placeholder="Enter a temporary password for the user"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowTempPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Communicate this password directly to the user. They will be required to change it immediately after logging in.
                  </p>
                </div>
              )}

              {(dialog.type === "approve" || dialog.type === "reject") && (
                <div className="space-y-1.5">
                  <Label htmlFor="sa-notes">Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Textarea id="sa-notes" placeholder={dialog.type === "reject" ? "Reason for rejection…" : "Any notes for this approval…"} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className="resize-none text-sm" />
                  <p className="text-xs text-gray-400 text-right">{notes.length}/500</p>
                </div>
              )}

              {dialog.type === "delete" && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>This action cannot be undone. The request record will be permanently deleted.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>Cancel</Button>
            {dialog.type !== "view" && (
              <Button
                onClick={confirmAction}
                disabled={actionLoading || (dialog.type === "approve" && !tempPassword.trim())}
                className={
                  dialog.type === "approve" ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {actionLoading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
                  : dialog.type === "approve" ? "Approve & Set Temp Password"
                  : dialog.type === "reject" ? "Reject Request"
                  : "Delete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
