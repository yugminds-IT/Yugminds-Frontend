import Link from "next/link";
import { BookOpen, Video } from "lucide-react";
import { brandHref } from "@/lib/brand-host";
import { formatINR, type Product, type Tutor } from "@/lib/academy/api";
import { fetchCatalog } from "@/components/academy/catalog";
import Footer from "../../../components/Footer";
import OnlineFree from "../../../components/public/OnlineFree";
import OnlineHow from "../../../components/public/OnlineHow";
import OnlineSim from "../../../components/public/OnlineSim";
import ProductsFaq from "../../../components/public/ProductsFaq";
import { JsonLd, RoboBreadcrumbs, faqPageJsonLd } from "../../../components/seo/JsonLd";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import "../../../components/public/online.css";
import { display, body } from "../robo-fonts";

// Live catalog from RoboCoders Academy, refreshed every 5 minutes.
export const revalidate = 300;

// The Academy is its own app (academy.yugminds.org); brandHref gives the canonical
// link in production and the local /academy path in development.
const academy = (path = "") => brandHref(`/academy${path}`);

const FAQS = [
  { question: "Is this the same as RoboCoders classes in my school?", answer: "No. RoboCoders Online Classes are for learners anywhere, outside school. It has its own account and login, separate from the school Student Portal." },
  { question: "What is free?", answer: "Free demo courses, one free 1:1 trial class per learner, and free preview lessons inside paid courses. No card or payment needed." },
  { question: "How do live 1:1 classes work?", answer: "Pick a tutor and a time from their calendar. A joining link appears in your account 10 minutes before the class. Cancel 24 hours ahead and your class credit comes back." },
  { question: "What age is it for?", answer: "Learners aged 6 to 18, from complete beginners to advanced. Each course page lists its level." },
  { question: "What do I need?", answer: "A laptop, tablet or phone with internet. Robotics courses list any kit you'll need." },
];

function priceLabel(p: Product) {
  return p.priceInPaise === 0 ? "Free" : formatINR(p.priceInPaise);
}

