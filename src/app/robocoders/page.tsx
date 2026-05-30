"use client";

import HomeHero from "../../components/public/HomeHero";
import HomeFeatures from "../../components/public/HomeFeatures";
import CombinedSchoolsTestimonials from "../../components/public/CombinedSchoolsTestimonials";
import Footer from "../../components/Footer";

export default function RobocodersPage() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <HomeHero />
        <HomeFeatures />
        <CombinedSchoolsTestimonials />
      </main>
      <Footer />
    </div>
  );
}
