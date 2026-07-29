"use client";

import type { CommunityPageData } from "@/lib/community-types";
import { CommunityHero } from "./CommunityHero";
import { ReelsRow } from "./ReelsRow";
import { ProfilesRow } from "./ProfilesRow";
import { ProjectsGrid } from "./ProjectsGrid";
import { LearnVideosRow } from "./LearnVideosRow";
import { ChallengeBanner } from "./ChallengeBanner";
import { SocialStrip } from "./SocialStrip";
import { CornerPillars } from "./CornerPillars";
import { BlogsRow } from "./BlogsRow";
import { ImpactStats } from "./ImpactStats";

export function CommunityPageContent({ data }: { data: CommunityPageData }) {
  const { config, items } = data;
  const titles   = config.section_titles  ?? {};
  const enabled  = config.section_enabled ?? {};
  const colors   = config.section_colors  ?? {};

  const color = (key: string): "blue" | "white" =>
    colors[key] === "blue" ? "blue" : "white";

  return (
    <>
      {enabled.hero !== false && (
        <CommunityHero config={config} sectionColor={color("hero")} />
      )}

      {enabled.reels !== false && items.reels.length > 0 && (
        <ReelsRow
          title={titles.reels || "Watch Yugminds Impact"}
          items={items.reels}
          sectionColor={color("reels")}
        />
      )}

      {enabled.profiles !== false && items.profiles.length > 0 && (
        <ProfilesRow
          title={titles.profiles || "Active Profiles"}
          items={items.profiles}
          sectionColor={color("profiles")}
        />
      )}

      {enabled.projects !== false && items.projects.length > 0 && (
        <ProjectsGrid
          title={titles.projects || "Yugminds Projects"}
          items={items.projects}
          sectionColor={color("projects")}
        />
      )}

      {enabled.learn_videos !== false && items.learn_videos.length > 0 && (
        <LearnVideosRow
          title={titles.learn_videos || "Explore, Learn, and Build with Us"}
          items={items.learn_videos}
          sectionColor={color("learn_videos")}
        />
      )}

      {enabled.challenges !== false && items.challenges.length > 0 && (
        <ChallengeBanner items={items.challenges} />
      )}

      {config.social_links?.some((s) => s.url) && (
        <SocialStrip links={config.social_links} />
      )}

      {enabled.corner_pillars !== false && config.corner_pillars?.length > 0 && (
        <CornerPillars pillars={config.corner_pillars} sectionColor={color("corner_pillars")} />
      )}

      {enabled.blogs !== false && items.blogs.length > 0 && (
        <BlogsRow
          title={titles.blogs || "Recent Blogs"}
          items={items.blogs}
          sectionColor={color("blogs")}
        />
      )}

      {config.impact_stats?.length > 0 && (
        <ImpactStats stats={config.impact_stats} sectionColor={color("impact_stats")} />
      )}
    </>
  );
}