export default async function OnlineClassesPage() {
  const [products, tutors] = await Promise.all([
    fetchCatalog<Product[]>("/academy/products", []),
    fetchCatalog<Tutor[]>("/academy/tutors", []),
  ]);

  const freeCourses = products.filter((p) => p.type === "COURSE" && p.priceInPaise === 0);
  const freeTrial = products.find((p) => p.type === "SESSION_PACK" && p.priceInPaise === 0);
  const paidCourses = products.filter((p) => p.type === "COURSE" && p.priceInPaise > 0).slice(0, 6);
  const packs = products.filter((p) => p.type === "SESSION_PACK" && p.priceInPaise > 0).slice(0, 3);
  const catalog = [...paidCourses, ...packs];

  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <JsonLd data={faqPageJsonLd(FAQS)} />
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "Online Classes", path: "/online-classes" },
        ]}
      />
      <main className="ab-main">
        <section className="ab-hero" aria-labelledby="ol-h1">
          <div className="rh-wrap ab-hero-grid">
            <div className="ab-hero-copy">
              <h1 id="ol-h1">Learn coding, robotics and AI online, your way.</h1>
              <p className="rh-lede">Self-paced video courses and live 1:1 classes with RoboCoders tutors. Start with a free course or a free trial class. No payment needed.</p>
              <div className="rh-actions">
                <Link href={academy("/signup")} className="rh-btn rh-btn--primary">Start free</Link>
                <Link href={academy("/login")} className="rh-btn rh-btn--ghost">Log in</Link>
              </div>
              <dl className="rh-facts">
                <div>
                  <dt>Free</dt>
                  <dd>demo courses and a trial class</dd>
                </div>
                <div>
                  <dt>1:1</dt>
                  <dd>live classes with a tutor</dd>
                </div>
                <div>
                  <dt>6 to 18</dt>
                  <dd>the ages we teach</dd>
                </div>
              </dl>
            </div>
            <OnlineSim />
          </div>
        </section>

        <section className="rh-sec" aria-labelledby="ol-free">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="ol-free">Try it before you pay.</h2>
              <p className="rh-lede">Three free ways to see how RoboCoders teaches.</p>
            </div>
            <OnlineFree
              courses={freeCourses.map((c) => ({ title: c.title, href: academy(`/courses/${c.slug}`) }))}
              trialMinutes={freeTrial?.sessionMinutes ?? undefined}
              hrefs={{
                demo: academy(freeCourses[0] ? `/courses/${freeCourses[0].slug}` : "/courses"),
                trial: academy(freeTrial ? `/checkout/${freeTrial.slug}` : "/tutors"),
                preview: academy("/courses"),
              }}
            />
          </div>
        </section>

        <section className="rh-sec rh-wash" aria-labelledby="ol-how">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="ol-how">How it works.</h2>
              <p className="rh-lede">From sign-up to certificate in four steps.</p>
            </div>
            <OnlineHow />
          </div>
        </section>

        {catalog.length > 0 && (
          <section className="rh-sec" aria-labelledby="ol-cat">
            <div className="rh-wrap">
              <div className="ol-cat-head">
                <div className="rh-head">
                  <h2 id="ol-cat">Courses and live classes.</h2>
                  <p className="rh-lede">Learn at your own pace, or book a tutor.</p>
                </div>
                <Link href={academy("/courses")} className="rh-link">View all courses</Link>
              </div>
              <ul className="ol-cat">
                {catalog.map((p) => (
                  <li key={p.id}>
                    <Link href={academy(`/courses/${p.slug}`)} className="ol-prod">
                      <div className="ol-prod-art">
                        {p.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Academy admin-provided image URL
                          <img src={p.thumbnailUrl} alt="" />
                        ) : p.type === "COURSE" ? (
                          <BookOpen size={36} aria-hidden="true" />
                        ) : (
                          <Video size={36} aria-hidden="true" />
                        )}
                      </div>
                      <div className="ol-prod-body">
                        <span className="ol-prod-kind">{p.type === "COURSE" ? "Self-paced course" : `${p.sessionCount} live 1:1 classes`}</span>
                        <h3>{p.title}</h3>
                        {p.description && <p>{p.description}</p>}
                        <span className="ol-price">{priceLabel(p)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {tutors.length > 0 && (
          <section className="rh-sec rh-wash" aria-labelledby="ol-tutors">
            <div className="rh-wrap">
              <div className="rh-head">
                <h2 id="ol-tutors">Meet the tutors.</h2>
                <p className="rh-lede">Pick a tutor and a time that suits you.</p>
              </div>
              <ul className="ol-tutors">
                {tutors.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <Link href={academy(`/tutors/${t.id}`)} className="ol-tutor">
                      <span className="ol-tutor-av">
                        {t.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- tutor photo URL
                          <img src={t.photoUrl} alt="" />
                        ) : (
                          t.name.charAt(0).toUpperCase()
                        )}
                      </span>
                      <b>{t.name}</b>
                      {t.headline && <span>{t.headline}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="rh-sec" aria-labelledby="ol-faq">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="ol-faq">Questions, answered.</h2>
              <p className="rh-lede">What learners and parents ask about online classes.</p>
            </div>
            <ProductsFaq faqs={FAQS} />
          </div>
        </section>

        <section className="rh-sec rh-dark" aria-labelledby="ol-close">
          <div className="rh-wrap ol-close">
            <h2 id="ol-close">Ready to start learning?</h2>
            <p className="rh-lede">Create your free account and try a demo course today.</p>
            <div className="rh-actions">
              <Link href={academy("/signup")} className="rh-btn rh-btn--primary">Create a free account</Link>
              <Link href={academy("/login")} className="rh-btn rh-btn--ghost">Log in</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
