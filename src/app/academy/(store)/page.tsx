import Link from "next/link";
import { fetchCatalog } from "@/components/academy/catalog";
import { ProductCard } from "@/components/academy/ProductCard";
import { StepRail } from "@/components/academy/StepRail";
import { TutorAvatar } from "@/components/academy/TutorAvatar";
import CardBotPlayground from "@/components/public/CardBotPlayground";
import FAQAccordion from "@/components/FAQAccordion";
import type { Product, Tutor } from "@/lib/academy/api";

export const revalidate = 300;

const HOW_IT_WORKS = [
  { id: "account", title: "Create a free account", meta: "One login for courses, classes and certificates.", state: "todo" as const },
  { id: "demo", title: "Take a free demo course", meta: "Short, complete and yours to keep.", state: "todo" as const },
  { id: "trial", title: "Book a free 1:1 trial class", meta: "Pick a tutor and a time that suits you.", state: "todo" as const },
  { id: "course", title: "Choose a course and finish it", meta: "Every completed course earns a verifiable certificate.", state: "todo" as const },
];

const FAQS = [
  { question: "Who are the courses for?", answer: "Learners aged 6–18, from first-timers to advanced. Each course page lists what you'll build and the level." },
  { question: "How do 1:1 classes work?", answer: "Pick a tutor and a time from their calendar. A join link appears in your account 10 minutes before the class." },
  { question: "Can I reschedule a 1:1 class?", answer: "Cancel at least 24 hours ahead and the class credit returns to your account, so you can book another time." },
  { question: "How long do I keep a course?", answer: "A course you've bought or claimed stays in your account. Learn at your own pace." },
];

export default async function AcademyHome() {
  const [products, tutors] = await Promise.all([
    fetchCatalog<Product[]>("/academy/products", []),
    fetchCatalog<Tutor[]>("/academy/tutors", []),
  ]);
  const free = products.filter((p) => p.priceInPaise === 0);
  const paid = products.filter((p) => p.priceInPaise > 0).slice(0, 6);

  return (
    <>
      {/* Hero: the first lesson, playable. */}
      <section className="ac-graph border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:pt-16">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <h1 className="font-acdisplay text-4xl font-bold leading-[1.05] tracking-tight text-ac-ink sm:text-6xl">
              Teach a robot to move. Then build your own.
            </h1>
            <div className="lg:pb-2">
              <p className="max-w-md text-lg leading-relaxed text-slate-600">
                Self-paced coding, robotics and AI courses, plus live 1:1 classes with RoboCoders tutors. For ages 6–18.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/academy/signup" className="rounded-lg bg-ac-brand px-6 py-3 font-semibold text-white outline-none hover:bg-ac-brand-dark focus-visible:ring-2 focus-visible:ring-ac-brand/40 focus-visible:ring-offset-2">
                  Start free
                </Link>
                <Link href="/academy/courses" className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-ac-ink outline-none hover:border-ac-brand hover:text-ac-brand focus-visible:ring-2 focus-visible:ring-ac-brand/40">
                  Browse courses
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <p className="mb-3 text-sm text-slate-600">
              This is lesson one. Line up the move cards, press Run, and steer the robot to the star.
            </p>
            <CardBotPlayground />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-acdisplay text-3xl font-bold text-ac-ink">How it works</h2>
          <p className="mt-3 max-w-sm text-slate-600">Start without paying anything. Upgrade when your learner is hooked.</p>
        </div>
        <StepRail steps={HOW_IT_WORKS} />
      </section>

      {free.length > 0 && (
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="font-acdisplay text-3xl font-bold text-ac-ink">Free to start</h2>
            <p className="mt-2 text-slate-600">No card, no payment. Each learner can claim each free offer once.</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {free.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {paid.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-acdisplay text-3xl font-bold text-ac-ink">Courses and class packs</h2>
            <Link href="/academy/courses" className="font-semibold text-ac-brand hover:underline">See all courses</Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paid.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section className="ac-graph-blue text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <h2 className="font-acdisplay text-3xl font-bold">Stuck on a build? Book a tutor.</h2>
            <p className="mt-3 max-w-xl text-blue-100">
              Live 1:1 classes for doubts, school projects, competitions or a full learning plan. Your first trial class is free.
            </p>
            <Link href="/academy/tutors" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-ac-brand outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-white">
              Meet the tutors
            </Link>
          </div>
          {tutors.length > 0 && (
            <ul className="flex flex-wrap gap-4 md:justify-end">
              {tutors.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl bg-white/10 py-2 pl-2 pr-4">
                  <TutorAvatar tutor={t} size="h-11 w-11" />
                  <span className="leading-tight">
                    <span className="block font-semibold">{t.name}</span>
                    {t.subjects[0] && <span className="block text-sm text-blue-100">{t.subjects.slice(0, 2).join(", ")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="font-acdisplay text-3xl font-bold text-ac-ink">Questions parents ask</h2>
        <div className="mt-6">
          <FAQAccordion faqs={FAQS} />
        </div>
      </section>
    </>
  );
}
