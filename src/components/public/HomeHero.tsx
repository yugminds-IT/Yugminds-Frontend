import Link from "next/link";
import { brandHref } from "@/lib/brand-host";
import HomeHeroVisual from "./HomeHeroVisual";
import HomeCount from "./HomeCount";
import HomeBuilds from "./HomeBuilds";

export default function HomeHero() {
  return (
    <section className="rh-hero">
      <div className="rh-hero-main">
        <div className="rh-hero-wide rh-hero-grid">
          <div className="rh-hero-copy">
            <h1>
              <span>Code it.</span> <span>Build it.</span> <span>Make it think.</span>
            </h1>
            <div className="rh-hero-text">
              <p className="rh-lede">Coding, robotics and AI for students aged 6 to 18.</p>
              <p className="rh-sub">
                Hands-on classes at school or online. Every student builds real projects and finishes with a certificate.
              </p>
            </div>
            <div className="rh-actions">
              <Link href="/robocoders/programs" className="rh-btn rh-btn--primary">
                Explore programs
              </Link>
              <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--ghost">
                Book a demo
              </Link>
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
          <HomeHeroVisual />
        </div>
      </div>

      <HomeBuilds />
    </section>
  );
}
