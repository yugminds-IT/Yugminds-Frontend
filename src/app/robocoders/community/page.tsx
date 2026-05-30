import Footer from "@/components/Footer";
import { CommunityPageContent } from "@/components/public/community/CommunityPageContent";
import { apiClient } from "@/lib/api";
import type { CommunityPageData } from "@/lib/community-types";

export const dynamic = "force-dynamic";

async function getCommunityData(): Promise<CommunityPageData | null> {
  try {
    const { data } = await apiClient.get("/community");
    return data as CommunityPageData;
  } catch (error) {
    console.error("Error loading community page:", error);
    return null;
  }
}

const EMPTY_DATA: CommunityPageData = {
  config: {
    hero_title: "Yugminds Community",
    hero_subtitle:
      "Discover how our students are building the future, one project at a time",
    hero_image_url: null,
    section_titles: {},
    section_enabled: {},
    section_colors: {},
    impact_stats: [],
    social_links: [],
    corner_pillars: [],
  },
  items: {
    reels: [],
    profiles: [],
    projects: [],
    learn_videos: [],
    challenges: [],
    blogs: [],
  },
};

export default async function CommunityPage() {
  const data = (await getCommunityData()) ?? EMPTY_DATA;

  return (
    <div className="min-h-screen bg-white">
      <CommunityPageContent data={data} />
      <Footer />
    </div>
  );
}
