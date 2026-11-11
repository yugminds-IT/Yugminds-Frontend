"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Save } from "lucide-react";
import ConfirmModal from "@/components/portal/ConfirmModal";
import SectionRun from "@/components/admin/community/SectionRun";
import ItemsTab, { type StatusFilter } from "@/components/admin/community/ItemsTab";
import ItemModal from "@/components/admin/community/ItemModal";
import HistoryModal, { type Version } from "@/components/admin/community/HistoryModal";
import SettingsTab from "@/components/admin/community/SettingsTab";
import PillarsTab from "@/components/admin/community/PillarsTab";
import { EMPTY_ITEM, NEEDS_MEDIA, SECTIONS, countBySection, plural } from "@/components/admin/community/utils";
import { adminApi } from "@/lib/api/admin.api";
import { toast } from "@/components/ui/toast";
import { requestClose } from "@/hooks/useUnsavedCloseGuard";
import type { CommunityConfig, CommunityItem, CommunitySectionType } from "@/lib/community-types";
import "@/components/school-admin/overview.css"; // hero meta
import "@/components/teacher/overview/overview.css"; // track
import "@/components/school-admin/students.css"; // sm- chips and forms
import "@/components/school-admin/teachers.css"; // tm- track nodes
import "@/components/admin/community/community.css";

type TabId = CommunitySectionType | "settings" | "corner_pillars";

const PUBLIC_PAGE = "/robocoders/community";

/** Tells the public page to rebuild so a change shows up right away. */
function revalidateCommunity() {
  fetch("/api/revalidate/community", { method: "POST" }).catch(() => {});
}

