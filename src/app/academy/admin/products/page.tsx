"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff, Pencil, Plus } from "lucide-react";
import { academy, formatINR, type CourseRow, type Product, type ProductInput } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { DashboardPage, StatusBadge } from "@/components/academy/ui";
import { ManagementTable, type ManagementTableColumn } from "@/components/ui/management-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Draft = Omit<Product, "id"> & { id?: string };

const EMPTY: Draft = {
  type: "COURSE", slug: "", title: "", description: "", thumbnailUrl: "", priceInPaise: 0, mrpInPaise: null,
  courseId: null, sessionMinutes: 60, sessionCount: 4, isActive: true, sortOrder: 0,
};

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const rupees = (paise: number | null | undefined) => (paise ? String(paise / 100) : "");
const toPaise = (v: string) => (v.trim() ? Math.round(Number(v) * 100) : null);

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    academy.admin.products().then(setProducts).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    load();
    academy.admin.courses().then(setCourses).catch(() => {});
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    const { id, ...body } = draft;
    const payload = {
      ...body,
      description: body.description || undefined,
      thumbnailUrl: body.thumbnailUrl || undefined,
      mrpInPaise: body.mrpInPaise || undefined,
      courseId: body.type === "COURSE" ? body.courseId || undefined : undefined,
      sessionMinutes: body.type === "SESSION_PACK" ? body.sessionMinutes : undefined,
      sessionCount: body.type === "SESSION_PACK" ? body.sessionCount : undefined,
    } as ProductInput;
    try {
      if (id) await academy.admin.updateProduct(id, payload);
      else await academy.admin.createProduct(payload);
      setDraft(null);
      load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const columns: ManagementTableColumn<Product>[] = [
    {
      id: "product",
      header: "Product",
      sortable: true,
      sortValue: (p) => p.title,
      searchValue: (p) => `${p.title} ${p.slug}`,
      render: (p) => (
        <div>
          <p className="font-medium text-gray-900">{p.title}</p>
          <p className="text-xs text-muted-foreground">/{p.slug}</p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      filterable: true,
      filterValue: (p) => (p.type === "COURSE" ? "course" : "class pack"),
      render: (p) => (p.type === "COURSE" ? "Self-paced course" : `${p.sessionCount} × ${p.sessionMinutes}-min classes`),
    },
    {
      id: "price",
      header: "Price",
      align: "right",
      sortable: true,
      sortValue: (p) => p.priceInPaise,
      render: (p) => (p.priceInPaise === 0 ? <StatusBadge status="FREE" label="Free" /> : <span className="tabular-nums">{formatINR(p.priceInPaise)}</span>),
    },
    {
      id: "status",
      header: "Status",
      filterable: true,
      filterValue: (p) => (p.isActive ? "on sale" : "hidden"),
      render: (p) => <StatusBadge status={p.isActive ? "ACTIVE" : "HIDDEN"} label={p.isActive ? "On sale" : "Hidden"} />,
    },
  ];

  const toggle = async (p: Product) => {
    const { id, ...rest } = p;
    setError("");
    try {
      await academy.admin.updateProduct(id, {
        ...rest,
        isActive: !p.isActive,
        description: rest.description || undefined,
        thumbnailUrl: rest.thumbnailUrl || undefined,
        mrpInPaise: rest.mrpInPaise || undefined,
        courseId: rest.courseId || undefined,
        sessionMinutes: rest.sessionMinutes || undefined,
        sessionCount: rest.sessionCount || undefined,
      } as ProductInput);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <DashboardPage
      title="Products & pricing"
      subtitle="What's for sale on the storefront: self-paced courses and 1:1 class packs. ₹0 = free (claimable once per learner)."
      action={
        <Button onClick={() => { setError(""); setDraft({ ...EMPTY }); }} className="bg-ac-brand hover:bg-ac-brand-dark">
          <Plus className="h-4 w-4" /> New product
        </Button>
      }
    >
      {error && !draft && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <ManagementTable
        rows={products ?? []}
        loading={products === null}
        columns={columns}
        entityName="product"
        searchPlaceholder="Search products…"
        emptyMessage="No products yet — create your first one."
        enableSelection={false}
        getRowLabel={(p) => p.title}
        rowActions={[
          { id: "edit", label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: (p) => { setError(""); setDraft({ ...p }); } },
          { id: "toggle", label: "Hide", getLabel: (p) => (p.isActive ? "Hide from storefront" : "Put on sale"), icon: <EyeOff className="h-4 w-4" />, onClick: toggle },
        ]}
      />

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {draft && (
            <form onSubmit={save} className="space-y-4">
              <div className="flex gap-2">
                {(["COURSE", "SESSION_PACK"] as const).map((t) => (
                  <button type="button" key={t} onClick={() => set({ type: t })} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${draft.type === t ? "border-ac-brand bg-ac-soft text-ac-brand" : "border-slate-200"}`}>
                    {t === "COURSE" ? "Self-paced course" : "1:1 class pack"}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" required value={draft.title} onChange={(e) => set({ title: e.target.value, ...(draft.id ? {} : { slug: slugify(e.target.value) }) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">URL slug</Label>
                <Input id="slug" required value={draft.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
              </div>
              {draft.type === "COURSE" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="course">Course it unlocks</Label>
                  <select id="course" required value={draft.courseId ?? ""} onChange={(e) => set({ courseId: e.target.value })} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="" disabled>Pick a course…</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}{c.isPublished ? "" : " (draft — publish it first)"}</option>)}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="count">Classes in pack</Label>
                    <Input id="count" type="number" min={1} max={100} required value={draft.sessionCount ?? ""} onChange={(e) => set({ sessionCount: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mins">Minutes per class</Label>
                    <Input id="mins" type="number" min={15} max={240} step={15} required value={draft.sessionMinutes ?? ""} onChange={(e) => set({ sessionMinutes: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input id="price" type="number" min={0} step="1" required value={String(draft.priceInPaise / 100)} onChange={(e) => set({ priceInPaise: toPaise(e.target.value) ?? 0 })} />
                  <p className="text-xs text-ac-muted">₹0 = free (demo course / trial class); each learner can claim it once.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mrp">Strike-through price (₹)</Label>
                  <Input id="mrp" type="number" min={1} step="1" value={rupees(draft.mrpInPaise)} onChange={(e) => set({ mrpInPaise: toPaise(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" rows={4} value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="thumb">Image URL</Label>
                <Input id="thumb" value={draft.thumbnailUrl ?? ""} onChange={(e) => set({ thumbnailUrl: e.target.value })} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Show on storefront</Label>
                <Switch id="active" checked={draft.isActive ?? true} onCheckedChange={(v) => set({ isActive: v })} />
              </div>
              {error && <p className="whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button disabled={saving} className="w-full rounded-lg bg-ac-brand px-6 py-2.5 font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-60">
                {saving ? "Saving…" : "Save product"}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardPage>
  );
}
