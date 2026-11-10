import Image from "next/image";
import { ImageIcon, Loader2 } from "lucide-react";
import Modal from "../../portal/Modal";
import type { CommunityItem, CommunitySectionType } from "@/lib/community-types";
import { NEEDS_MEDIA, isVideo } from "./utils";

/** Add or edit one item. "Save" keeps the Live switch as set; "Save and put live" turns it on. */
export default function ItemModal({
  open,
  isNew,
  type,
  typeLabel,
  form,
  onForm,
  mediaFile,
  mediaPreview,
  onFile,
  saving,
  onSave,
  onClose,
}: {
  open: boolean;
  isNew: boolean;
  type: CommunitySectionType;
  typeLabel: string;
  form: Partial<CommunityItem>;
  onForm: (f: Partial<CommunityItem>) => void;
  mediaFile: File | null;
  mediaPreview: string | null;
  onFile: (f: File) => void;
  saving: boolean;
  onSave: (publish: boolean) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof CommunityItem>(k: K, v: CommunityItem[K]) => onForm({ ...form, [k]: v });
  const num = (k: "likes" | "views" | "order_index") => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (parseInt(e.target.value, 10) || 0) as never);
  const needsMedia = NEEDS_MEDIA.includes(type);
  const hasCreator = type === "profile" || type === "project" || type === "reel";
  const hasCta = type === "challenge" || type === "profile";
  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      wide
      title={`${isNew ? "Add" : "Edit"} ${typeLabel.toLowerCase()}`}
      subtitle={isNew ? "It stays a draft until you put it live." : form.title || undefined}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="sd-btn sd-btn--line" onClick={() => onSave(false)} disabled={saving}>Save</button>
          <button className="sd-btn sd-btn--amber" onClick={() => onSave(true)} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save and put live
          </button>
        </>
      }
    >
      <div className="sd-field-wrap">
        <label htmlFor="cn-title">Title</label>
        <input id="cn-title" className="sd-field" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="What visitors see first" />
      </div>
      <div className="sd-field-wrap">
        <label htmlFor="cn-sub">Subtitle</label>
        <input id="cn-sub" className="sd-field" value={form.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} placeholder="A short tagline or role" />
      </div>
      <div className="sd-field-wrap">
        <label htmlFor="cn-desc">Description</label>
        <textarea id="cn-desc" className="sd-field cn-area" rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="The longer story" />
      </div>

      <div className="sd-field-wrap">
        <label htmlFor="cn-media">Image or video{needsMedia ? " (or an external link below)" : ""}</label>
        <div className="cn-drop" data-has={!!(mediaFile || mediaPreview)}>
          <input id="cn-media" type="file" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <ImageIcon aria-hidden="true" />
          {mediaFile ? <><b>{mediaFile.name}</b><small>Choose another to change it.</small></> : mediaPreview ? <><b>Media is set</b><small>Choose a file to replace it.</small></> : <><b>Choose a file</b><small>Images up to 5 MB, videos up to 100 MB</small></>}
        </div>
        {mediaPreview && (
          <div className="cn-prev">
            {isVideo(mediaPreview, mediaFile) ? <video src={mediaPreview} controls /> : <Image src={mediaPreview} alt="Preview" fill sizes="480px" className="cn-img" unoptimized />}
          </div>
        )}
      </div>

      {hasCreator && (
        <div className="sd-field-wrap">
          <label htmlFor="cn-creator">Creator name</label>
          <input id="cn-creator" className="sd-field" value={form.creator_name ?? ""} onChange={(e) => set("creator_name", e.target.value)} placeholder="Student or maker" />
        </div>
      )}

      <div className="sd-field-wrap">
        <label htmlFor="cn-url">External link</label>
        <input id="cn-url" className="sd-field" value={form.external_url ?? ""} onChange={(e) => set("external_url", e.target.value)} placeholder="https://" />
      </div>
      {hasCta && (
        <div className="sm-two">
          <div className="sd-field-wrap">
            <label htmlFor="cn-cta">Button text</label>
            <input id="cn-cta" className="sd-field" value={form.cta_label ?? ""} onChange={(e) => set("cta_label", e.target.value)} placeholder="e.g. Join now" />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="cn-cta-url">Button link</label>
            <input id="cn-cta-url" className="sd-field" value={form.cta_url ?? ""} onChange={(e) => set("cta_url", e.target.value)} placeholder="https://" />
          </div>
        </div>
      )}

      <div className="cn-three">
        <div className="sd-field-wrap">
          <label htmlFor="cn-likes">Likes</label>
          <input id="cn-likes" className="sd-field" type="number" min={0} value={form.likes ?? 0} onChange={num("likes")} />
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="cn-views">Views</label>
          <input id="cn-views" className="sd-field" type="number" min={0} value={form.views ?? 0} onChange={num("views")} />
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="cn-order">Position</label>
          <input id="cn-order" className="sd-field" type="number" min={0} value={form.order_index ?? 0} onChange={num("order_index")} />
        </div>
      </div>

      <div className="cn-switches">
        <label>
          <button type="button" role="switch" aria-checked={!!form.is_published} className="st-switch" onClick={() => set("is_published", !form.is_published)} />
          Live on the community page
        </label>
        {type === "challenge" && (
          <label>
            <button type="button" role="switch" aria-checked={!!form.is_featured} className="st-switch" onClick={() => set("is_featured", !form.is_featured)} />
            Show as the featured banner
          </label>
        )}
      </div>
    </Modal>
  );
}
