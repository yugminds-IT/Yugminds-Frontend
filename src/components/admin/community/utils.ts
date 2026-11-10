import type { CommunityItem, CommunitySectionType } from "@/lib/community-types";

export { plural } from "../students/utils";

/** The six kinds of content, in the order they appear on the public page. `key` is the name the page config uses for the section. */
export const SECTIONS: { type: CommunitySectionType; label: string; short: string; noun: string; key: string }[] = [
  { type: "reel", label: "Impact reels", short: "Reels", noun: "reel", key: "reels" },
  { type: "profile", label: "Profiles", short: "Profiles", noun: "profile", key: "profiles" },
  { type: "project", label: "Projects", short: "Projects", noun: "project", key: "projects" },
  { type: "learn_video", label: "Learn videos", short: "Learn", noun: "learn video", key: "learn_videos" },
  { type: "challenge", label: "Challenges", short: "Challenges", noun: "challenge", key: "challenges" },
  { type: "blog", label: "Blogs", short: "Blogs", noun: "blog", key: "blogs" },
];

export const NEEDS_MEDIA: CommunitySectionType[] = ["reel", "project", "learn_video", "blog"];

export interface SectionCount { total: number; live: number; drafts: number }

export function countBySection(items: CommunityItem[]): Record<CommunitySectionType, SectionCount> {
  const out = Object.fromEntries(SECTIONS.map((s) => [s.type, { total: 0, live: 0, drafts: 0 }])) as Record<CommunitySectionType, SectionCount>;
  for (const it of items) {
    const c = out[it.section_type];
    if (!c) continue;
    c.total += 1;
    if (it.is_published) c.live += 1;
    else c.drafts += 1;
  }
  return out;
}

export const isVideo = (url: string | null | undefined, file?: File | null) =>
  !!file?.type.startsWith("video/") || (!!url && /\.(mp4|webm|mov)(\?|$)/i.test(url));

export const EMPTY_ITEM = (type: CommunitySectionType): Partial<CommunityItem> => ({
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
