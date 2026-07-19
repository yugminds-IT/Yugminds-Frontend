"use client";

import HomeHero from "../../components/public/HomeHero";
import HomeFeatures from "../../components/public/HomeFeatures";
import CombinedSchoolsTestimonials from "../../components/public/CombinedSchoolsTestimonials";
import HomeStats from "../../components/public/HomeStats";
import HomeTestimonials from "../../components/public/HomeTestimonials";
import Footer from "../../components/Footer";

export default function RobocodersPage() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <HomeHero />             {/* white  */}
        <HomeFeatures />         {/* blue   */}
        <CombinedSchoolsTestimonials /> {/* white — school logos (hidden when empty) */}
        <HomeTestimonials />     {/* white — kept adjacent to Features/blue on either side */}
        <HomeStats />            {/* blue — closes the page in blue before the dark footer */}
      </main>
      <Footer />
    </div>
  );
}
