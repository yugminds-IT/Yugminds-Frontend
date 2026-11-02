import Link from "next/link";
import { ArrowRight, Award, BadgeCheck } from "lucide-react";
import { fetchCatalog } from "@/components/academy/catalog";
import { ProductRow } from "@/components/academy/ProductCard";
import { TutorAvatar } from "@/components/academy/TutorAvatar";
import LessonOne from "@/components/academy/LessonOne";
import { VerifyForm } from "@/components/academy/VerifyForm";
import ProductsFaq from "@/components/public/ProductsFaq";
import { JsonLd, faqPageJsonLd } from "@/components/seo/JsonLd";
import type { Product, Tutor } from "@/lib/academy/api";

export const revalidate = 300;

const FAQS = [
  { question: "Who are the courses for?", answer: "Learners aged 6 to 18, from first-timers to advanced. Each course page lists the level and what you will build." },
  { question: "What is free?", answer: "Free demo courses, one free 1:1 trial class for each learner, and free preview lessons inside paid courses. No card needed." },
  { question: "How do 1:1 classes work?", answer: "Pick a tutor and a time from their calendar. A joining link appears in your account 10 minutes before the class." },
  { question: "Can I reschedule a 1:1 class?", answer: "Cancel at least 24 hours ahead and the class credit returns to your account, so you can book another time." },
  { question: "How long do I keep a course?", answer: "A course you have bought or claimed stays in your account. Learn at your own pace." },
];

