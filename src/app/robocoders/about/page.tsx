import Link from "next/link";
import { brandHref } from "@/lib/brand-host";
import Footer from "../../../components/Footer";
import AboutStory from "../../../components/public/AboutStory";
import AboutTeach from "../../../components/public/AboutTeach";
import AboutWhy from "../../../components/public/AboutWhy";
import AboutBuildStage from "../../../components/public/AboutBuildStage";
import HomeCount from "../../../components/public/HomeCount";
import HomeCta from "../../../components/public/HomeCta";
import { RoboBreadcrumbs } from "../../../components/seo/JsonLd";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import { display, body } from "../robo-fonts";

// Enable ISR - revalidate every hour
export const revalidate = 3600;

export default function AboutPage() {
  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "About", path: "/about" },
        ]}
      />
      <main className="ab-main">
        <section className="ab-hero" aria-labelledby="ab-h1">
          <div className="rh-wrap ab-hero-grid">
            <div className="ab-hero-copy">
              <h1 id="ab-h1">We teach students to build.</h1>
              <p className="rh-lede">RoboCoders is a coding, robotics and AI program from YugMinds, for students aged 6 to 18.</p>
              <div className="rh-actions">
                <Link href="/robocoders/programs" className="rh-btn rh-btn--primary">Explore programs</Link>
                <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--ghost">Get in touch</Link>
              </div>
              <dl className="rh-facts">
                <div>
                  <dt><HomeCount to={2000} suffix="+" /></dt>
                  <dd>students trained across India</dd>
                </div>
                <div>
                  <dt><HomeCount to={20} suffix="+" /></dt>
                  <dd>partner schools nationwide</dd>
                </div>
                <div>
                  <dt>6 to 18</dt>
                  <dd>the ages we teach</dd>
                </div>
              </dl>
            </div>
            <AboutBuildStage />
          </div>
        </section>

        <section className="rh-sec rh-dark" aria-labelledby="ab-why">
          <AboutWhy />
        </section>

        <section className="rh-sec" aria-labelledby="ab-story">
          <AboutStory />
        </section>

        <section className="rh-sec rh-wash" aria-labelledby="ab-values">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="ab-values">How we teach.</h2>
              <p className="rh-lede">Four principles shape every class, project and conversation.</p>
            </div>
            <AboutTeach />
          </div>
        </section>

        <HomeCta />
      </main>
      <Footer />
    </div>
  );
}
