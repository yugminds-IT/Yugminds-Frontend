import Image from "next/image";
import { Eye, EyeOff, History, ImageIcon, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import RowMenu from "../../portal/RowMenu";
import { ChipGroup } from "../../portal/notifications";
import type { CommunityItem } from "@/lib/community-types";
import { isVideo } from "./utils";

export type StatusFilter = "all" | "live" | "draft";

/** The items of one section as cards. The switch on a card puts it on the public page or takes it off. */
export default function ItemsTab({
  noun,
  label,
  items,
  total,
  search,
  onSearch,
  status,
  onStatus,
  busyId,
  onAdd,
  onEdit,
  onToggle,
  onHistory,
  onDelete,
}: {
  noun: string;
  label: string;
  items: CommunityItem[];
  /** how many items the section has before the search and status filters */
  total: number;
  search: string;
  onSearch: (v: string) => void;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  busyId: string | null;
  onAdd: () => void;
  onEdit: (i: CommunityItem) => void;
  onToggle: (i: CommunityItem) => void;
  onHistory: (i: CommunityItem) => void;
  onDelete: (i: CommunityItem) => void;
}) {
  const filtered = search.trim() !== "" || status !== "all";
  return (
    <>
      {total > 0 && (
        <div className="cn-bar">
          <div className="sd-search" style={{ flex: "1 1 16rem", maxWidth: "26rem", width: "auto" }}>
            <Search aria-hidden="true" />
            <input type="search" placeholder={`Search ${label.toLowerCase()}`} aria-label={`Search ${label.toLowerCase()}`} value={search} onChange={(e) => onSearch(e.target.value)} />
          </div>
          <ChipGroup label="Show" value={status} options={[["all", "All"], ["live", "Live"], ["draft", "Drafts"]] as const} onChange={onStatus} />
          {filtered && <button className="sm-reset" onClick={() => { onSearch(""); onStatus("all"); }}>Clear</button>}
        </div>
      )}

      {total === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>No {label.toLowerCase()} yet</b>
            <p>Add the first {noun}. It stays a draft until you put it live.</p>
            <button className="sd-btn sd-btn--amber" onClick={onAdd}><Plus aria-hidden="true" />Add {noun}</button>
          </div>
        </section>
      ) : items.length === 0 ? (
        <section className="sd-panel">
          <div className="sd-empty">
            <b>Nothing matches</b>
            <p>Try a different search, or show every {noun}.</p>
            <button className="sd-btn sd-btn--line" onClick={() => { onSearch(""); onStatus("all"); }}>Show all</button>
          </div>
        </section>
      ) : (
        <section className="cn-grid mc-swap" aria-label={label}>
          {items.map((item) => (
            <article key={item.id} className="cn-card" data-busy={busyId === item.id} data-live={item.is_published}>
              <div className="cn-tile">
                {item.media_url ? (
                  isVideo(item.media_url) ? (
                    <video src={item.media_url} muted preload="metadata" aria-hidden="true" />
                  ) : (
                    <Image src={item.media_url} alt="" fill sizes="320px" className="cn-img" unoptimized />
                  )
                ) : (
                  <ImageIcon className="cn-none" aria-hidden="true" />
                )}
              </div>
              <div className="cn-body">
                <b className="cn-title">{item.title}</b>
                {(item.creator_name || item.subtitle) && <small>{item.creator_name || item.subtitle}</small>}
                <span className="cn-chips">
                  <span className="sm-chip" data-on={item.is_published ? "true" : undefined} data-s={item.is_published ? undefined : "idle"}>{item.is_published ? "Live" : "Draft"}</span>
                  {item.is_featured && <span className="sm-chip" data-class="true"><Star aria-hidden="true" width={12} height={12} />&nbsp;Featured</span>}
                </span>
              </div>
              <div className="cn-foot">
                <span className="cn-live">
                  <button type="button" role="switch" aria-checked={item.is_published} aria-label={`${item.title} is live on the page`} className="st-switch" disabled={busyId === item.id} onClick={() => onToggle(item)} />
                  {item.is_published ? <><Eye aria-hidden="true" />On the page</> : <><EyeOff aria-hidden="true" />Hidden</>}
                </span>
                <RowMenu
                  label={`Actions for ${item.title}`}
                  items={[
                    { label: "Edit", icon: Pencil, onClick: () => onEdit(item) },
                    { label: "Version history", icon: History, onClick: () => onHistory(item) },
                    { label: "Delete", icon: Trash2, onClick: () => onDelete(item), danger: true, separatorBefore: true },
                  ]}
                />
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
