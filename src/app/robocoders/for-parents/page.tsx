import Link from "next/link";
import { brandHref } from "@/lib/brand-host";
import Footer from "../../../components/Footer";
import HomeCount from "../../../components/public/HomeCount";
import HomeCta from "../../../components/public/HomeCta";
import ParentsExpect from "../../../components/public/ParentsExpect";
import ParentsLearn from "../../../components/public/ParentsLearn";
import ParentsPlans from "../../../components/public/ParentsPlans";
import ParentsProgress from "../../../components/public/ParentsProgress";
import ProductsFaq from "../../../components/public/ProductsFaq";
import { JsonLd, RoboBreadcrumbs, faqPageJsonLd } from "../../../components/seo/JsonLd";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import "../../../components/public/schools.css";
import "../../../components/public/parents.css";
import { display, body } from "../robo-fonts";

// Enable ISR - revalidate every hour
export const revalidate = 3600;

const faqs = [
  {
    question: "Can my child try a class first?",
    answer: "Yes. Start with a free trial class, meet a tutor one on one, then choose the program that fits.",
    href: brandHref("/robocoders/online-classes"),
    cta: "Book a trial class",
  },
  {
    question: "What age is appropriate to start?",
    answer: "We offer programs for ages 6-18. Our Coding Fundamentals course is perfect for beginners aged 6-12, while older students can dive into more advanced topics like AI and App development.",
    href: "#learn",
    cta: "See what children learn",
  },
  {
    question: "Does my child need prior experience?",
    answer: "No! We have programs for complete beginners through advanced students. Our instructors assess each student's level and provide appropriate challenges.",
    href: "#learn",
    cta: "See what children learn",
  },
  {
    question: "What if my child falls behind?",
    answer: "We offer one-on-one guidance sessions and recorded class materials. Our instructors provide extra support to ensure no student is left behind.",
    href: "#expect",
    cta: "See what to expect",
  },
  {
    question: "What equipment is needed?",
    answer: "For coding classes, just a computer with internet. For robotics, we provide all kits and materials. We'll send you a detailed equipment list upon enrollment.",
    href: "#expect",
    cta: "See what to expect",
  },
  {
    question: "Does my child get a certificate?",
    answer: "Yes. Finishing a course earns a certificate that anyone can verify online, and students keep lifetime access to the material.",
    href: "#plans",
    cta: "See the plans",
  },
];

export default function ForParentsPage() {

  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <JsonLd data={faqPageJsonLd(faqs)} />
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "For Parents", path: "/for-parents" },
        ]}
      />
      <main className="ab-main">
        <section className="ab-hero pr-hero" aria-labelledby="pr-h1">
          <div className="rh-wrap ab-hero-grid">
            <div className="ab-hero-copy">
              <h1 id="pr-h1">Give your child a head start in technology.</h1>
              <p className="rh-lede">Coding, robotics and AI classes where your child builds real projects and finishes with a certificate.</p>
              <div className="rh-actions">
                <Link href="/robocoders/online-classes" className="rh-btn rh-btn--primary">Book a free trial class</Link>
                <Link href="/robocoders/programs" className="rh-btn rh-btn--ghost">See the programs</Link>
              </div>
              <dl className="rh-facts">
                <div>
                  <dt><HomeCount to={2000} suffix="+" /></dt>
                  <dd>students trained across India</dd>
                </div>
                <div>
                  <dt>6 to 18</dt>
                  <dd>the ages we teach</dd>
                </div>
                <div>
                  <dt>1 on 1</dt>
                  <dd>with a tutor in the free trial</dd>
                </div>
              </dl>
            </div>
            <ParentsProgress />
          </div>
        </section>

        <section id="expect" className="rh-sec pd-anchor" aria-labelledby="pr-expect">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="pr-expect">What you can expect.</h2>
              <p className="rh-lede">Clear progress, real projects and support when your child needs it.</p>
            </div>
            <ParentsExpect />
          </div>
        </section>

        <section id="learn" className="rh-sec rh-wash pd-anchor" aria-labelledby="pr-learn">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="pr-learn">What your child will learn.</h2>
              <p className="rh-lede">Pick your child&apos;s grade to see their year, module by module.</p>
            </div>
            <ParentsLearn />
          </div>
        </section>

        <section id="plans" className="rh-sec pd-anchor" aria-labelledby="pr-plans">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="pr-plans">Plans that fit your family.</h2>
              <p className="rh-lede">Pay per course, per semester or per year. Payment plans are available.</p>
            </div>
            <ParentsPlans />
          </div>
        </section>

        <section className="rh-sec rh-wash" aria-labelledby="pr-faq">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="pr-faq">Questions from parents.</h2>
              <p className="rh-lede">What families ask before they start.</p>
            </div>
            <ProductsFaq faqs={faqs} />
          </div>
        </section>

        <HomeCta />
      </main>
      <Footer />
    </div>
  );
}
