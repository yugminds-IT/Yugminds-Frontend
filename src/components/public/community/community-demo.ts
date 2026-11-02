import { SOCIAL_LINKS } from "@/lib/social-links";
import type { CommunityItem, CommunityPageData, CommunitySectionType } from "@/lib/community-types";

/* DEMO CONTENT. Shown only while the backend has no published community items (or with ?demo=1), so the page can be
   reviewed with a full look. Everything here is made up. To remove: delete this file and the demo fallback in
   app/robocoders/community/page.tsx. */

let n = 0;
const item = (type: CommunitySectionType, p: Partial<CommunityItem> & { title: string }): CommunityItem => ({
  id: `demo-${type}-${++n}`,
  section_type: type,
  subtitle: null, description: null, media_url: null, thumbnail_url: null,
  creator_name: null, creator_avatar_url: null, external_url: null, cta_label: null, cta_url: null,
  likes: 0, views: 0, metadata: {}, order_index: n, is_published: true, is_featured: false,
  ...p,
});

export const DEMO_DATA: CommunityPageData = {
  config: {
    hero_title: "Yugminds Community",
    hero_subtitle: "Discover how our students are building the future, one project at a time.",
    hero_image_url: null,
    section_titles: {},
    section_enabled: {},
    section_colors: {},
    impact_stats: [
      { value: "10+", label: "Competition winners", icon: "trophy" },
      { value: "500+", label: "Certified students", icon: "award" },
      { value: "100%", label: "Parent satisfaction", icon: "star" },
    ],
    social_links: SOCIAL_LINKS,
    corner_pillars: [
      { title: "Share a story", description: "Tell us about your learning journey.", image_url: null, link_url: "/contact" },
      { title: "Make a project", description: "Show the robots, apps and models you build.", image_url: null, link_url: "/programs" },
      { title: "Learn a skill", description: "Explore courses and tutorials.", image_url: null, link_url: "/online-classes" },
    ],
  },
  items: {
    reels: [
      item("reel", { title: "Line follower in 45 seconds", creator_name: "Aarav, Grade 6" }),
      item("reel", { title: "My first Scratch game", creator_name: "Diya, Grade 3" }),
      item("reel", { title: "Obstacle robot test run", creator_name: "Kabir, Grade 8" }),
      item("reel", { title: "Teaching a model to spot fruit", creator_name: "Meera, Grade 9" }),
      item("reel", { title: "Robot arm pick and place", creator_name: "Rohan, Grade 10" }),
      item("reel", { title: "Science fair day", creator_name: "RoboCoders" }),
    ],
    projects: [
      item("project", { title: "Smart dustbin that opens when you walk up", creator_name: "Aarav, Grade 6", likes: 128, views: 2140, is_featured: true, subtitle: "ESP32 kit" }),
      item("project", { title: "Rain alarm for the balcony", creator_name: "Diya, Grade 5", likes: 74, views: 1020, subtitle: "ESP32 kit" }),
      item("project", { title: "Quiz game with Scratch", creator_name: "Ishaan, Grade 4", likes: 96, views: 1680, subtitle: "Scratch" }),
      item("project", { title: "Plant watering robot", creator_name: "Meera, Grade 9", likes: 143, views: 2890, subtitle: "Python and ESP32" }),
      item("project", { title: "Cat or dog? An image classifier", creator_name: "Kabir, Grade 8", likes: 88, views: 1330, subtitle: "AI and ML" }),
      item("project", { title: "Voice-controlled car", creator_name: "Rohan, Grade 10", likes: 167, views: 3400, subtitle: "Python and ESP32" }),
    ],
    profiles: [
      item("profile", { title: "Aarav K.", subtitle: "Grade 6. Builds robots out of whatever is on the desk.", views: 312, cta_label: "Follow", cta_url: "#" }),
      item("profile", { title: "Diya R.", subtitle: "Grade 5. Scratch games and weather gadgets.", views: 254, cta_label: "Follow", cta_url: "#" }),
      item("profile", { title: "Meera S.", subtitle: "Grade 9. Python, sensors and plants.", views: 478, cta_label: "Follow", cta_url: "#" }),
      item("profile", { title: "Kabir M.", subtitle: "Grade 8. Training small AI models.", views: 389, cta_label: "Follow", cta_url: "#" }),
      item("profile", { title: "Rohan P.", subtitle: "Grade 10. Voice control and robot arms.", views: 521, cta_label: "Follow", cta_url: "#" }),
    ],
    learn_videos: [
      item("learn_video", { title: "Wire your first sensor to an ESP32", creator_name: "RoboCoders tutor" }),
      item("learn_video", { title: "Loops in Scratch, explained with a cat", creator_name: "RoboCoders tutor" }),
      item("learn_video", { title: "Train a model with 20 photos", creator_name: "RoboCoders tutor" }),
      item("learn_video", { title: "Python: your first robot program", creator_name: "RoboCoders tutor" }),
      item("learn_video", { title: "Build a no-code robot with the Play Kit", creator_name: "RoboCoders tutor" }),
    ],
    challenges: [
      item("challenge", {
        title: "The Build in a Week challenge",
        description: "Pick a problem at home, build a small robot or app that solves it, and share a 60-second video. Open to every grade.",
        cta_label: "Join the challenge", cta_url: "/online-classes", is_featured: true, subtitle: "Open now",
      }),
      item("challenge", { title: "Scratch game jam", description: "Make a game in one weekend using only blocks.", cta_label: "Learn more", cta_url: "#", subtitle: "Grades 1 to 7" }),
      item("challenge", { title: "AI for good", description: "Teach a model to help with something useful.", cta_label: "Learn more", cta_url: "#", subtitle: "Grades 8 to 12" }),
    ],
    blogs: [
      item("blog", { title: "Five robotics projects to try this weekend", description: "Simple builds that need only a kit and an afternoon.", external_url: "#" }),
      item("blog", { title: "Why kids should learn Python before they turn 12", description: "What changes when text code replaces blocks.", external_url: "#" }),
      item("blog", { title: "How our tutors teach AI to a ten year old", description: "Examples first, maths later.", external_url: "#" }),
      item("blog", { title: "A parent's guide to the first month", description: "What to expect and how to help at home.", external_url: "#" }),
    ],
  },
};
