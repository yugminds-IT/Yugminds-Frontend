"use client";

import { useState } from "react";
import { Check, Loader2, MessageSquare, Reply, Send, Trash2, UserRound } from "lucide-react";
import { formatNotificationType } from "@/lib/notification-format";
import Droid from "./Droid";
import Modal from "./Modal";

/** Shared notification pieces: time helpers, the inbox track, one row, and the reply thread. */

export type NotifItem = {
  id: string;
  is_read?: boolean;
  type?: string;
  title?: string;
  message?: string;
  created_at?: string;
  allow_replies?: boolean;
};

export type ReplyItem = {
  id: string;
  user_id: string | number;
  reply_text: string;
  created_at: string;
  updated_at?: string;
  profiles?: { full_name?: string | null; email?: string; role?: string };
};

export const DAY = 86_400_000;

export const initialsOf = (s?: string | null) =>
  (s || "?").split(/[\s@]+/).filter(Boolean).map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "?";

export function ago(iso: string | undefined, now: number): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diff = now - t;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 2 * DAY) return "Yesterday";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function groupOf(iso: string | undefined, startOfToday: number): string {
  const t = iso ? new Date(iso).getTime() : 0;
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - DAY) return "Yesterday";
  if (t >= startOfToday - 6 * DAY) return "This week";
  return "Earlier";
}

