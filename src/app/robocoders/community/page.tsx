import Footer from "@/components/Footer";
import CommunityPage from "@/components/public/CommunityPage";
import { DEMO_DATA } from "@/components/public/community/community-demo";
import { RoboBreadcrumbs } from "@/components/seo/JsonLd";
import { apiClient } from "@/lib/api";
import type { CommunityPageData } from "@/lib/community-types";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import "../../../components/public/online.css";
import "../../../components/public/community.css";
import { display, body } from "../robo-fonts";

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

const hasItems = (d: CommunityPageData) => Object.values(d.items).some((list) => list.length > 0);

export default async function CommunityRoute({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo: forceDemo } = await searchParams;
  const live = await getCommunityData();
  // Demo content stands in until items are published (or with ?demo=1). Remove with community-demo.ts.
  const demo = forceDemo === "1" || !live || !hasItems(live);
  const data = demo || !live ? DEMO_DATA : live;

  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "Community", path: "/community" },
        ]}
      />
      <CommunityPage data={data} demo={demo} />
      <Footer />
    </div>
  );
}
