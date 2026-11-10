import Link from "next/link";
import { brandHref } from "@/lib/brand-host";
import { TRACK_DATA } from "../../../components/public/programs-data";
import ProgramsDetail from "../../../components/public/ProgramsDetail";
import Footer from "../../../components/Footer";
import ProgramsTracks from "../../../components/public/ProgramsTracks";
import HomeJourney from "../../../components/public/HomeJourney";
import HomeFaq from "../../../components/public/HomeFaq";
import HomeCta from "../../../components/public/HomeCta";
import ProgramsPath from "../../../components/public/ProgramsPath";
import ProgramsBooks from "../../../components/public/ProgramsBooks";
import ProgramsKit from "../../../components/public/ProgramsKit";
import { JsonLd, RoboBreadcrumbs, courseListJsonLd } from "../../../components/seo/JsonLd";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import "../../../components/public/programs.css";
import { display, body } from "../robo-fonts";

// Enable ISR - revalidate every hour
export const revalidate = 3600;

const programs = TRACK_DATA.map((t) => ({
  name: t.heading.split(": ").pop()!,
  description: t.answer,
}));

export default function ProgramsPage() {
  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <JsonLd data={courseListJsonLd(programs.map((p) => ({ ...p, audience: "Students ages 6–18" })))} />
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "Programs", path: "/programs" },
        ]}
      />
      <main className="ab-main">
        <section className="ab-hero pg-hero" aria-labelledby="pg-h1">
          <div className="rh-wrap ab-hero-grid">
            <div className="ab-hero-copy">
              <h1 id="pg-h1">Learn to code, build robots and train AI.</h1>
              <p className="rh-lede">Three tracks for students aged 6 to 18, from the first block to a robot that thinks.</p>
              <div className="rh-actions">
                <Link href="#tracks" className="rh-btn rh-btn--primary">See what is inside</Link>
                <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--ghost">Book a trial class</Link>
              </div>
              <dl className="rh-facts">
                <div>
                  <dt>3</dt>
                  <dd>tracks to choose from</dd>
                </div>
                <div>
                  <dt>8 to 12</dt>
                  <dd>weeks in each program</dd>
                </div>
                <div>
                  <dt>6 to 18</dt>
                  <dd>the ages we teach</dd>
                </div>
              </dl>
            </div>
            <ProgramsPath />
          </div>
        </section>

        <ProgramsTracks />
        <ProgramsDetail />
        <ProgramsBooks />
        <HomeJourney />
        <ProgramsKit />
        <HomeFaq />
        <HomeCta />
      </main>
      <Footer />
    </div>
  );
}