/** Your newest notifications as dots: amber is unread. The droid waits at the first unread one. */
export function InboxRun({ items }: { items: Pick<NotifItem, "is_read">[] }) {
  const shown = items.slice(0, 12);
  const n = Math.max(1, shown.length);
  const firstUnread = shown.findIndex((x) => !x.is_read);
  const at = firstUnread >= 0 ? firstUnread : n - 1;
  return (
    <div className="sd-run nt-run" style={{ "--n": n, "--p": (at + 0.5) / n, "--spin": `${(at + 0.5) * 520}deg` } as React.CSSProperties}>
      <div className="sd-droid"><Droid /></div>
      <div className="sd-run-line" />
      <ol className="sd-days" aria-label="Your newest notifications, unread ones in amber">
        {Array.from({ length: n }, (_, i) => (
          <li key={i} className="sd-day" data-active={shown[i] ? !shown[i].is_read : false} data-future={!shown[i]}>
            <span className="sd-node" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One notification. Every action is optional: leave a handler out and its button is not shown. */
export function NotificationRow({
  n,
  now,
  leaving = false,
  replyCount,
  meta,
  extra,
  onRead,
  onReplies,
  onDelete,
}: {
  n: NotifItem;
  now: number;
  leaving?: boolean;
  /** shows a count next to the replies button when above zero */
  replyCount?: number;
  /** extra line items after the time, e.g. who it was sent to */
  meta?: React.ReactNode;
  /** goes between the message and the time line, e.g. a link to a related page */
  extra?: React.ReactNode;
  onRead?: () => void;
  onReplies?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = formatNotificationType(n.type);
  const Icon = t.icon;
  const unread = !n.is_read;
  const long = (n.message?.length ?? 0) > 170 || (n.message?.split("\n").length ?? 0) > 3;
  return (
    <article className={`nt-row ${leaving ? "nt-exit" : ""}`} data-unread={unread}>
      <span className="nt-ico" aria-hidden="true"><Icon /></span>
      <div className="nt-main">
        <h3 className="nt-title">{n.title}</h3>
        {n.message && <p className="nt-msg" data-clamp={long && !open}>{n.message}</p>}
        {long && <button className="nt-more" onClick={() => setOpen((o) => !o)}>{open ? "Show less" : "Read more"}</button>}
        {extra}
        <p className="nt-meta">
          <span className="nt-type">{t.label}</span>
          <span>{ago(n.created_at, now)}</span>
          {unread && <span>• New</span>}
          {meta}
        </p>
      </div>
      <div className="nt-acts">
        {unread && onRead && (
          <button className="pl-ico" data-t="read" onClick={onRead} aria-label="Mark as read" title="Mark as read"><Check /></button>
        )}
        {onReplies && (
          <button
            className="pl-ico"
            onClick={onReplies}
            aria-label={replyCount ? `Open replies (${replyCount})` : "Open replies"}
            title={replyCount ? `Replies (${replyCount})` : "Replies"}
          >
            <MessageSquare />
            {!!replyCount && replyCount > 0 && <b className="nt-count">{replyCount}</b>}
          </button>
        )}
        {onDelete && (
          <button className="pl-ico nt-del" onClick={onDelete} aria-label="Delete notification" title="Delete"><Trash2 /></button>
        )}
      </div>
    </article>
  );
}

/** The reply thread for a notification, with a composer (or a note when replies are off). */
export function RepliesModal({
  open,
  onClose,
  title,
  subtitle,
  allowReplies,
  replies,
  loading,
  text,
  onText,
  onSend,
  sending,
  myId,
  now,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  allowReplies?: boolean;
  replies: ReplyItem[];
  loading: boolean;
  text: string;
  onText: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  /** replies from this user id show on the right as "You" */
  myId?: string | number | null;
  now: number;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={title || "Notification"}
      subtitle={subtitle}
      footer={
        allowReplies === false ? (
          <>
            <span className="sd-modal-note">Replies are turned off for this one.</span>
            <button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>
          </>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem", width: "100%" }}>
            <textarea
              className="sd-field"
              placeholder="Write a reply"
              aria-label="Your reply"
              rows={2}
              value={text}
              onChange={(e) => onText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend(); }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
              <span className="sd-modal-note">Press Ctrl and Enter to send</span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>
                <button className="sd-btn sd-btn--amber" onClick={onSend} disabled={sending || !text.trim()}>
                  {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}Send reply
                </button>
              </div>
            </div>
          </div>
        )
      }
    >
      {loading ? (
        <><div className="sd-skel" /><div className="sd-skel" /></>
      ) : replies.length === 0 ? (
        <div className="sd-empty"><b>No replies yet</b><p>{allowReplies === false ? "Nobody can reply to this one." : "Be the first to reply below."}</p></div>
      ) : (
        <div className="nt-thread">
          {replies.map((r) => {
            const name = r.profiles?.full_name || r.profiles?.email || "Someone";
            const me = myId != null && String(r.user_id) === String(myId);
            return (
              <div key={r.id} className="nt-msg-row" data-me={me}>
                <span className="sd-avatar" aria-hidden="true">{me ? <UserRound size={16} /> : initialsOf(name)}</span>
                <div className="nt-bubble">
                  <div className="nt-bubble-top">
                    <b>{me ? "You" : name}</b>
                    {r.profiles?.role && !me && <small style={{ textTransform: "capitalize" }}>{r.profiles.role}</small>}
                    <small>{ago(r.created_at, now)}</small>
                  </div>
                  <p>{r.reply_text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** The top band for every Notifications page: a headline, one status line, actions, and the inbox track. */
export function NotificationsHero({
  status,
  actions,
  items,
  unread,
  unreadNote = "unread on this page",
}: {
  status: React.ReactNode;
  actions?: React.ReactNode;
  items: Pick<NotifItem, "is_read">[];
  unread: number;
  unreadNote?: string;
}) {
  return (
    <section className="sd-hero mc-band" aria-labelledby="nt-title">
      <div className="sd-hero-copy">
        <h1 id="nt-title" className="mc-hero-title">Notifications</h1>
        <p className="sd-status">{status}</p>
        {actions && <div className="sd-hero-actions">{actions}</div>}
      </div>
      <div className="sd-run-card">
        <InboxRun items={items} />
        <div className="sd-run-foot">
          <b>{unread}<small>{unreadNote}</small></b>
          <span>Amber means unread</span>
        </div>
      </div>
    </section>
  );
}

/** A row of pill buttons where one is selected. */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="as-chips" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" className="as-chip" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

/**
 * Previous and next for server-paged lists. Shows nothing when everything fits on one page.
 * Pass `sizes` and `onSize` to let people pick how many rows a page holds.
 */
export function Pager({
  offset,
  count,
  total,
  pageSize,
  busy = false,
  onPrev,
  onNext,
  sizes,
  onSize,
  noun = "rows",
}: {
  offset: number;
  count: number;
  total: number;
  pageSize: number;
  busy?: boolean;
  onPrev: () => void;
  onNext: () => void;
  sizes?: number[];
  onSize?: (n: number) => void;
  noun?: string;
}) {
  // With a size picker the bar stays visible, so someone on 100 per page can go back to 25.
  if (total <= (sizes ? Math.min(...sizes) : pageSize)) return null;
  return (
    <div className="nt-pager">
      <span>Showing {count === 0 ? 0 : offset + 1}–{offset + count} of {total}</span>
      <div>
        {sizes && onSize && (
          <label className="nt-size">
            <span>Show</span>
            <select value={pageSize} onChange={(e) => onSize(Number(e.target.value))} aria-label={`${noun} per page`}>
              {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <button className="sd-btn sd-btn--line" disabled={offset === 0 || busy} onClick={onPrev}>Previous</button>
        <button className="sd-btn sd-btn--line" disabled={offset + pageSize >= total || busy} onClick={onNext}>Next</button>
      </div>
    </div>
  );
}

export type RecipientChoice = { id: string; name?: string | null; email?: string; role?: string; count?: number };

/** Tick people, groups or schools. Shows a note instead when the list is loading or empty. */
export function RecipientList({
  items,
  selected,
  onToggle,
  loading,
  avatars = false,
  emptyText = "Nobody to pick yet.",
}: {
  items: RecipientChoice[];
  selected: string[];
  onToggle: (id: string) => void;
  loading: boolean;
  avatars?: boolean;
  emptyText?: string;
}) {
  if (loading) return <p className="as-fine" style={{ margin: 0 }}><Loader2 className="mr-1 inline h-4 w-4 animate-spin" aria-hidden="true" />Loading…</p>;
  if (items.length === 0) return <p className="as-fine" style={{ margin: 0 }}>{emptyText}</p>;
  return (
    <div className="nt-pick">
      {items.map((r) => {
        const on = selected.includes(r.id);
        const name = r.name || r.email || "Unnamed";
        return (
          <button key={r.id} type="button" aria-pressed={on} onClick={() => onToggle(r.id)}>
            {avatars && <span className="sd-avatar" aria-hidden="true">{initialsOf(name)}</span>}
            <span>
              {name}
              {r.count != null && ` (${r.count})`}
              {r.email && r.name && <small className="nt-sub">{r.email}</small>}
            </span>
            {r.role && <small className="nt-role">{r.role}</small>}
            {on && <Check className="nt-check" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

const TYPES = [["general", "General"], ["info", "Info"], ["success", "Success"], ["warning", "Warning"], ["error", "Error"]] as const;

/**
 * The compose form every role uses. The role-specific part, who gets it, goes in `children`.
 * Pass `titleMax` or `messageMax` to show a character count.
 */
export function NotificationComposer({
  heading = "Send a notification",
  description,
  title, onTitle, titleMax,
  message, onMessage, messageMax,
  type, onType,
  allowReplies, onAllowReplies,
  canSend, sending, onSend,
  children,
}: {
  heading?: string;
  description: string;
  title: string; onTitle: (v: string) => void; titleMax?: number;
  message: string; onMessage: (v: string) => void; messageMax?: number;
  type: string; onType: (v: string) => void;
  allowReplies: boolean; onAllowReplies: (v: boolean) => void;
  canSend: boolean; sending: boolean; onSend: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="sd-panel mc-swap" aria-labelledby="nt-send">
      <div className="sd-panel-head"><div><h2 id="nt-send">{heading}</h2><p>{description}</p></div></div>
      <div className="nt-form">
        <div className="sd-field-wrap">
          <label htmlFor="nt-f-title">Title</label>
          <input id="nt-f-title" className="sd-field" placeholder="What is it about?" maxLength={titleMax} value={title} onChange={(e) => onTitle(e.target.value)} />
          {titleMax && <small className="nt-count-note">{title.length} of {titleMax}</small>}
        </div>
        <div className="sd-field-wrap">
          <label htmlFor="nt-f-message">Message</label>
          <textarea id="nt-f-message" className="sd-field" placeholder="Write your message" rows={5} maxLength={messageMax} value={message} onChange={(e) => onMessage(e.target.value)} />
          {messageMax && <small className="nt-count-note">{message.length} of {messageMax}</small>}
        </div>
        <div className="sd-field-wrap">
          <label>Type</label>
          <ChipGroup label="Type" value={type} options={TYPES} onChange={onType} />
        </div>
        {children}
        <div className="st-pref nt-replies">
          <div>
            <b id="allow-replies-l"><Reply aria-hidden="true" />Allow replies</b>
            <span>{allowReplies ? "People can reply and start a conversation." : "One-way announcement. Replies are turned off."}</span>
          </div>
          <button type="button" role="switch" aria-checked={allowReplies} aria-labelledby="allow-replies-l" className="st-switch" onClick={() => onAllowReplies(!allowReplies)} />
        </div>
        <div>
          <button className="sd-btn sd-btn--amber sd-btn--lg" onClick={onSend} disabled={!canSend}>
            {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {sending ? "Sending…" : "Send notification"}
          </button>
        </div>
      </div>
    </section>
  );
}
