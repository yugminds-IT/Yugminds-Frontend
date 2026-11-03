"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bot, Brain, Check, Cpu, Eye, Facebook, Gamepad2, Heart, Instagram,
  Lightbulb, Linkedin, MessageCircle, Pause, Play, Star, Trophy, UserPlus, Video, Wrench, Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CommunityItem, CommunityPageData } from "@/lib/community-types";
import { SOCIAL_LINKS } from "@/lib/social-links";
import HomeCount from "./HomeCount";
import { useStill } from "./useStill";
import "./droid.css";

type Icon = LucideIcon;

const ART: Icon[] = [Bot, Cpu, Brain, Gamepad2, Wrench, Lightbulb];
const SOCIAL: Record<string, Icon> = { youtube: Youtube, facebook: Facebook, linkedin: Linkedin, instagram: Instagram, whatsapp: MessageCircle };

const clean = (s: string | null) => (s ?? "").replace(/<[^>]*>/g, "");
const initials = (s: string | null) => (s || "R").trim().charAt(0).toUpperCase();
const isVideo = (u: string | null) => !!u && /\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i.test(u);
const ytId = (u: string) =>
  u.match(/youtube\.com\/shorts\/([\w-]{11})/)?.[1] ?? u.match(/[?&]v=([\w-]{11})/)?.[1] ?? u.match(/youtu\.be\/([\w-]{11})/)?.[1] ?? null;
