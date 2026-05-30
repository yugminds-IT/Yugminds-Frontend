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
import { adminApi } from "@/lib/api/admin.api";

interface PasswordResetRequest {
  id: string;
  user_id: number;
  email: string;
  user_role: string;
  status: "pending" | "approved" | "rejected" | "completed";
  requested_at: string;
  approved_at?: string;
  approved_by_name?: string;
  school_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name?: string; email: string; role: string };
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

export default function PasswordResetRequestsPage() {
  const { toasts, show: toast, remove: removeToast } = useToast();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected" | "completed">("all");
  const [dialog, setDialog] = useState<{ open: boolean; type: "view" | "approve" | "reject" | "delete"; request: PasswordResetRequest | null }>({ open: false, type: "view", request: null });
  const [notes, setNotes] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.passwordResetRequests.list({ limit: 200 });
      let list: PasswordResetRequest[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && Array.isArray((data as { requests?: PasswordResetRequest[] }).requests)) {
        list = (data as { requests: PasswordResetRequest[] }).requests;
      }
      setRequests(list);
    } catch (err) {
      toast(`Failed to load: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const openDialog = (request: PasswordResetRequest, type: typeof dialog.type) => {
    setDialog({ open: true, type, request });
    setNotes("");
    setTempPassword("");
    setShowTempPassword(false);
  };

  const closeDialog = () => {
    setDialog((d) => ({ ...d, open: false }));
  };

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
        await adminApi.passwordResetRequests.delete(request.id);
        toast("Request deleted");
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        closeDialog();
        return;
      }

      const newStatus = type === "approve" ? "approved" : "rejected";
      await adminApi.passwordResetRequests.update({
        id: request.id,
        status: newStatus,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(type === "approve" ? { temp_password: tempPassword.trim() } : {}),
      });

      if (type === "approve") {
        toast("Approved — temporary password set and user notified");
        setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: "approved" } : r));
      } else {
        toast("Request rejected — user notified");
        setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: "rejected" } : r));
      }
      window.dispatchEvent(new Event("password-reset-resolved"));
      closeDialog();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ?? (err instanceof Error ? err.message : "Unknown error");
      toast(`Failed: ${msg}`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const allRequests = Array.isArray(requests) ? requests : [];
  const pendingRequests = allRequests.filter((r) => r.status === "pending");
  const historyRequests = allRequests.filter((r) => r.status !== "pending");

  const tabSource = activeTab === "pending" ? pendingRequests : historyRequests;

  const filtered = tabSource.filter((r) => {
    if (activeTab === "history" && statusFilter !== "all" && r.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase();
    return !q || r.email.toLowerCase().includes(q) || (r.profiles?.full_name ?? "").toLowerCase().includes(q) || r.user_role.toLowerCase().includes(q) || (r.schools?.name ?? "").toLowerCase().includes(q) || (r.approved_by_name ?? "").toLowerCase().includes(q);
  });

  const pendingCount = pendingRequests.length;
  const historyCount = historyRequests.length;

  return (
    <div className="p-8 bg-white min-h-screen">
      <Toast toasts={toasts} remove={removeToast} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <KeyRound className="h-7 w-7 text-blue-600" />
            Password Reset Requests
            {pendingCount > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-sm">{pendingCount} pending</Badge>}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Review and approve password reset requests from users</p>
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
          Password Reset History {historyCount > 0 && <span className="ml-1.5 text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">{historyCount}</span>}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search by email, name, role, school, approver…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
                ? `${filtered.length} pending request${filtered.length !== 1 ? "s" : ""} awaiting review`
                : `${filtered.length} resolved request${filtered.length !== 1 ? "s" : ""}`}
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
                <TableHead>School</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                {activeTab === "history" && <TableHead>Resolved</TableHead>}
                {activeTab === "history" && <TableHead>Approved By</TableHead>}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <TableRow key={req.id} className={req.status === "pending" ? "bg-yellow-50/30" : ""}>
                  <TableCell><p className="text-sm font-medium text-gray-900">{req.profiles?.full_name || "—"}</p></TableCell>
                  <TableCell><p className="text-sm text-gray-700">{req.email}</p></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{req.user_role.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell><p className="text-sm text-gray-600">{req.schools?.name || "—"}</p></TableCell>
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
              {/* User details card */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{dialog.request.profiles?.full_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium">{dialog.request.email}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Role</span><Badge variant="outline" className="capitalize text-xs">{dialog.request.user_role.replace(/_/g, " ")}</Badge></div>
                {dialog.request.schools && <div className="flex justify-between"><span className="text-gray-500">School</span><span className="font-medium">{dialog.request.schools.name}</span></div>}
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

              {/* Temporary password field (approve only) */}
              {dialog.type === "approve" && (
                <div className="space-y-2">
                  <Label htmlFor="temp-password" className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" />
                    Temporary Password <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="temp-password"
                      type={showTempPassword ? "text" : "password"}
                      placeholder="Enter a temporary password for the user"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="pr-10"
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
                    Communicate this password directly to the user (in person or via your internal mail system). The user will be required to change it immediately after logging in.
                  </p>
                </div>
              )}

              {/* Notes field */}
              {(dialog.type === "approve" || dialog.type === "reject") && (
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Textarea id="notes" placeholder={dialog.type === "reject" ? "Reason for rejection…" : "Any notes for this approval…"} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className="resize-none text-sm" />
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
                className={dialog.type === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
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
