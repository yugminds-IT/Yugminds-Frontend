"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Trash2, Upload, RefreshCw, Image as ImageIcon, AlertTriangle, CheckCircle, AlertCircle, X, Search, Pencil } from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";

interface LogoItem {
  id: string;
  school_id?: string | null;
  school_name: string;
  description?: string | null;
  image_url: string;
  upload_date?: string;
}

interface SchoolOption {
  id: string;
  name: string;
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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function LogoManagementPage() {
  const { toasts, show: toast, remove: removeToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState("manage");
  const [search, setSearch] = useState("");

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadSchoolId, setUploadSchoolId] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; hard: boolean; schoolName: string } | null>(null);

  // Edit dialog
  const [editDialog, setEditDialog] = useState<{ open: boolean; logo: LogoItem } | null>(null);
  const [editSchoolId, setEditSchoolId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const totalPages = useMemo(() => Math.ceil(total / limit), [total, limit]);
  const currentPage = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);

  const filteredLogos = useMemo(() => {
    if (!search.trim()) return logos;
    const q = search.trim().toLowerCase();
    return logos.filter((l) => l.school_name.toLowerCase().includes(q));
  }, [logos, search]);

  const fetchLogos = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.logos.list({ limit, offset });
      const root = (data ?? {}) as Record<string, unknown>;
      const payload =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : root;
      setLogos(asArray<LogoItem>(payload.logos ?? payload.data ?? payload.items ?? payload));
      setTotal(Number(payload.total ?? root.total ?? 0));
    } catch (e: unknown) {
      toast((e instanceof Error ? e.message : String(e)) || "Failed to load logos", "error");
    } finally {
      setLoading(false);
    }
  }, [limit, offset, toast]);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);

  useEffect(() => {
    adminApi.schools.list().then(({ data }) => {
      const root = (data ?? {}) as Record<string, unknown>;
      const payload =
        root.data && typeof root.data === "object" && !Array.isArray(root.data)
          ? (root.data as Record<string, unknown>)
          : root;
      const list = asArray<SchoolOption>(payload.schools ?? payload.data ?? payload.items ?? payload);
      setSchools(list);
    }).catch(() => {});
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  };

  const validateFileClient = async (f: File): Promise<{ ok: boolean; error?: string }> => {
    if (!f) return { ok: false, error: "No file selected" };
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(f.type)) return { ok: false, error: 'Only JPG, PNG, SVG allowed' };
    if (f.size > 2 * 1024 * 1024) return { ok: false, error: 'Max file size is 2MB' };
    // SVGs have no pixel dimensions — skip size check
    if (f.type === 'image/svg+xml') return { ok: true };
    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = typeof window !== 'undefined' ? new window.Image() : (null as unknown as HTMLImageElement);
      if (!img) { resolve(null); return; }
      const url = URL.createObjectURL(f);
      img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.width, h: img.height }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
    if (!dims || dims.w < 300 || dims.h < 300) return { ok: false, error: 'Minimum dimensions 300×300 px' };
    return { ok: true };
  };

  const handleUpload = async () => {
    if (!file) { toast('Select a logo file', 'error'); return; }
    if (!uploadSchoolId) { toast('Select a school', 'error'); return; }
    const v = await validateFileClient(file);
    if (!v.ok) { toast(v.error!, 'error'); return; }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('school_id', uploadSchoolId);
      if (uploadDescription.trim()) fd.append('description', uploadDescription.trim());
      await adminApi.logos.create(fd);
      toast('Logo uploaded successfully');
      // Reset form
      setFile(null);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      setUploadSchoolId('');
      setUploadDescription('');
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
      setOffset(0);
      // Switch to manage tab so user sees the new logo
      setActiveTab('manage');
      fetchLogos();
    } catch (e: unknown) {
      toast((e instanceof Error ? e.message : String(e)) || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (id: string, f: File, inputEl: HTMLInputElement) => {
    const v = await validateFileClient(f);
    if (!v.ok) { toast(v.error!, 'error'); return; }
    try {
      setActionLoadingId(id);
      const fd = new FormData();
      fd.append('replace_image', 'true');
      fd.append('file', f);
      await adminApi.logos.update(id, fd);
      toast('Logo image replaced');
      // Reset so same file can be selected again
      inputEl.value = '';
      fetchLogos();
    } catch (e: unknown) {
      toast((e instanceof Error ? e.message : String(e)) || 'Replace failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmDelete = (id: string, hard: boolean, schoolName: string) => {
    setDeleteDialog({ open: true, id, hard, schoolName });
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteDialog) return;
    const { id, hard } = deleteDialog;
    setDeleteDialog(null);
    try {
      setActionLoadingId(id);
      await adminApi.logos.delete(id, hard);
      toast(hard ? 'Logo permanently deleted' : 'Logo soft-deleted');
      fetchLogos();
    } catch (e: unknown) {
      toast((e instanceof Error ? e.message : String(e)) || 'Delete failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEditDialog = (logo: LogoItem) => {
    setEditDialog({ open: true, logo });
    setEditSchoolId(logo.school_id ?? '');
    setEditDescription(logo.description ?? '');
  };

  const handleEditSave = async () => {
    if (!editDialog) return;
    try {
      setEditSaving(true);
      const fd = new FormData();
      if (editSchoolId) fd.append('school_id', editSchoolId);
      fd.append('description', editDescription.trim());
      await adminApi.logos.update(editDialog.logo.id, fd);
      toast('Logo updated');
      setEditDialog(null);
      fetchLogos();
    } catch (e: unknown) {
      toast((e instanceof Error ? e.message : String(e)) || 'Update failed', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Logo Management</h1>
          <p className="text-gray-600 mt-1">Upload, view, edit, and delete school logos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="manage">Manage Logos</TabsTrigger>
          <TabsTrigger value="upload">Upload New</TabsTrigger>
        </TabsList>

        {/* ── Upload Tab ── */}
        <TabsContent value="upload">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Logo</CardTitle>
              <CardDescription>JPG, PNG, SVG · Max 2 MB · Min 300×300 px (raster only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <section className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="space-y-2">
                    <Label htmlFor="school_id">School</Label>
                    <select
                      id="school_id"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={uploadSchoolId}
                      onChange={(e) => setUploadSchoolId(e.target.value)}
                    >
                      <option value="">Select a school…</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input id="description" value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="e.g., Official school logo" />
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="file">Logo File</Label>
                    <Input ref={uploadFileInputRef} id="file" type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onFileChange} />
                  </div>
                  <div className="mt-6">
                    <Button onClick={handleUpload} disabled={uploading} className="w-full">
                      {uploading ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>) : (<><Upload className="h-4 w-4 mr-2" /> Upload</>)}
                    </Button>
                  </div>
                </div>
                <div>
                  <section className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2"><ImageIcon className="h-5 w-5" /><span className="font-medium">Preview</span></div>
                    {previewUrl ? (
                      <div className="aspect-[4/1] flex items-center justify-center bg-white border rounded-lg relative min-h-24">
                        <Image src={previewUrl} alt="Preview" fill className="object-contain" unoptimized />
                      </div>
                    ) : (
                      <div className="h-24 flex items-center justify-center text-gray-400">No file selected</div>
                    )}
                  </section>
                </div>
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Manage Tab ── */}
        <TabsContent value="manage">
          <Card className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Logos</CardTitle>
                  <CardDescription>Showing {filteredLogos.length} of {total} logos</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Filter by school name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Page {currentPage} / {Math.max(totalPages, 1)}</Badge>
                  <Button variant="outline" onClick={fetchLogos}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {loading ? (
                  <div className="col-span-full py-8 text-center text-gray-500">Loading logos…</div>
                ) : filteredLogos.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-gray-500">{search ? 'No logos match your search' : 'No logos found'}</div>
                ) : (
                  filteredLogos.map((logo) => (
                    <div key={logo.id} className="border rounded-lg p-3 group relative">
                      <div className="flex items-center justify-center h-20 overflow-hidden relative">
                        <Image src={logo.image_url} alt={logo.school_name} width={80} height={80} className="max-h-16 opacity-80 group-hover:opacity-100 transition-opacity object-contain" unoptimized />
                      </div>
                      <div className="mt-2 text-sm font-medium truncate" title={logo.school_name}>{logo.school_name}</div>
                      <div className="mt-1 text-xs text-gray-500 truncate" title={logo.description || ''}>{logo.description || '—'}</div>

                      <div className="mt-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Replace image */}
                        <label title="Replace image" className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1 cursor-pointer">
                          <Edit className="h-3 w-3" /> Replace
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleReplace(logo.id, f, e.target);
                            }}
                          />
                        </label>

                        <div className="flex items-center gap-1">
                          {/* Edit metadata */}
                          <Button size="sm" variant="outline" title="Edit description / school" className="text-gray-600 hover:text-gray-800 h-7 px-2" onClick={() => openEditDialog(logo)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {/* Soft delete */}
                          <Button size="sm" variant="outline" title="Soft delete (recoverable)" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7 px-2 border-orange-200" onClick={() => confirmDelete(logo.id, false, logo.school_name)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {/* Hard delete */}
                          <Button size="sm" variant="outline" title="Permanently delete (irreversible)" className="text-red-600 hover:text-white hover:bg-red-600 h-7 px-2 border-red-300" onClick={() => confirmDelete(logo.id, true, logo.school_name)}>
                            <AlertTriangle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {actionLoadingId === logo.id && (
                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Processing…</div>
                      )}
                    </div>
                  ))
                )}
              </section>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Per page</Label>
                  <select className="border rounded-md p-2 text-sm" value={limit} onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setOffset(0); }}>
                    {[10, 20, 50].map((n: number) => (<option key={n} value={n}>{n}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Prev</Button>
                  <Button variant="outline" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteDialog?.open} onOpenChange={(o) => { if (!o) setDeleteDialog(null); }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deleteDialog?.hard
                ? <><AlertTriangle className="h-5 w-5 text-red-600" /> Permanently Delete Logo</>
                : <><Trash2 className="h-5 w-5 text-orange-500" /> Soft Delete Logo</>}
            </DialogTitle>
            <DialogDescription>
              {deleteDialog?.hard
                ? <>This will <strong>permanently remove</strong> the logo for <strong>{deleteDialog.schoolName}</strong>. This action cannot be undone.</>
                : <>This will hide the logo for <strong>{deleteDialog?.schoolName}</strong> from public pages. It can be restored from the database.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button
              variant={deleteDialog?.hard ? "destructive" : "outline"}
              className={deleteDialog?.hard ? '' : 'text-orange-600 border-orange-300 hover:bg-orange-50'}
              onClick={handleDeleteConfirmed}
            >
              {deleteDialog?.hard ? 'Delete permanently' : 'Soft delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editDialog?.open} onOpenChange={(o) => { if (!o) setEditDialog(null); }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit Logo</DialogTitle>
            <DialogDescription>Update the school association or description for this logo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>School</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={editSchoolId}
                onChange={(e) => setEditSchoolId(e.target.value)}
              >
                <option value="">— no change —</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="e.g., Official school logo" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast toasts={toasts} remove={removeToast} />
    </div>
  );
}
