export type CommunitySectionType =
  | 'reel'
  | 'profile'
  | 'project'
  | 'learn_video'
  | 'challenge'
  | 'blog';

export interface CommunityConfig {
  hero_title: string;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  section_titles: Record<string, string>;
  section_enabled: Record<string, boolean>;
  section_colors: Record<string, 'blue' | 'white'>;
  impact_stats: { value: string; label: string; icon: string }[];
  social_links: { platform: string; label: string; url: string }[];
  corner_pillars: {
    title: string;
    description: string;
    image_url: string | null;
    link_url: string;
  }[];
  updated_at?: string;
}

export interface CommunityItem {
  id: string;
  section_type: CommunitySectionType;
  title: string;
  subtitle: string | null;
  description: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  creator_name: string | null;
  creator_avatar_url: string | null;
  external_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  likes: number;
  views: number;
  metadata: Record<string, unknown>;
  order_index: number;
  is_published: boolean;
  is_featured: boolean;
  updated_at?: string;
}

export interface CommunityPageData {
  config: CommunityConfig;
  items: {
    reels: CommunityItem[];
    profiles: CommunityItem[];
    projects: CommunityItem[];
    learn_videos: CommunityItem[];
    challenges: CommunityItem[];
    blogs: CommunityItem[];
  };
}

export const COMMUNITY_TABS: { id: CommunitySectionType | 'settings' | 'corner_pillars'; label: string }[] = [
  { id: 'settings', label: 'Page Settings' },
  { id: 'reel', label: 'Impact Reels' },
  { id: 'profile', label: 'Profiles' },
  { id: 'project', label: 'Projects' },
  { id: 'learn_video', label: 'Learn Videos' },
  { id: 'challenge', label: 'Challenges' },
  { id: 'blog', label: 'Blogs' },
  { id: 'corner_pillars', label: 'Corner Pillars' },
];

export const SECTION_TYPE_LABELS: Record<CommunitySectionType, string> = {
  reel: 'Impact Reel',
  profile: 'Profile',
  project: 'Project',
  learn_video: 'Learn Video',
  challenge: 'Challenge',
  blog: 'Blog',
};
