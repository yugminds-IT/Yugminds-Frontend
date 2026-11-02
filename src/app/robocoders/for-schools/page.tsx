import Link from "next/link";
import { brandHref } from "@/lib/brand-host";
import Footer from "../../../components/Footer";
import HomeCount from "../../../components/public/HomeCount";
import HomeSchools from "../../../components/public/HomeSchools";
import ProductsFaq from "../../../components/public/ProductsFaq";
import SchoolGets from "../../../components/public/SchoolGets";
import SchoolLearn from "../../../components/public/SchoolLearn";
import SchoolLaunch from "../../../components/public/SchoolLaunch";
import SchoolTimetable from "../../../components/public/SchoolTimetable";
import { JsonLd, RoboBreadcrumbs, faqPageJsonLd } from "../../../components/seo/JsonLd";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import "../../../components/public/schools.css";
import { display, body } from "../robo-fonts";

// Enable ISR - revalidate every hour
export const revalidate = 3600;

const schoolFaqs = [
  {
    question: "How does RoboCoders integrate with our school timetable?",
    answer:
      "We customize delivery around your periods — weekly clubs, semester modules, or full STEM periods. Our team maps a program plan that fits your academic calendar.",
    href: "#launch",
    cta: "See the launch plan",
  },
  {
    question: "Do you provide instructors and materials?",
    answer:
      "Yes. Trained RoboCoders instructors can teach independently or co-teach with your staff. Kits, textbooks, and LMS access are included so your school can launch ready to run.",
    href: "#gets",
    cta: "See what you get",
  },
  {
    question: "What grades do you cover?",
    answer:
      "Programs span ages 6–18, from block coding and Scratch through Arduino robotics and introductory AI — suitable for primary through senior secondary.",
    href: "#learn",
    cta: "See what students learn",
  },
  {
    question: "How do we get started?",
    answer:
      "Schedule a free consultation via our contact page. We assess goals, propose a pilot or full rollout, and handle setup and teacher orientation.",
    href: brandHref("/robocoders/contact"),
    cta: "Book a consultation",
  },
  {
    question: "Can our school order RoboCoders products in bulk?",
    answer:
      "Yes. Schools can contact the RoboCoders team for bulk orders, product demos and classroom packages for RoboCoders Studio, the ESP32 Robotics Kit, the Junior Robotics Kit and the Play Kit.",
    href: brandHref("/robocoders/products"),
    cta: "See the products",
  },
];

export default function ForSchoolsPage() {
  const contactHref = brandHref("/robocoders/contact");

  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <JsonLd data={faqPageJsonLd(schoolFaqs)} />
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "For Schools", path: "/for-schools" },
        ]}
      />
      <main className="ab-main">
        <section className="ab-hero sc-hero" aria-labelledby="sc-h1">
          <div className="rh-wrap ab-hero-grid">
            <div className="ab-hero-copy">
              <h1 id="sc-h1">Bring coding, robotics and AI to your school.</h1>
              <p className="rh-lede">We handle setup, instructors and support, so your students start building from the first class.</p>
              <div className="rh-actions">
                <Link href={contactHref} className="rh-btn rh-btn--primary">Book a school demo</Link>
                <Link href="/robocoders/programs" className="rh-btn rh-btn--ghost">See the programs</Link>
              </div>
              <dl className="rh-facts">
                <div>
                  <dt><HomeCount to={20} suffix="+" /></dt>
                  <dd>partner schools nationwide</dd>
                </div>
                <div>
                  <dt>6 to 18</dt>
                  <dd>the ages we teach</dd>
                </div>
                <div>
                  <dt>24/7</dt>
                  <dd>tech support for your classes</dd>
                </div>
              </dl>
            </div>
            <SchoolTimetable />
          </div>
        </section>

        <section id="gets" className="rh-sec pd-anchor" aria-labelledby="sc-gets">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="sc-gets">What your school gets.</h2>
              <p className="rh-lede">One partner for the program, the people and the equipment.</p>
            </div>
            <SchoolGets />
          </div>
        </section>

        <section id="launch" className="rh-sec rh-dark pd-anchor" aria-labelledby="sc-launch">
          <div className="rh-wrap">
            <div className="rh-head sc-launch-head">
              <h2 id="sc-launch">From first call to first class.</h2>
              <p className="rh-lede">Four steps, and we do the heavy lifting in each one.</p>
            </div>
            <SchoolLaunch />
          </div>
        </section>

        <HomeSchools />

        <section id="learn" className="rh-sec rh-wash pd-anchor" aria-labelledby="sc-learn">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="sc-learn">What your students learn.</h2>
              <p className="rh-lede">From first blocks in primary school to machine learning in senior secondary.</p>
            </div>
            <SchoolLearn />
          </div>
        </section>

        <section className="rh-sec" aria-labelledby="sc-faq">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="sc-faq">Questions from schools.</h2>
              <p className="rh-lede">What schools ask before they partner with us.</p>
            </div>
            <ProductsFaq faqs={schoolFaqs} />
          </div>
        </section>

        <section className="rh-sec rh-dark" aria-labelledby="sc-close">
          <div className="rh-wrap sc-close">
            <h2 id="sc-close">Let&apos;s plan your first class.</h2>
            <p className="rh-lede">Book a free consultation. We look at your goals, then propose a pilot or a full rollout and handle setup and teacher orientation.</p>
            <div className="rh-actions">
              <Link href={contactHref} className="rh-btn rh-btn--primary">Book a school demo</Link>
              <Link href={brandHref("/robocoders/products")} className="rh-btn rh-btn--ghost">See the products</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