export default function CommunityAdminClient() {
  const [tab, setTab] = useState<TabId>("settings");
  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  // item dialog
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Partial<CommunityItem>>({});
  const [initialJson, setInitialJson] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);

  // history and delete
  const [historyItem, setHistoryItem] = useState<CommunityItem | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const applyConfig = useCallback((c: CommunityConfig) => {
    setConfig(c);
    setSavedJson(JSON.stringify(c));
    setHeroPreview(c.hero_image_url);
    setHeroFile(null);
  }, []);

  const loadItems = useCallback(async () => {
    const { data } = await adminApi.community.listItems();
    setItems((data as { items?: CommunityItem[] })?.items ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [cfg, list] = await Promise.all([adminApi.community.getConfig(), adminApi.community.listItems()]);
      const c = (cfg.data as { config?: CommunityConfig })?.config;
      if (c) applyConfig(c);
      setItems((list.data as { items?: CommunityItem[] })?.items ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const counts = useMemo(() => countBySection(items), [items]);
  const hidden = useMemo(
    () => new Set(SECTIONS.filter((s) => config?.section_enabled?.[s.key] === false).map((s) => s.type)),
    [config],
  );
  const live = SECTIONS.reduce((n, s) => n + counts[s.type].live, 0);
  const drafts = SECTIONS.reduce((n, s) => n + counts[s.type].drafts, 0);
  const sectionsLive = SECTIONS.filter((s) => counts[s.type].live > 0).length;

  const section = SECTIONS.find((s) => s.type === tab) ?? null;
  const sectionItems = useMemo(() => (section ? items.filter((i) => i.section_type === section.type) : []), [items, section]);
  const shownItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sectionItems.filter(
      (i) =>
        (status === "all" || (status === "live" ? i.is_published : !i.is_published)) &&
        (!q || i.title.toLowerCase().includes(q) || (i.creator_name?.toLowerCase().includes(q) ?? false)),
    );
  }, [sectionItems, search, status]);

  const dirty = !!config && (JSON.stringify(config) !== savedJson || !!heroFile);
  const itemDirty = editingId !== null && (JSON.stringify(form) !== initialJson || !!mediaFile);

  const openSection = (type: CommunitySectionType, st: StatusFilter = "all") => {
    setTab(type);
    setStatus(st);
    setSearch("");
  };

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
      const { data } = await adminApi.community.updateConfig(fd);
      const saved = (data as { config?: CommunityConfig })?.config;
      if (saved) applyConfig(saved);
      else {
        const { data: fresh } = await adminApi.community.getConfig();
        const c = (fresh as { config?: CommunityConfig })?.config;
        if (c) applyConfig(c);
      }
      revalidateCommunity();
      toast.success("Page settings saved");
    } catch {
      toast.error("We could not save the page settings. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const discardConfig = () => {
    if (savedJson) applyConfig(JSON.parse(savedJson) as CommunityConfig);
  };

  const openCreate = () => {
    if (!section) return;
    const f = EMPTY_ITEM(section.type);
    setEditingId("new");
    setForm(f);
    setInitialJson(JSON.stringify(f));
    setMediaPreview(null);
    setMediaFile(null);
  };

  const openEdit = (item: CommunityItem) => {
    setEditingId(item.id);
    setForm({ ...item });
    setInitialJson(JSON.stringify(item));
    setMediaPreview(item.media_url);
    setMediaFile(null);
  };

  const closeItem = () => {
    setEditingId(null);
    setMediaFile(null);
  };

  const handleSaveItem = async (publish: boolean) => {
    if (!section) return;
    if (!form.title?.trim()) {
      toast.error("Add a title first");
      return;
    }
    // Mirrors the server rule so the message shows here instead of a generic failure after a round trip.
    if (NEEDS_MEDIA.includes(section.type) && !mediaFile && !form.media_url && !form.external_url?.trim()) {
      toast.error("Add an image or video, or an external link, for this item");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("section_type", section.type);
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
      if (editingId && editingId !== "new") await adminApi.community.updateItem(editingId, fd);
      else await adminApi.community.createItem(fd);
      revalidateCommunity();
      toast.success(publish ? "Saved and put live" : "Saved");
      closeItem();
      await loadItems();
    } catch {
      toast.error("We could not save this item. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: CommunityItem) => {
    setBusyId(item.id);
    try {
      const fd = new FormData();
      fd.append("section_type", item.section_type);
      fd.append("title", item.title);
      fd.append("is_published", String(!item.is_published));
      fd.append("is_featured", String(item.is_featured));
      fd.append("likes", String(item.likes));
      fd.append("views", String(item.views));
      fd.append("order_index", String(item.order_index));
      await adminApi.community.updateItem(item.id, fd);
      revalidateCommunity();
      toast.success(item.is_published ? "Taken off the page" : "Put live");
      await loadItems();
    } catch {
      toast.error("We could not update this item. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.community.deleteItem(deleteTarget.id);
      revalidateCommunity();
      toast.success("Item deleted");
      setDeleteTarget(null);
      await loadItems();
    } catch {
      toast.error("We could not delete this item. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const openHistory = async (item: CommunityItem) => {
    setHistoryItem(item);
    setLoadingVersions(true);
    setVersions([]);
    try {
      const { data } = await adminApi.community.getVersions(item.id);
      setVersions((data as { versions?: Version[] })?.versions ?? []);
    } catch {
      toast.error("We could not load the version history");
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
      toast.success("Reverted to that version");
      setHistoryItem(null);
      await loadItems();
    } catch {
      toast.error("We could not revert. Try again.");
    } finally {
      setRevertingId(null);
    }
  };

  let statusLine: React.ReactNode;
  if (loadError) statusLine = "The page content did not load. Try refreshing.";
  else if (loading) statusLine = "Checking the page…";
  else if (items.length === 0) statusLine = <><strong>Nothing on the page yet.</strong> Add content to a section to fill it.</>;
  else statusLine = <><strong>{plural(live, "item")} live</strong> in {sectionsLive} of {SECTIONS.length} sections.{drafts > 0 && <> {plural(drafts, "draft")} waiting.</>}</>;

  const runCaption = loading ? "Loading…" : drafts > 0 ? `${plural(drafts, "draft")} to review` : live > 0 ? "Everything is live" : "Nothing live yet";
  const firstWith = (pick: (c: { live: number; drafts: number }) => boolean) => SECTIONS.find((s) => pick(counts[s.type]))?.type;

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="cn-title">
        <div className="sd-hero-copy">
          <h1 id="cn-title" className="mc-hero-title">Community page</h1>
          <p className="sd-where">What visitors see on the public page</p>
          <p className="sd-status">{statusLine}</p>
          <div className="sd-hero-actions">
            {section ? (
              <>
                <button className="sd-btn sd-btn--amber" onClick={openCreate}><Plus aria-hidden="true" />Add {section.noun}</button>
                <a className="sd-btn sd-btn--ghost-dark" href={PUBLIC_PAGE} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />View live page</a>
              </>
            ) : (
              <a className="sd-btn sd-btn--amber" href={PUBLIC_PAGE} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />View live page</a>
            )}
            <button className="so-refresh" style={{ alignSelf: "center" }} onClick={() => void loadAll()} disabled={loading} aria-label={loading ? "Refreshing" : "Refresh"} title="Refresh">
              <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        {loading && !config ? (
          <div className="sd-run-card"><div className="sd-skel" style={{ height: "9rem" }} /></div>
        ) : (
          <SectionRun counts={counts} selected={section?.type ?? null} hidden={hidden} onSelect={(t) => openSection(t)} caption={runCaption} />
        )}
      </section>

      <div className="sd-ledger" role="group" aria-label="Community numbers">
        <button type="button" aria-pressed={false} onClick={() => { const t = firstWith((c) => c.live > 0); if (t) openSection(t, "live"); }}>
          <span className="sd-l">Live items</span><b className="sd-n">{loadError || loading ? "–" : live}</b><small>{loadError ? "Not loaded" : loading ? " " : "On the public page"}</small>
        </button>
        <button type="button" aria-pressed={status === "draft" && !!section} className={drafts > 0 ? "cn-hot" : undefined} onClick={() => { const t = firstWith((c) => c.drafts > 0); if (t) openSection(t, "draft"); }}>
          <span className="sd-l">Drafts</span><b className="sd-n">{loadError || loading ? "–" : drafts}</b><small>{loadError ? "Not loaded" : loading ? " " : drafts > 0 ? "Tap to review them" : "Nothing waiting"}</small>
        </button>
        <button type="button" aria-pressed={tab === "settings"} onClick={() => setTab("settings")}>
          <span className="sd-l">Hidden sections</span><b className="sd-n">{loadError || !config ? "–" : SECTIONS.filter((s) => config.section_enabled?.[s.key] === false).length}</b><small>{!config ? " " : "Switch them on in page settings"}</small>
        </button>
      </div>

      <div className="mc-tabs" role="tablist" aria-label="Parts of the community page" style={{ justifySelf: "start", maxWidth: "100%" }}>
        <button role="tab" className="mc-tab" aria-selected={tab === "settings"} onClick={() => setTab("settings")}>Page settings</button>
        {SECTIONS.map((s) => (
          <button key={s.type} role="tab" className="mc-tab" aria-selected={tab === s.type} onClick={() => openSection(s.type)}>{s.label}{!loading && !loadError && <b>{counts[s.type].total}</b>}</button>
        ))}
        <button role="tab" className="mc-tab" aria-selected={tab === "corner_pillars"} onClick={() => setTab("corner_pillars")}>Corner pillars</button>
      </div>

      {loading && !config ? (
        <div className="sd-panel"><div className="sd-skel" /><div className="sd-skel" /><div className="sd-skel" /></div>
      ) : loadError || !config ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>We could not load the community page</b>
            <p>Check your connection, then try again.</p>
            <button className="sd-btn sd-btn--amber" onClick={() => void loadAll()}>Try again</button>
          </div>
        </section>
      ) : tab === "settings" ? (
        <SettingsTab
          config={config}
          onConfig={setConfig}
          heroPreview={heroPreview}
          onHeroFile={(f) => { setHeroFile(f); setHeroPreview(URL.createObjectURL(f)); }}
        />
      ) : tab === "corner_pillars" ? (
        <PillarsTab config={config} onConfig={setConfig} />
      ) : section ? (
        <ItemsTab
          noun={section.noun}
          label={section.label}
          items={shownItems}
          total={sectionItems.length}
          search={search}
          onSearch={setSearch}
          status={status}
          onStatus={setStatus}
          busyId={busyId}
          onAdd={openCreate}
          onEdit={openEdit}
          onToggle={(i) => void handleToggle(i)}
          onHistory={(i) => void openHistory(i)}
          onDelete={setDeleteTarget}
        />
      ) : null}

      {dirty && (
        <div className="cn-savebar" role="region" aria-label="Unsaved page settings">
          <b>You have unsaved page settings</b>
          <div>
            <button className="sd-btn sd-btn--line" onClick={discardConfig} disabled={saving}>Discard</button>
            <button className="sd-btn sd-btn--amber" onClick={() => void handleSaveConfig()} disabled={saving}>
              <Save aria-hidden="true" />{saving ? "Saving…" : "Save page settings"}
            </button>
          </div>
        </div>
      )}

      {section && (
        <ItemModal
          open={editingId !== null}
          isNew={editingId === "new"}
          type={section.type}
          typeLabel={section.noun}
          form={form}
          onForm={setForm}
          mediaFile={mediaFile}
          mediaPreview={mediaPreview}
          onFile={(f) => { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); }}
          saving={saving}
          onSave={(p) => void handleSaveItem(p)}
          onClose={() => void requestClose(itemDirty, closeItem)}
        />
      )}

      <HistoryModal title={historyItem?.title ?? null} versions={versions} loading={loadingVersions} revertingId={revertingId} onRevert={(id) => void handleRevert(id)} onClose={() => setHistoryItem(null)} />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this item?"
        subtitle={deleteTarget?.title}
        confirmLabel="Delete item"
        danger
        busy={deleting}
        onConfirm={() => void handleDelete()}
      >
        <p style={{ margin: 0 }}>It comes off the community page and is deleted for good. To only hide it, switch it off instead.</p>
      </ConfirmModal>
    </div>
  );
}