export default async function AcademyHome() {
  const [products, tutors] = await Promise.all([
    fetchCatalog<Product[]>("/academy/products", []),
    fetchCatalog<Tutor[]>("/academy/tutors", []),
  ]);
  // The ladder runs from the lowest barrier up: free course, free trial class, then paid.
  const free = products.filter((p) => p.priceInPaise === 0).sort((a, b) => (a.type === b.type ? 0 : a.type === "COURSE" ? -1 : 1));
  const paid = products.filter((p) => p.priceInPaise > 0).slice(0, 6);
  const from = Math.min(...products.filter((p) => p.type === "SESSION_PACK" && p.priceInPaise > 0).map((p) => p.priceInPaise));

  return (
    <>
      <JsonLd data={faqPageJsonLd(FAQS)} />

      <section className="ac-top ac-hero">
        <div className="rh-wrap">
          <div className="ac-hero-grid">
            <h1>Teach a robot to move. Then build your own.</h1>
            <div className="ac-hero-side">
              <p className="rh-lede">Self-paced coding, robotics and AI courses, plus live 1:1 classes with RoboCoders tutors.</p>
              <div className="rh-actions">
                <Link href="/academy/signup" className="rh-btn rh-btn--primary">Start free</Link>
                <Link href="/academy/courses" className="rh-btn rh-btn--ghost">Browse courses</Link>
              </div>
              <dl className="rh-facts">
                <div><dt>6 to 18</dt><dd>the ages we teach</dd></div>
                <div><dt>Free</dt><dd>demo course and trial class</dd></div>
                <div><dt>Verified</dt><dd>certificate for every course</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="ac-sec" style={{ paddingTop: 0 }} aria-labelledby="ac-lesson-h">
        <div className="rh-wrap">
          <div className="rh-head">
            <h2 id="ac-lesson-h">Try lesson one now</h2>
            <p className="rh-lede">Line up the move cards, press Run, and steer the droid to the star. No account needed.</p>
          </div>
          <LessonOne />
        </div>
      </section>

      <section className="ac-sec rh-wash" aria-labelledby="ac-ways-h">
        <div className="rh-wrap">
          <div className="rh-head">
            <h2 id="ac-ways-h">Learn on your own, or with a tutor</h2>
            <p className="rh-lede">Most learners start with a course and book a class when they get stuck.</p>
          </div>
          <div className="ac-ways">
            <article className="ac-way">
              <h3>Self-paced courses</h3>
              <p>Video lessons, quizzes and projects you can pause and replay.</p>
              <dl>
                <div><dt>Best for</dt><dd>Learning a topic start to finish</dd></div>
                <div><dt>Pace</dt><dd>Yours, on phone, tablet or laptop</dd></div>
                <div><dt>Includes</dt><dd>Free preview lessons and a verifiable certificate</dd></div>
              </dl>
              <Link href="/academy/courses" className="rh-btn rh-btn--primary">Browse courses</Link>
            </article>
            <article className="ac-way ac-way--live">
              <h3>Live 1:1 classes</h3>
              <p>A RoboCoders tutor, just for you, at a time you pick.</p>
              <dl>
                <div><dt>Best for</dt><dd>Doubts, school projects and competitions</dd></div>
                <div><dt>Pace</dt><dd>One class at a time, rescheduled up to 24 hours ahead</dd></div>
                <div><dt>Includes</dt><dd>{Number.isFinite(from) ? `Class packs from ₹${Math.round(from / 100).toLocaleString("en-IN")}` : "A free trial class to begin"}</dd></div>
              </dl>
              <Link href="/academy/tutors" className="rh-btn rh-btn--ghost">Meet the tutors</Link>
            </article>
          </div>
        </div>
      </section>

      {free.length > 0 && (
        <section className="ac-sec" aria-labelledby="ac-free-h">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="ac-free-h">Start free</h2>
              <p className="rh-lede">No card, no payment. Each learner can claim each free offer once.</p>
            </div>
            <div className="ac-list">
              {free.map((p) => <ProductRow key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {paid.length > 0 && (
        <section className="ac-sec rh-wash" aria-labelledby="ac-paid-h">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="ac-paid-h">Courses and class packs</h2>
              <Link href="/academy/courses" className="rh-link">See everything</Link>
            </div>
            <div className="ac-list">
              {paid.map((p) => <ProductRow key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      <section className="ac-sec rh-dark" aria-labelledby="ac-tutors-h">
        <div className={`rh-wrap ac-tutors${tutors.length ? "" : " ac-tutors--solo"}`}>
          <div className="ac-tutors-copy">
            <h2 id="ac-tutors-h">Stuck on a build? Book a tutor.</h2>
            <p className="rh-lede">Live 1:1 classes for doubts, school projects, competitions or a full learning plan. Your first trial class is free.</p>
            <Link href="/academy/tutors" className="rh-btn rh-btn--primary">Meet the tutors</Link>
          </div>
          {tutors.length > 0 && (
            <ul className="ac-tutor-list">
              {tutors.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <Link href={`/academy/tutors/${t.id}`} className="ac-tutor">
                    <TutorAvatar tutor={t} size="3rem" />
                    <span>
                      <b>{t.name}</b>
                      {t.subjects.length > 0 && <small>{t.subjects.slice(0, 3).join(", ")}</small>}
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="ac-sec" id="verify" aria-labelledby="ac-cert-h">
        <div className="rh-wrap ac-cert-sec">
          <div className="ac-cert" role="img" aria-label="A sample certificate of completion for Aarav S.">
            <span className="ac-cert-seal"><Award size={28} aria-hidden="true" /></span>
            <p>Certificate of completion</p>
            <p className="ac-cert-name">Aarav S.</p>
            <p>finished</p>
            <p className="ac-cert-course">Robot basics</p>
            <p className="ac-cert-id">Sample certificate</p>
          </div>
          <div className="ac-verify-copy">
            <h2 id="ac-cert-h">Finish a course. Get a certificate anyone can check.</h2>
            <p className="rh-lede">Every certificate has an ID. Schools and parents can enter it here to confirm it is real.</p>
            <VerifyForm />
            <p className="ac-hint"><BadgeCheck size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: "-0.15em" }} /> The ID is printed on the certificate.</p>
          </div>
        </div>
      </section>

      <section className="ac-sec rh-wash" aria-labelledby="ac-faq-h">
        <div className="rh-wrap">
          <div className="rh-head"><h2 id="ac-faq-h">Questions parents ask</h2></div>
          <ProductsFaq faqs={FAQS} />
        </div>
      </section>

      <section className="ac-sec rh-dark" aria-labelledby="ac-close-h">
        <div className="rh-wrap ac-close">
          <h2 id="ac-close-h">Start with lesson one. It is free.</h2>
          <div className="rh-actions">
            <Link href="/academy/signup" className="rh-btn rh-btn--primary">Create free account</Link>
            <Link href="/academy/courses" className="rh-btn rh-btn--ghost">Browse courses</Link>
          </div>
        </div>
      </section>
    </>
  );
}
