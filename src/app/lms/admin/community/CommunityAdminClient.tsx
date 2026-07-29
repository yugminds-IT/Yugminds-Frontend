"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Save,
  Image as ImageIcon,
  ArrowLeft,
  Eye,
  EyeOff,
  Star,
  LayoutGrid,
  Video,
  Users,
  Trophy,
  Rss,
  Settings2,
  ChevronRight,
  History as HistoryIcon,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "@/lib/api/admin.api";
import { useToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  COMMUNITY_TABS,
  SECTION_TYPE_LABELS,
  type CommunityConfig,
  type CommunityItem,
  type CommunitySectionType,
} from "@/lib/community-types";

type TabId = CommunitySectionType | "settings" | "corner_pillars";

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  settings: Settings2,
  reel: Video,
  profile: Users,
  project: LayoutGrid,
  learn_video: Eye,
  challenge: Trophy,
  blog: Rss,
  corner_pillars: Star,
};

const EMPTY_ITEM = (type: CommunitySectionType): Partial<CommunityItem> => ({
  section_type: type,
  title: "",
  subtitle: "",
  description: "",
  media_url: null,
  creator_name: "",
  external_url: "",
  cta_label: "",
  cta_url: "",
  likes: 0,
  views: 0,
  order_index: 0,
  is_published: false,
  is_featured: false,
});