const thumbOf = (i: CommunityItem) => {
  if (i.thumbnail_url) return i.thumbnail_url;
  if (i.media_url && !isVideo(i.media_url)) return i.media_url;
  const id = i.external_url ? ytId(i.external_url) : null;
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};
// Admin-entered links are written for the old site ("/contact"); keep them working under /robocoders.
const linkOf = (u: string | null) => (!u ? "#" : /^(https?:|#|mailto:)/.test(u) || u.startsWith("/robocoders") ? u : `/robocoders${u}`);
const Anchor = ({ href, className, children, label }: { href: string | null; className?: string; children: React.ReactNode; label?: string }) => {
  const to = linkOf(href);
  return /^https?:/.test(to)
    ? <a href={to} className={className} target="_blank" rel="noopener noreferrer" aria-label={label}>{children}</a>
    : <Link href={to} className={className} aria-label={label}>{children}</Link>;
};

/* Placeholder picture for an item with no image: a navy bench with a small icon, so the page looks finished before every
   item has a photo. */
function Art({ i, Pic }: { i: number; Pic?: Icon }) {
  const P = Pic ?? ART[i % ART.length];
  return <div className="cm-art" data-t={i % 3} aria-hidden="true"><P size={40} aria-hidden="true" /></div>;
}
const Pic = ({ item, i, alt }: { item: CommunityItem; i: number; alt: string }) => {
  const src = thumbOf(item);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={alt} loading="lazy" />
    : isVideo(item.media_url)
      ? <video src={item.media_url!} muted playsInline preload="metadata" aria-label={alt} />
      : <Art i={i} />;
};
const Avatar = ({ item }: { item: CommunityItem }) =>
  item.creator_avatar_url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="cm-av" src={item.creator_avatar_url} alt="" />
    : <span className="cm-av" aria-hidden="true">{initials(item.creator_name || item.title)}</span>;

const REEL_MS = 5200;
const REEL_RESUME_MS = 12000;

/* Reels as a short-video viewer, like stories: one tall screen plays the current reel with a progress segment per reel,
   and the list beside it shows what is next. It moves on by itself while on screen; picking a reel holds it and the
   rotation resumes after a pause. Reels with no picture get a small animated scene (a droid at work) so the screen is
   never a blank rectangle. Direct video files play muted. Reduced motion never advances. */
function Reels({ items }: { items: CommunityItem[] }) {
  const [cur, setCur] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const still = useStill();
  const box = useRef<HTMLDivElement>(null);
  const N = items.length;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || picked || !inView || N < 2) return;
    const id = setTimeout(() => setCur((c) => (c + 1) % N), REEL_MS);
    return () => clearTimeout(id);
  }, [cur, still, picked, inView, N]);
  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), REEL_RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, cur]);

  const r = items[cur];
  const src = thumbOf(r);
  const running = !still && !picked && inView;
  return (
    <div className="cm-rl" ref={box}>
      <div className="cm-phone">
        <ol className="cm-segs" aria-hidden="true">
          {items.slice(0, 10).map((x, i) => (
            <li key={x.id} data-state={i < cur ? "done" : i === cur ? "now" : "todo"}>
              <i style={running && i === cur ? { animationDuration: `${REEL_MS}ms` } : undefined} data-run={running && i === cur} />
            </li>
          ))}
        </ol>
        <div className="cm-screen" key={r.id} aria-live="polite">
          {src
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={src} alt={r.title} />
            : isVideo(r.media_url)
              ? <video src={r.media_url!} autoPlay muted loop playsInline aria-label={r.title} />
              : (
                <div className="cm-scene" data-t={cur % 3} aria-hidden="true">
                  {(() => { const P = ART[cur % ART.length]; return <span className="cm-scene-ico"><P size={44} aria-hidden="true" /></span>; })()}
                  <i className="cm-scene-dots" />
                  <div className="droid-mini cm-scene-droid"><div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div><div className="droid__body" /></div>
                  <i className="cm-scene-floor" />
                </div>
              )}
          <div className="cm-screen-top"><Avatar item={r} /><span>{r.creator_name || "Student"}</span></div>
          <p className="cm-screen-cap">{r.title}</p>
        </div>
      </div>

      <div className="cm-rl-side">
        <ol className="cm-rl-list" aria-label="Reels">
          {items.map((x, i) => (
            <li key={x.id} data-on={i === cur}>
              <button type="button" aria-pressed={i === cur} onClick={() => { setPicked(true); setCur(i); }}>
                <span className="cm-rl-thumb">{thumbOf(x) ? <Pic item={x} i={i} alt="" /> : <Art i={i} />}</span>
                <span className="cm-rl-txt"><b>{x.title}</b><small>{x.creator_name || "Student"}</small></span>
                <Play size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
        {r.external_url && (
          <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="rh-btn rh-btn--ghost">Watch the full video</a>
        )}
      </div>
    </div>
  );
}

const SORTS = [
  { id: "new", label: "Latest" },
  { id: "likes", label: "Most liked" },
  { id: "views", label: "Most viewed" },
] as const;
const PAGE = 6;

/* Projects as a gallery you can steer: filter by what they were built with (the item's subtitle, so it follows the
   admin's tags), sort by latest, likes or views, and open more. Cards are one size so the grid stays tidy; a small bar
   under each shows its likes against the most liked project shown. Changing the filter or sort replays the cards in. */
function Projects({ items }: { items: CommunityItem[] }) {
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("new");
  const [limit, setLimit] = useState(PAGE);
  const tags = [...new Set(items.map((p) => p.subtitle).filter(Boolean) as string[])];
  const pool = items.filter((p) => !tag || p.subtitle === tag);
  const list = sort === "new" ? pool : [...pool].sort((a, b) => (sort === "likes" ? b.likes - a.likes : b.views - a.views));
  const shown = list.slice(0, limit);
  const top = Math.max(1, ...pool.map((p) => p.likes));
  const star = items.reduce((a, b) => (b.likes > a.likes ? b : a), items[0]);
  const change = (fn: () => void) => { fn(); setLimit(PAGE); };
  return (
    <div className="cm-pj">
      <div className="cm-pj-bar">
        {tags.length > 1 && (
          <div className="cm-chips" role="group" aria-label="Filter projects">
            {["", ...tags].map((t) => (
              <button key={t || "all"} type="button" aria-pressed={tag === t} onClick={() => change(() => setTag(t))}>
                {t || "All"} <small>{t ? items.filter((p) => p.subtitle === t).length : items.length}</small>
              </button>
            ))}
          </div>
        )}
        <div className="cm-sort" role="group" aria-label="Sort projects">
          {SORTS.map((o) => (
            <button key={o.id} type="button" aria-pressed={sort === o.id} onClick={() => change(() => setSort(o.id))}>{o.label}</button>
          ))}
        </div>
      </div>
      <ul className="cm-pj-grid" key={`${tag}-${sort}`} aria-live="polite">
        {shown.map((p, i) => (
          <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
            <article className="cm-proj">
              <div className="cm-proj-pic">
                <Pic item={p} i={items.indexOf(p)} alt={p.title} />
                {p.subtitle && <span className="cm-proj-tag">{p.subtitle}</span>}
                {p === star && p.likes > 0 && <span className="cm-proj-top"><Star size={13} aria-hidden="true" /> Most liked</span>}
              </div>
              <div className="cm-proj-body">
                <h3>{p.title}</h3>
                <div className="cm-proj-by"><Avatar item={p} /><span>{p.creator_name || "Maker"}</span></div>
                <div className="cm-proj-stats">
                  <span><Heart size={14} aria-hidden="true" /> {p.likes.toLocaleString()}</span>
                  <span><Eye size={14} aria-hidden="true" /> {p.views.toLocaleString()}</span>
                  <i aria-hidden="true"><b style={{ transform: `scaleX(${p.likes / top})` }} /></i>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {list.length > limit && (
        <button type="button" className="rh-btn rh-btn--ghost cm-more" onClick={() => setLimit((l) => l + PAGE)}>
          Show more projects ({list.length - limit})
        </button>
      )}
    </div>
  );
}

const MEMBER_MS = 5500;
const MEMBER_RESUME_MS = 12000;

/* Members as a leaderboard with a spotlight. The list ranks members by followers (when there are any) with a bar for
   each; the spotlight shows the selected member, with a ring around the avatar that fills as the turn runs out. It moves
   down the list on its own while on screen; picking a member holds them and the rotation resumes after a pause.
   Reduced motion never advances. */
function Members({ items }: { items: CommunityItem[] }) {
  const ranked = items.some((m) => m.views > 0) ? [...items].sort((a, b) => b.views - a.views) : items;
  const hasCount = ranked.some((m) => m.views > 0);
  const top = Math.max(1, ...ranked.map((m) => m.views));
  const [cur, setCur] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const still = useStill();
  const box = useRef<HTMLDivElement>(null);
  const N = ranked.length;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || picked || !inView || N < 2) return;
    const id = setTimeout(() => setCur((c) => (c + 1) % N), MEMBER_MS);
    return () => clearTimeout(id);
  }, [cur, still, picked, inView, N]);
  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), MEMBER_RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, cur]);

  const m = ranked[cur];
  const photo = m.creator_avatar_url || m.media_url;
  const running = !still && !picked && inView;
  return (
    <div className="cm-mb" ref={box}>
      <article className="bs cm-spot" key={m.id} aria-live="polite">
        <div className="bs-bar"><span>Member spotlight</span>{hasCount && <em>No. {cur + 1}</em>}</div>
        <div className="cm-spot-body">
          <div className="cm-ring">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="45" />
              <circle cx="50" cy="50" r="45" className="cm-ring-fill" data-run={running} style={running ? { animationDuration: `${MEMBER_MS}ms` } : undefined} />
            </svg>
            {photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photo} alt="" />
              : <span data-t={cur % 3} aria-hidden="true">{initials(m.title)}</span>}
          </div>
          <h3>{m.title}</h3>
          {m.subtitle && <p>{m.subtitle}</p>}
          {hasCount && <p className="cm-spot-n"><b>{m.views.toLocaleString()}</b> followers</p>}
          <div className="cm-spot-act">
            {m.cta_url && <Anchor href={m.cta_url} className="rh-btn rh-btn--primary">{m.cta_label || "Follow"}</Anchor>}
            {m.external_url && <Anchor href={m.external_url} className="rh-btn rh-btn--ghost">View profile</Anchor>}
          </div>
        </div>
      </article>

      <ol className="cm-board-list" aria-label="Members">
        {ranked.map((x, i) => (
          <li key={x.id} data-on={i === cur}>
            <button type="button" aria-pressed={i === cur} onClick={() => { setPicked(true); setCur(i); }}>
              <span className="cm-rank">{i + 1}</span>
              {x.creator_avatar_url || x.media_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="cm-li-av" src={(x.creator_avatar_url || x.media_url)!} alt="" />
                : <span className="cm-li-av" data-t={i % 3} aria-hidden="true">{initials(x.title)}</span>}
              <span className="cm-li-txt">
                <b>{x.title}</b>
                {hasCount
                  ? <i aria-hidden="true"><u style={{ transform: `scaleX(${x.views / top})` }} /></i>
                  : <small>Community member</small>}
              </span>
              {hasCount && <span className="cm-li-n">{x.views.toLocaleString()}</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

const CH_MS = 6500;
const CH_RESUME_MS = 12000;
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, d: (i % 5) * 0.25, c: i % 3 }));

/* Challenges as a stage: the list of challenges on one side, the selected one on the other with a small victory scene
   (a podium rising, the trophy dropping in, the droid hopping, confetti). The featured challenge comes first. It moves
   to the next challenge on its own while on screen, with a bar showing the time left; picking one holds it and the turns
   resume after a pause. The scene replays on every change. Reduced motion shows the finished scene and never advances. */
function Challenges({ items }: { items: CommunityItem[] }) {
  const list = [...items.filter((c) => c.is_featured), ...items.filter((c) => !c.is_featured)];
  const [cur, setCur] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const still = useStill();
  const box = useRef<HTMLDivElement>(null);
  const N = list.length;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || picked || !inView || N < 2) return;
    const id = setTimeout(() => setCur((c) => (c + 1) % N), CH_MS);
    return () => clearTimeout(id);
  }, [cur, still, picked, inView, N]);
  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), CH_RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, cur]);

  const c = list[cur];
  return (
    <div className="cm-chx" ref={box} data-solo={N === 1}>
      {N > 1 && (
        <ol className="cm-chx-list" aria-label="Challenges">
          {list.map((x, i) => (
            <li key={x.id} data-on={i === cur} style={{ "--ms": `${CH_MS}ms` } as React.CSSProperties}>
              <button type="button" aria-pressed={i === cur} onClick={() => { setPicked(true); setCur(i); }}>
                <span className="rh-chip-ico"><Trophy size={18} aria-hidden="true" /></span>
                <span><b>{x.title}</b>{x.subtitle && <small>{x.subtitle}</small>}</span>
              </button>
              {i === cur && !still && !picked && inView && <i className="of-bar" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      )}

      <article className="cm-chx-stage" key={c.id} aria-live="polite">
        <div className="cm-chx-copy">
          <span className="cm-ch-tag"><Trophy size={14} aria-hidden="true" /> {c.subtitle || "Challenge"}</span>
          <h3>{c.title}</h3>
          {c.description && <p>{clean(c.description)}</p>}
          {c.cta_url && <Anchor href={c.cta_url} className="rh-btn rh-btn--primary">{c.cta_label || "Join now"}</Anchor>}
        </div>
        <div className="cm-chx-scene" aria-hidden="true">
          {c.media_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.media_url} alt="" />
            : (
              <>
                {CONFETTI.map((k, i) => <i key={i} className="cm-conf" data-c={k.c} style={{ left: `${k.x}%`, animationDelay: `${1.3 + k.d}s` }} />)}
                <div className="cm-podium">
                  <span className="cm-pod cm-pod--2"><b>2</b></span>
                  <span className="cm-pod cm-pod--1"><b>1</b><span className="cm-cup"><Trophy size={40} /></span></span>
                  <span className="cm-pod cm-pod--3"><b>3</b></span>
                </div>
                <div className="droid-mini cm-chx-droid"><div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div><div className="droid__body" /></div>
              </>
            )}
        </div>
      </article>
    </div>
  );
}

const LESSON_MS = 8000;

/* Tutorials as a lesson player with a playlist. The wide screen plays the current tutorial: a scrubber runs across and,
   when there is no picture, a code window types itself out with the droid cheering it on. When one ends the next starts,
   and the playlist under the screen ticks off what has been watched. The play/pause button really pauses it; picking a
   lesson jumps to it. It plays while on screen. Reduced motion never advances. */
function Lessons({ items }: { items: CommunityItem[] }) {
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const still = useStill();
  const box = useRef<HTMLDivElement>(null);
  const N = items.length;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const run = !still && !paused && inView;
  useEffect(() => {
    if (!run || N < 2) return;
    const id = setTimeout(() => setCur((c) => (c + 1) % N), LESSON_MS);
    return () => clearTimeout(id);
  }, [cur, run, N]);

  // On phones the playlist is a swipeable row: slide the current lesson into view (sideways only, never the page)
  useEffect(() => {
    const row = box.current?.querySelector<HTMLElement>(".cm-list");
    const li = row?.children[cur] as HTMLElement | undefined;
    if (!row || !li || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: li.offsetLeft - 16, behavior: "smooth" });
  }, [cur]);

  const v = items[cur];
  const src = thumbOf(v);
  return (
    <div className="cm-ls" ref={box}>
      <div className="cm-player" data-run={run}>
        <div className="cm-player-screen" key={v.id}>
          {src
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={src} alt={v.title} />
            : isVideo(v.media_url)
              ? <video src={v.media_url!} autoPlay muted loop playsInline aria-label={v.title} />
              : (
                <div className="cm-code" aria-hidden="true">
                  <div className="cm-code-win">
                    <span className="cm-code-dots"><i /><i /><i /></span>
                    {[62, 44, 78, 36, 54].map((w, i) => (
                      <b key={i} className="cm-code-line" style={{ "--w": `${w}%`, "--i": i } as React.CSSProperties} />
                    ))}
                  </div>
                  <div className="droid-mini cm-code-droid"><div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div><div className="droid__body" /></div>
                </div>
              )}
        </div>
        <div className="cm-player-bar">
          <button type="button" onClick={() => setPaused((x) => !x)} aria-label={run ? "Pause" : "Play"}>
            {run ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <div className="cm-scrub" aria-hidden="true"><i key={`${v.id}-${run}`} data-run={run} style={run ? { animationDuration: `${LESSON_MS}ms` } : undefined} /></div>
          <span className="cm-player-n">{cur + 1} / {N}</span>
        </div>
      </div>
      <div className="cm-ls-info" aria-live="polite">
        <div>
          <h3>{v.title}</h3>
          {v.creator_name && <small>{v.creator_name}</small>}
        </div>
        {v.external_url && <a href={v.external_url} target="_blank" rel="noopener noreferrer" className="rh-btn rh-btn--ghost">Watch the full tutorial</a>}
      </div>
      <ol className="cm-list" aria-label="Playlist">
        {items.map((x, i) => (
          <li key={x.id} data-state={i < cur ? "done" : i === cur ? "now" : "todo"}>
            <button type="button" aria-pressed={i === cur} aria-current={i === cur ? "true" : undefined} onClick={() => { setCur(i); setPaused(false); }}>
              <span className="cm-list-n">{i < cur ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
              <b>{x.title}</b>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ART_MS = 6500;
const ART_RESUME_MS = 12000;

// Stand-in cover for an article with no picture: a sheet with a heading and lines of text.
const Doc = () => (
  <div className="cm-doc" aria-hidden="true">
    <span className="cm-doc-sheet"><i /><b /><b /><b /><b /></span>
  </div>
);

/* Articles as a reading list: the selected article is shown large (cover, title, summary, link) and the others wait in a
   list beside it. It moves to the next article on its own while on screen, with a bar on the list row showing the time
   left; picking one holds it and the turns resume after a pause. Works for any number of articles. Reduced motion never
   advances. */
function Articles({ items }: { items: CommunityItem[] }) {
  const list = items.slice(0, 6);
  const [cur, setCur] = useState(0);
  const [picked, setPicked] = useState(false);
  const [inView, setInView] = useState(false);
  const still = useStill();
  const box = useRef<HTMLDivElement>(null);
  const N = list.length;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || picked || !inView || N < 2) return;
    const id = setTimeout(() => setCur((c) => (c + 1) % N), ART_MS);
    return () => clearTimeout(id);
  }, [cur, still, picked, inView, N]);
  useEffect(() => {
    if (!picked) return;
    const id = setTimeout(() => setPicked(false), ART_RESUME_MS);
    return () => clearTimeout(id);
  }, [picked, cur]);

  const b = list[cur];
  const cover = thumbOf(b);
  return (
    <div className="cm-ar" ref={box} data-solo={N === 1}>
      <article className="cm-ar-main" key={b.id} aria-live="polite">
        <div className="cm-ar-cover">
          {cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={cover} alt="" />
            : <Doc />}
        </div>
        <h3>{b.title}</h3>
        {b.description && <p>{clean(b.description)}</p>}
        {b.external_url && <Anchor href={b.external_url} className="rh-btn rh-btn--primary">Read the article</Anchor>}
      </article>

      {N > 1 && (
        <ol className="cm-ar-list" aria-label="Articles" style={{ "--ms": `${ART_MS}ms` } as React.CSSProperties}>
          {list.map((x, i) => (
            <li key={x.id} data-on={i === cur}>
              <button type="button" aria-pressed={i === cur} onClick={() => { setPicked(true); setCur(i); }}>
                <span className="cm-ar-n">{i + 1}</span>
                <span className="cm-ar-txt"><b>{x.title}</b>{x.description && <small>{clean(x.description)}</small>}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              {i === cur && !still && !picked && inView && <i className="of-bar" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* Small text-free scenes for the three ways to join (a conversation, a build, a level-up), picked by position so the
   admin can rename the cards freely. They sit finished; they play once when the section scrolls into view and again
   whenever the card is hovered or focused. */
function PillarScene({ i }: { i: number }) {
  if (i % 3 === 0) {
    return (
      <div className="cm-sc cm-sc--talk">
        <span className="cm-bubble cm-bubble--a"><i /><i /></span>
        <span className="cm-bubble cm-bubble--b"><i /><i /><i /></span>
        <span className="cm-heart"><Heart size={18} aria-hidden="true" /></span>
      </div>
    );
  }
  if (i % 3 === 1) {
    return (
      <div className="cm-sc cm-sc--build">
        <span className="cm-blk cm-blk--1" /><span className="cm-blk cm-blk--2" /><span className="cm-blk cm-blk--3" />
        <div className="droid-mini cm-sc-droid"><div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div><div className="droid__body" /></div>
      </div>
    );
  }
  return (
    <div className="cm-sc cm-sc--level">
      <span className="cm-step cm-step--1" /><span className="cm-step cm-step--2" /><span className="cm-step cm-step--3" />
      <span className="cm-star"><Star size={22} aria-hidden="true" /></span>
    </div>
  );
}

function Pillar({ p, i, seen }: { p: CommunityPageData["config"]["corner_pillars"][number]; i: number; seen: boolean }) {
  const [n, setN] = useState(0);
  const last = useRef(0);
  // replaying remounts the scene, so a cursor jittering on the card edge must not restart it mid-play
  const replay = () => {
    const now = Date.now();
    if (now - last.current < 2000) return;
    last.current = now;
    setN((x) => x + 1);
  };
  return (
    <li>
      <Anchor href={p.link_url} className="cm-pillar" >
        <span className="cm-pillar-pic" data-play={seen} key={n} onMouseEnter={replay} onFocus={replay}>
          {p.image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.image_url} alt="" />
            : <PillarScene i={i} />}
        </span>
        <h3>{p.title}</h3>
        <p>{p.description}</p>
        <span className="cm-pillar-go">Go <ArrowRight size={14} aria-hidden="true" /></span>
      </Anchor>
    </li>
  );
}

function Pillars({ pillars }: { pillars: CommunityPageData["config"]["corner_pillars"] }) {
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <ul className="cm-pillars" ref={ref}>
      {pillars.map((p, i) => <Pillar key={p.title} p={p} i={i} seen={seen} />)}
    </ul>
  );
}

const Head = ({ id, title, text }: { id: string; title: string; text: string }) => (
  <div className="rh-head">
    <h2 id={id}>{title}</h2>
    <p className="rh-lede">{text}</p>
  </div>
);

/* A live board for the hero: what is happening in the community, newest on top. Four rows are always on screen; every
   couple of seconds a new event slides in at the top and the rest move down, so the card is never half empty. Events
   come from the real items (a project shared, a member joined, a challenge opened) and repeat when there are few.
   Reduced motion shows the first four and never moves. */
const SLOTS = 4;
const ROW = 4.6; // rem, row height + gap
function Board({ events, foot }: { events: { who: string; what: string; Pic: Icon; likes?: number }[]; foot: string }) {
  const [tick, setTick] = useState(0);
  const [inView, setInView] = useState(true);
  const still = useStill();
  const box = useRef<HTMLDivElement>(null);
  const N = events.length;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still || !inView || N === 0) return;
    const id = setTimeout(() => setTick((t) => t + 1), 2400);
    return () => clearTimeout(id);
  }, [tick, still, inView, N]);
  if (N === 0) return null;
  // slot 0 is the newest row (event #tick), older rows sit below it; slot -1 waits above to slide in next. Ids keep counting up, so each row keeps its identity as it moves.
  const ids = Array.from({ length: SLOTS + 2 }, (_, k) => tick - (k - 1));
  return (
    <div className="bs cm-board" ref={box}>
      <div className="bs-bar"><span>Community board</span><em><i className="cm-dot" />Live</em></div>
      <ol className="cm-feed" aria-label="Recent community activity" style={{ height: `${SLOTS * ROW}rem` }}>
        {ids.map((id) => {
          const e = events[((id % N) + N) % N];
          const slot = tick - id;
          return (
            <li key={id} data-slot={slot} style={{ transform: `translateY(${slot * ROW}rem)` }}>
              <span className="cm-feed-ico"><e.Pic size={18} aria-hidden="true" /></span>
              <p><b>{e.who}</b> {e.what}</p>
              {e.likes ? <span className="cm-feed-like"><Heart size={13} aria-hidden="true" />{e.likes}</span> : null}
            </li>
          );
        })}
      </ol>
      <div className="bs-foot cm-foot">{foot}</div>
    </div>
  );
}

export default function CommunityPage({ data, demo }: { data: CommunityPageData; demo: boolean }) {
  const { config, items } = data;
  const title = (k: string, fallback: string) => config.section_titles?.[k] || fallback;
  const on = (k: string) => config.section_enabled?.[k] !== false;
  const reels = on("reels") ? items.reels : [];
  const projects = on("projects") ? items.projects : [];
  const profiles = on("profiles") ? items.profiles : [];
  const videos = on("learn_videos") ? items.learn_videos : [];
  const challenges = on("challenges") ? items.challenges : [];
  const blogs = on("blogs") ? items.blogs : [];
  const pillars = on("corner_pillars") ? (config.corner_pillars ?? []).slice(0, 3) : [];
  // Links set in the admin win; until any are filled in, use the RoboCoders accounts from the footer.
  const adminSocial = (config.social_links ?? []).filter((s) => s.url?.trim());
  const social = adminSocial.length > 0 ? adminSocial : SOCIAL_LINKS;
  const stats = (config.impact_stats ?? []).slice(0, 3);
  const featuredChallenge = challenges.find((c) => c.is_featured) ?? challenges[0];

  const events = [
    ...(profiles[0] ? [{ who: profiles[0].title, what: "joined the community", Pic: UserPlus as Icon }] : []),
    ...(videos[0] ? [{ who: "New lesson", what: videos[0].title, Pic: Video as Icon }] : []),
    ...projects.slice(0, 2).map((p) => ({ who: p.creator_name || "A student", what: `shared "${p.title}"`, Pic: Bot as Icon, likes: p.likes })),
    ...(featuredChallenge ? [{ who: "New challenge", what: featuredChallenge.title, Pic: Trophy as Icon }] : []),
  ].slice(0, 5);

  const foot = [projects.length && `${projects.length} projects`, profiles.length && `${profiles.length} members`, videos.length && `${videos.length} lessons`].filter(Boolean).join(", ") + " shared so far";
  // The backend default is the old "Yugminds Community"; this is the RoboCoders community, built by YugMinds.
  const heading = /^yugminds community$/i.test(config.hero_title.trim()) ? "RoboCoders Community" : config.hero_title;

  const jump = [
    reels.length && ["reels", "Reels"], projects.length && ["projects", "Projects"], profiles.length && ["profiles", "Members"],
    challenges.length && ["challenges", "Challenges"], videos.length && ["learn", "Learn"], blogs.length && ["blogs", "Blogs"],
  ].filter(Boolean) as string[][];

  return (
    <main className="ab-main cm">
      {demo && <p className="cm-demo" role="note">Demo content. Nothing here is real until items are published in the admin.</p>}

      <section className="ab-hero cm-hero" aria-labelledby="cm-h1">
        <div className="rh-wrap ab-hero-grid">
          <div className="ab-hero-copy">
            <p className="cm-by"><i aria-hidden="true" />Built by YugMinds</p>
            <h1 id="cm-h1">{heading}</h1>
            {config.hero_subtitle && <p className="rh-lede">{config.hero_subtitle}</p>}
            <div className="rh-actions">
              {featuredChallenge
                ? <a href="#challenges" className="rh-btn rh-btn--primary">See the challenge</a>
                : <Link href="/robocoders/online-classes" className="rh-btn rh-btn--primary">Start free</Link>}
              <Link href="/robocoders/programs" className="rh-btn rh-btn--ghost">Explore programs</Link>
            </div>
            {stats.length > 0 && (
              <dl className="rh-facts">
                {stats.map((s) => {
                  const m = s.value.match(/^(\d[\d,]*)(.*)$/);
                  return (
                    <div key={s.label}>
                      <dt>{m ? <HomeCount to={Number(m[1].replace(/,/g, ""))} suffix={m[2]} /> : s.value}</dt>
                      <dd>{s.label}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
          {config.hero_image_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="cm-hero-img" src={config.hero_image_url} alt="" />
            : <Board events={events} foot={foot} />}
        </div>
      </section>

      {jump.length > 1 && (
        <nav className="cm-jump" aria-label="On this page">
          <div className="rh-wrap">
            {jump.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </div>
        </nav>
      )}

      {reels.length > 0 && (
        <section className="rh-sec" id="reels" aria-labelledby="cm-reels">
          <div className="rh-wrap">
            <Head id="cm-reels" title={title("reels", "Watch our students build.")} text="Builds, experiments and tips in under a minute." />
            <Reels items={reels} />
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className="rh-sec rh-wash" id="projects" aria-labelledby="cm-projects">
          <div className="rh-wrap">
            <Head id="cm-projects" title={title("projects", "What students made.")} text="Real projects from our classrooms and online learners." />
            <Projects items={projects} />
          </div>
        </section>
      )}

      {profiles.length > 0 && (
        <section className="rh-sec" id="profiles" aria-labelledby="cm-profiles">
          <div className="rh-wrap">
            <Head id="cm-profiles" title={title("profiles", "Meet active members.")} text="Students who share, build and help others the most." />
            <Members items={profiles} />
          </div>
        </section>
      )}

      {featuredChallenge && (
        <section className="rh-sec rh-dark" id="challenges" aria-labelledby="cm-ch">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="cm-ch">{title("challenges", "Take on a challenge.")}</h2>
              <p className="rh-lede">Competitions that test what you can build.</p>
            </div>
            <Challenges items={challenges} />
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="rh-sec" id="learn" aria-labelledby="cm-learn">
          <div className="rh-wrap">
            <Head id="cm-learn" title={title("learn_videos", "Learn something new.")} text="Short tutorials from our tutors. Watch, then build along." />
            <Lessons items={videos} />
          </div>
        </section>
      )}

      {blogs.length > 0 && (
        <section className="rh-sec rh-wash" id="blogs" aria-labelledby="cm-blogs">
          <div className="rh-wrap">
            <Head id="cm-blogs" title={title("blogs", "Read and learn.")} text="Stories and guides for students and parents." />
            <Articles items={blogs} />
          </div>
        </section>
      )}

      {pillars.length > 0 && (
        <section className="rh-sec" aria-labelledby="cm-corner">
          <div className="rh-wrap">
            <Head id="cm-corner" title="Be part of it." text="Three ways to join the community today." />
            <Pillars pillars={pillars} />
          </div>
        </section>
      )}

      {social.length > 0 && (
        <section className="rh-sec rh-dark cm-social-sec" aria-labelledby="cm-social">
          <div className="rh-wrap cm-social">
            <div>
              <h2 id="cm-social">Follow along.</h2>
              <p className="rh-lede">New projects and tutorials every week.</p>
            </div>
            <ul>
              {social.map((s) => {
                const I = SOCIAL[s.platform.toLowerCase()] ?? Youtube;
                return (
                  <li key={s.platform}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer"><I size={20} aria-hidden="true" /> {s.label}</a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