function revalidateCommunity() {
  fetch("/api/revalidate/community", { method: "POST" }).catch(() => {});
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

export default function CommunityAdminClient() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("settings");
  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Partial<CommunityItem>>({});
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);

  // Version history / revert
  const [historyItem, setHistoryItem] = useState<CommunityItem | null>(null);
  const [versions, setVersions] = useState<{ id: string; version_number: number; created_at: string }[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    const { data } = await adminApi.community.getConfig();
    const c = (data as { config?: CommunityConfig })?.config;
    if (c) {
      setConfig(c);
      setHeroPreview(c.hero_image_url);
    }
  }, []);

  const loadItems = useCallback(async (type?: CommunitySectionType) => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    const { data } = await adminApi.community.listItems(params);
    setItems((data as { items?: CommunityItem[] })?.items ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadConfig();
        if (activeTab !== "settings" && activeTab !== "corner_pillars") await loadItems(activeTab as CommunitySectionType);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeTab, loadConfig, loadItems]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.creator_name?.toLowerCase().includes(q) ?? false)
    );
  }, [items, search]);

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("hero_title", config.hero_title);
      fd.append("hero_subtitle", config.hero_subtitle ?? "");
      fd.append("section_titles", JSON.stringify(config.section_titles ?? {}));
      fd.append("section_enabled", JSON.stringify(config.section_enabled ?? {}));
      fd.append("section_colors", JSON.stringify(config.section_colors ?? {}));
      fd.append("impact_stats", JSON.stringify(config.impact_stats ?? []));
      fd.append("social_links", JSON.stringify(config.social_links ?? []));
      fd.append("corner_pillars", JSON.stringify(config.corner_pillars ?? []));
      if (heroFile) fd.append("hero_image", heroFile);
      const { data: saveData } = await adminApi.community.updateConfig(fd);
      const savedConfig = (saveData as { config?: CommunityConfig })?.config;
      if (savedConfig) {
        setConfig(savedConfig);
        setHeroPreview(savedConfig.hero_image_url);
      } else {
        await loadConfig();
      }
      revalidateCommunity();
      toast.success("Page settings saved successfully.");
    } catch {
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    if (activeTab === "settings" || activeTab === "corner_pillars") return;
    setEditingId("new");
    setForm(EMPTY_ITEM(activeTab as CommunitySectionType));
    setMediaPreview(null);
    setMediaFile(null);
    setView("edit");
  };

  const openEdit = (item: CommunityItem) => {
    setEditingId(item.id);
    setForm({ ...item });
    setMediaPreview(item.media_url);
    setMediaFile(null);
    setView("edit");
  };

  const NEEDS_MEDIA_TYPES: CommunitySectionType[] = ["reel", "project", "learn_video", "blog"];

  const handleSaveItem = async (publish?: boolean) => {
    if (activeTab === "settings" || !form.title?.trim()) {
      toast.error("Title is required.");
      return;
    }
    // Mirrors the server-side rule (media or external URL required for
    // these types) so the error shows up here instead of a generic
    // "Failed to save item" after a round trip.
    if (
      NEEDS_MEDIA_TYPES.includes(activeTab as CommunitySectionType) &&
      !mediaFile &&
      !form.media_url &&
      !form.external_url?.trim()
    ) {
      toast.error("Upload media or provide an external URL for this item.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("section_type", activeTab);
      fd.append("title", form.title.trim());
      if (form.subtitle) fd.append("subtitle", form.subtitle);
      if (form.description) fd.append("description", form.description);
      if (form.creator_name) fd.append("creator_name", form.creator_name);
      if (form.external_url) fd.append("external_url", form.external_url);
      if (form.cta_label) fd.append("cta_label", form.cta_label);
      if (form.cta_url) fd.append("cta_url", form.cta_url);
      fd.append("likes", String(form.likes ?? 0));
      fd.append("views", String(form.views ?? 0));
      fd.append("order_index", String(form.order_index ?? 0));
      fd.append("is_published", publish || form.is_published ? "true" : "false");
      fd.append("is_featured", form.is_featured ? "true" : "false");
      if (mediaFile) fd.append("media", mediaFile);

      if (editingId && editingId !== "new") {
        await adminApi.community.updateItem(editingId, fd);
      } else {
        await adminApi.community.createItem(fd);
      }
      revalidateCommunity();
      toast.success(publish ? "Item saved and published." : "Draft saved.");
      setView("list");
      setEditingId(null);
      await loadItems(activeTab as CommunitySectionType);
    } catch {
      toast.error("Failed to save item. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({
      title: 'Delete this item?',
      description: 'This item will be permanently deleted.',
      confirmText: 'Delete',
      variant: 'danger',
    }))) return;
    try {
      await adminApi.community.deleteItem(id);
      revalidateCommunity();
      toast.success("Item deleted.");
      await loadItems(activeTab as CommunitySectionType);
    } catch {
      toast.error("Failed to delete item.");
    }
  };

  const openHistory = async (item: CommunityItem) => {
    setHistoryItem(item);
    setLoadingVersions(true);
    try {
      const { data } = await adminApi.community.getVersions(item.id);
      setVersions((data as { versions?: typeof versions })?.versions ?? []);
    } catch {
      toast.error("Failed to load version history.");
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRevert = async (versionId: string) => {
    if (!historyItem) return;
    setRevertingId(versionId);
    try {
      await adminApi.community.revert(historyItem.id, { version_id: versionId });
      revalidateCommunity();
      toast.success("Reverted to the selected version.");
      setHistoryItem(null);
      await loadItems(activeTab as CommunitySectionType);
    } catch {
      toast.error("Failed to revert. Please try again.");
    } finally {
      setRevertingId(null);
    }
  };

  const handleTogglePublish = async (item: CommunityItem) => {
    try {
      const fd = new FormData();
      fd.append("section_type", item.section_type);
      fd.append("title", item.title);
      fd.append("is_published", (!item.is_published).toString());
      fd.append("is_featured", item.is_featured.toString());
      fd.append("likes", String(item.likes));
      fd.append("views", String(item.views));
      fd.append("order_index", String(item.order_index));
      await adminApi.community.updateItem(item.id, fd);
      revalidateCommunity();
      toast.success(item.is_published ? "Item unpublished." : "Item published.");
      await loadItems(activeTab as CommunitySectionType);
    } catch {
      toast.error("Failed to update item.");
    }
  };

  const updateImpactStat = (index: number, field: "value" | "label" | "icon", value: string) => {
    if (!config) return;
    const stats = [...(config.impact_stats ?? [])];
    stats[index] = { ...stats[index], [field]: value };
    setConfig({ ...config, impact_stats: stats });
  };

  const updateSocial = (index: number, field: "url" | "label", value: string) => {
    if (!config) return;
    const links = [...(config.social_links ?? [])];
    links[index] = { ...links[index], [field]: value };
    setConfig({ ...config, social_links: links });
  };

  const updatePillar = (index: number, field: "title" | "description" | "link_url" | "image_url", value: string) => {
    if (!config) return;
    const pillars = [...(config.corner_pillars ?? [])];
    pillars[index] = { ...pillars[index], [field]: field === "image_url" ? (value || null) : value };
    setConfig({ ...config, corner_pillars: pillars });
  };

  const addPillar = () => {
    if (!config || (config.corner_pillars ?? []).length >= 3) return;
    setConfig({ ...config, corner_pillars: [...(config.corner_pillars ?? []), { title: "", description: "", image_url: null, link_url: "" }] });
  };

  const removePillar = (index: number) => {
    if (!config) return;
    const pillars = [...(config.corner_pillars ?? [])];
    pillars.splice(index, 1);
    setConfig({ ...config, corner_pillars: pillars });
  };

  /* ── Edit view ── */
  if (view === "edit" && activeTab !== "settings" && activeTab !== "corner_pillars") {
    return (
      <div className="bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
          {/* Edit header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setView("list")}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                Community <ChevronRight className="w-3 h-3" /> {SECTION_TYPE_LABELS[activeTab as CommunitySectionType]}
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {editingId === "new" ? "New" : "Edit"} {SECTION_TYPE_LABELS[activeTab as CommunitySectionType]}
              </h1>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 space-y-5">
              <SectionDivider label="Basic Info" />

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Title <span className="text-red-500">*</span></Label>
                <Input
                  value={form.title ?? ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter a title…"
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Subtitle</Label>
                <Input
                  value={form.subtitle ?? ""}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="Short tagline or role…"
                  className="border-gray-200 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Description</Label>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  placeholder="Detailed description…"
                  className="border-gray-200 focus:border-blue-500 resize-none"
                />
              </div>

              <SectionDivider label="Media" />

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Upload Image or Video</Label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    className="border-0 p-0 h-auto file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-semibold hover:file:bg-blue-100"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setMediaFile(f);
                      setMediaPreview(URL.createObjectURL(f));
                    }}
                  />
                </div>
                {mediaPreview && (
                  <div className="relative w-full max-w-xs h-40 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    {/\.(mp4|webm|mov)/i.test(mediaPreview) || mediaFile?.type.startsWith("video/") ? (
                      <video src={mediaPreview} controls className="w-full h-full object-contain" />
                    ) : (
                      <Image src={mediaPreview} alt="" fill className="object-contain" unoptimized />
                    )}
                  </div>
                )}
              </div>

              {(activeTab === "profile" || activeTab === "project" || activeTab === "reel") && (
                <>
                  <SectionDivider label="Creator" />
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">Creator Name</Label>
                    <Input
                      value={form.creator_name ?? ""}
                      onChange={(e) => setForm({ ...form, creator_name: e.target.value })}
                      placeholder="Student or maker name…"
                      className="border-gray-200 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <SectionDivider label="Links & CTA" />

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">External URL</Label>
                <Input
                  value={form.external_url ?? ""}
                  onChange={(e) => setForm({ ...form, external_url: e.target.value })}
                  placeholder="https://…"
                  className="border-gray-200 focus:border-blue-500"
                />
              </div>

              {(activeTab === "challenge" || activeTab === "profile") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">CTA Label</Label>
                    <Input
                      value={form.cta_label ?? ""}
                      onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                      placeholder="e.g. Join Now"
                      className="border-gray-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">CTA URL</Label>
                    <Input
                      value={form.cta_url ?? ""}
                      onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                      placeholder="https://…"
                      className="border-gray-200"
                    />
                  </div>
                </div>
              )}

              <SectionDivider label="Stats & Settings" />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Likes</Label>
                  <Input
                    type="number"
                    value={form.likes ?? 0}
                    onChange={(e) => setForm({ ...form, likes: parseInt(e.target.value, 10) || 0 })}
                    className="border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Views</Label>
                  <Input
                    type="number"
                    value={form.views ?? 0}
                    onChange={(e) => setForm({ ...form, views: parseInt(e.target.value, 10) || 0 })}
                    className="border-gray-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Order</Label>
                  <Input
                    type="number"
                    value={form.order_index ?? 0}
                    onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value, 10) || 0 })}
                    className="border-gray-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Switch
                    checked={!!form.is_published}
                    onCheckedChange={(v) => setForm({ ...form, is_published: v })}
                  />
                  <span className="text-sm font-medium text-gray-700">Published</span>
                </label>
                {activeTab === "challenge" && (
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <Switch
                      checked={!!form.is_featured}
                      onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                    />
                    <span className="text-sm font-medium text-gray-700">Featured banner</span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
              <Button
                onClick={() => handleSaveItem(true)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save & Publish"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSaveItem(false)}
                disabled={saving}
                className="border-gray-200 text-gray-700 font-semibold"
              >
                Save Draft
              </Button>
              <Button
                variant="ghost"
                onClick={() => setView("list")}
                className="text-gray-500 ml-auto"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── List / Settings view ── */
  return (
    <div className="bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Community Management</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Manage the public community page content from here.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeTab !== "settings" && activeTab !== "corner_pillars" && (
              <Button
                size="sm"
                onClick={openCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Tab navigation — underline style */}
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {COMMUNITY_TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.id] || Settings2;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setView("list");
                    setSearch("");
                  }}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          </div>
        ) : activeTab === "settings" && config ? (

          /* ── Page Settings ── */
          <div className="space-y-6">

            {/* Hero */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Hero Section</h2>
                <p className="text-xs text-gray-400 mt-0.5">Displayed at the top of the community page</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Title</Label>
                  <Input
                    value={config.hero_title}
                    onChange={(e) => setConfig({ ...config, hero_title: e.target.value })}
                    className="border-gray-200 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Subtitle</Label>
                  <Textarea
                    value={config.hero_subtitle ?? ""}
                    onChange={(e) => setConfig({ ...config, hero_subtitle: e.target.value })}
                    rows={2}
                    className="border-gray-200 focus:border-blue-500 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">Hero Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="border-gray-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-semibold hover:file:bg-blue-100"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setHeroFile(f);
                      setHeroPreview(URL.createObjectURL(f));
                    }}
                  />
                  {heroPreview && (
                    <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <Image src={heroPreview} alt="" fill className="object-contain" unoptimized />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section titles, visibility & colour */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Section Titles, Visibility & Colour</h2>
                <p className="text-xs text-gray-400 mt-0.5">Set the title, toggle visibility, and choose a background colour for each section</p>
              </div>
              <div className="divide-y divide-gray-50">
                {(["hero", "reels", "profiles", "projects", "learn_videos", "challenges", "blogs", "corner_pillars", "impact_stats"] as const).map((key) => {
                  const currentColor: "blue" | "white" = config.section_colors?.[key] === "blue" ? "blue" : "white";
                  const isBlue = currentColor === "blue";
                  const setColor = (c: "blue" | "white") =>
                    setConfig({ ...config, section_colors: { ...config.section_colors, [key]: c } });

                  return (
                    <div key={key} className="px-6 py-4 flex items-center gap-3 flex-wrap">
                      {/* Title input — only for sections that have a configurable title */}
                      {key !== "impact_stats" && key !== "hero" && key !== "corner_pillars" ? (
                        <div className="flex-1 min-w-[140px]">
                          <Input
                            placeholder={`${key.replace(/_/g, " ")} section title`}
                            value={config.section_titles?.[key] ?? ""}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                section_titles: { ...config.section_titles, [key]: e.target.value },
                              })
                            }
                            className="border-gray-200 focus:border-blue-500"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 min-w-[140px]">
                          <span className="text-sm font-semibold text-gray-600 capitalize">
                            {key === "hero" ? "Hero Banner" : key === "corner_pillars" ? "Corner Pillars" : "Impact Stats"}
                          </span>
                        </div>
                      )}

                      {/* Colour picker — Blue | White toggle */}
                      <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setColor("white")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                            !isBlue
                              ? "bg-gray-900 text-white"
                              : "bg-white text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full border border-gray-300 bg-white inline-block shrink-0" />
                          White
                        </button>
                        <button
                          type="button"
                          onClick={() => setColor("blue")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                            isBlue
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shrink-0" />
                          Blue
                        </button>
                      </div>

                      {/* Show/hide toggle — not applicable to impact_stats standalone */}
                      {key !== "impact_stats" && (
                        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                          <Switch
                            checked={config.section_enabled?.[key] !== false}
                            onCheckedChange={(v) =>
                              setConfig({
                                ...config,
                                section_enabled: { ...config.section_enabled, [key]: v },
                              })
                            }
                          />
                          <span className="text-sm text-gray-600 font-medium">Show</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Impact stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Impact Stats</h2>
                <p className="text-xs text-gray-400 mt-0.5">Numbers displayed in the impact section</p>
              </div>
              <div className="p-6 space-y-3">
                {(config.impact_stats ?? []).map((stat, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Value (e.g. 500+)"
                      value={stat.value}
                      onChange={(e) => updateImpactStat(i, "value", e.target.value)}
                      className="border-gray-200 focus:border-blue-500"
                    />
                    <Input
                      placeholder="Label"
                      value={stat.label}
                      onChange={(e) => updateImpactStat(i, "label", e.target.value)}
                      className="border-gray-200 focus:border-blue-500"
                    />
                    <Select value={stat.icon} onValueChange={(v) => updateImpactStat(i, "icon", v)}>
                      <SelectTrigger className="border-gray-200">
                        <SelectValue placeholder="Icon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trophy">🏆 Trophy</SelectItem>
                        <SelectItem value="award">🏅 Award</SelectItem>
                        <SelectItem value="star">⭐ Star</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Social links */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Social Links</h2>
                <p className="text-xs text-gray-400 mt-0.5">Platform handles shown in the social section</p>
              </div>
              <div className="divide-y divide-gray-50">
                {(config.social_links ?? []).map((link, i) => (
                  <div key={link.platform} className="px-6 py-3.5 flex items-center gap-3">
                    <span className="w-28 text-sm font-semibold text-gray-600 capitalize shrink-0">
                      {link.label}
                    </span>
                    <Input
                      placeholder="https://…"
                      value={link.url}
                      onChange={(e) => updateSocial(i, "url", e.target.value)}
                      className="border-gray-200 focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfig}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 h-11 rounded-xl"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save Page Settings"}
              </Button>
            </div>
          </div>

        ) : activeTab === "corner_pillars" && config ? (

          /* ── Corner Pillars tab ── */
          <div className="space-y-6">
            {/* Colour & visibility controls */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Corner Pillars Section</h2>
                <p className="text-xs text-gray-400 mt-0.5">Three featured community CTAs with circular images</p>
              </div>
              <div className="px-6 py-4 flex flex-wrap items-center gap-4">
                {/* Colour toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-600">Background:</span>
                  <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                    {(["white", "blue"] as const).map((c) => {
                      const active = (config.section_colors?.corner_pillars ?? "white") === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setConfig({ ...config, section_colors: { ...config.section_colors, corner_pillars: c } })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? c === "blue" ? "bg-blue-600 text-white" : "bg-gray-900 text-white"
                              : "bg-white text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full inline-block shrink-0 ${c === "blue" ? "bg-blue-500" : "border border-gray-300 bg-white"}`} />
                          {c === "white" ? "White" : "Blue"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Show/hide toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={config.section_enabled?.corner_pillars !== false}
                    onCheckedChange={(v) => setConfig({ ...config, section_enabled: { ...config.section_enabled, corner_pillars: v } })}
                  />
                  <span className="text-sm font-medium text-gray-700">Show section</span>
                </label>
              </div>
            </div>

            {/* Pillar cards */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">Pillars</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Up to 3 pillars shown as circular cards</p>
                </div>
                {(config.corner_pillars ?? []).length < 3 && (
                  <Button size="sm" onClick={addPillar} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Pillar
                  </Button>
                )}
              </div>
              <div className="p-6 space-y-4">
                {(config.corner_pillars ?? []).length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No pillars yet. Click &quot;Add Pillar&quot; to add one.
                  </div>
                )}
                {(config.corner_pillars ?? []).map((pillar, i) => (
                  <div key={i} className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pillar {i + 1}</p>
                      <button
                        type="button"
                        onClick={() => removePillar(i)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <Input
                      placeholder="Title (e.g. Share a Story)"
                      value={pillar.title}
                      onChange={(e) => updatePillar(i, "title", e.target.value)}
                      className="border-gray-200 bg-white focus:border-blue-500"
                    />
                    <Input
                      placeholder="Description (short tagline)"
                      value={pillar.description}
                      onChange={(e) => updatePillar(i, "description", e.target.value)}
                      className="border-gray-200 bg-white focus:border-blue-500"
                    />
                    <Input
                      placeholder="Link URL (https://…)"
                      value={pillar.link_url}
                      onChange={(e) => updatePillar(i, "link_url", e.target.value)}
                      className="border-gray-200 bg-white focus:border-blue-500"
                    />
                    <Input
                      placeholder="Image URL (optional, https://…)"
                      value={pillar.image_url ?? ""}
                      onChange={(e) => updatePillar(i, "image_url", e.target.value)}
                      className="border-gray-200 bg-white focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfig}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 h-11 rounded-xl"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save Corner Pillars"}
              </Button>
            </div>
          </div>

        ) : (

          /* ── Item list ── */
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9 border-gray-200 bg-white focus:border-blue-500 rounded-xl h-10"
                placeholder={`Search ${SECTION_TYPE_LABELS[activeTab as CommunitySectionType] || "items"}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Item count */}
            <p className="text-xs text-gray-400 font-medium">
              {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
            </p>

            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <ImageIcon className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm font-medium">No items yet</p>
                <p className="text-xs mt-1">Click &quot;Add Item&quot; to create your first one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex gap-0 hover:shadow-md transition-shadow"
                  >
                    {/* Thumbnail */}
                    <div className="w-28 md:w-36 shrink-0 bg-gray-100 relative overflow-hidden">
                      {item.media_url ? (
                        /\.(mp4|webm)/i.test(item.media_url) ? (
                          <video
                            src={item.media_url}
                            className="w-full h-full object-cover absolute inset-0"
                            muted
                          />
                        ) : (
                          <Image
                            src={item.media_url}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        )
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">
                            {item.title}
                          </h3>
                          {item.creator_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{item.creator_name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                item.is_published
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {item.is_published ? (
                                <><Eye className="w-3 h-3" /> Published</>
                              ) : (
                                <><EyeOff className="w-3 h-3" /> Draft</>
                              )}
                            </span>
                            {item.is_featured && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                                <Star className="w-3 h-3 fill-amber-500" /> Featured
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleTogglePublish(item)}
                            title={item.is_published ? "Unpublish" : "Publish"}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              item.is_published
                                ? "text-green-600 hover:bg-green-50"
                                : "text-gray-400 hover:bg-gray-100"
                            }`}
                          >
                            {item.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            title="Edit"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openHistory(item)}
                            title="Version history"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          >
                            <HistoryIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Version history / revert dialog */}
      <Dialog open={!!historyItem} onOpenChange={(o) => { if (!o) setHistoryItem(null); }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" /> Version History
            </DialogTitle>
            <DialogDescription>
              {historyItem ? <>Previous saved versions of &quot;{historyItem.title}&quot;.</> : null}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 py-1">
            {loadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No saved versions yet.</p>
            ) : (
              versions.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Version {v.version_number}{i === 0 ? " (latest)" : ""}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                  {i !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={revertingId === v.id}
                      onClick={() => handleRevert(v.id)}
                    >
                      {revertingId === v.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><RotateCcw className="h-3 w-3 mr-1" /> Revert</>
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
