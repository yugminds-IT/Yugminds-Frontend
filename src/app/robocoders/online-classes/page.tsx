import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck,
  Check,
  Eye,
  Gift,
  LogIn,
  PlayCircle,
  UserPlus,
  Video,
} from "lucide-react";
import { brandHref } from "@/lib/brand-host";
import { formatINR, type Product, type Tutor } from "@/lib/academy/api";
import { fetchCatalog } from "@/components/academy/catalog";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import Footer from "../../../components/Footer";
import FAQAccordion from "../../../components/FAQAccordion";
import { Reveal, RevealX, HoverLift } from "../../../components/public/robo-motion";
import { JsonLd, RoboBreadcrumbs, faqPageJsonLd } from "../../../components/seo/JsonLd";

// Live catalog from RoboCoders Academy, refreshed every 5 minutes.
export const revalidate = 300;

// The Academy is its own app (academy.yugminds.org); brandHref gives the canonical
// link in production and the local /academy path in development.
const academy = (path = "") => brandHref(`/academy${path}`);

const STEPS = [
  { icon: UserPlus, title: "Create a free account", text: "Sign up in a minute — one account for courses, live classes and certificates." },
  { icon: Gift, title: "Start with something free", text: "Take a free demo course or claim your free 1:1 trial class with a tutor." },
  { icon: BookOpen, title: "Learn your way", text: "Self-paced video courses with quizzes, or live 1:1 classes at times that suit you." },
  { icon: Award, title: "Earn certificates", text: "Finish a course to get a verifiable RoboCoders certificate." },
];

const FAQS = [
  { question: "Is this the same as RoboCoders classes in my school?", answer: "No — RoboCoders Online Classes are for learners anywhere, outside school. It has its own account and login, separate from the school Student Portal." },
  { question: "What is free?", answer: "Free demo courses, one free 1:1 trial class per learner, and free preview lessons inside paid courses. No card or payment needed." },
  { question: "How do live 1:1 classes work?", answer: "Pick a tutor and a time from their calendar. A joining link appears in your account 10 minutes before the class. Cancel 24 hours ahead and your class credit comes back." },
  { question: "What age is it for?", answer: "Learners aged 6–18, from complete beginners to advanced. Each course page lists its level." },
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

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={faqPageJsonLd(FAQS)} />
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "Online Classes", path: "/online-classes" },
        ]}
      />

      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-24 lg:pt-20">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/robotics-coding-doodle-bg.png')", opacity: 0.1 }}
          role="presentation"
          aria-hidden="true"
        />
        <div className="relative z-10 w-full">
          <div className="flex flex-col items-center gap-0 lg:flex-row">
            <div className="flex w-full flex-1 flex-col justify-center py-12 pl-8 pr-4 text-center md:py-16 md:pl-16 md:pr-8 lg:pl-24 lg:pr-12 lg:text-left xl:pl-32 xl:pr-16">
              <RevealX x={-48} className="relative z-10 mx-auto max-w-2xl lg:mx-0 lg:max-w-4xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-blue-700">
                  <Video className="h-4 w-4" /> RoboCoders Online Classes
                </span>
                <h1 className="mt-6 text-4xl font-extrabold leading-tight md:text-5xl xl:text-6xl">
                  Learn <span className="text-blue-600">Coding, Robotics &amp; AI</span> Online — Your Way
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-700 md:text-xl lg:mx-0">
                  Self-paced video courses and live 1:1 classes with RoboCoders tutors. Start with a free demo course or a
                  free trial class — no payment needed.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                  <Link href={academy("/signup")} className="w-full sm:w-auto">
                    <Button size="lg" className="group w-full rounded-full bg-blue-600 px-8 text-lg text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 sm:w-auto">
                      Start Free <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                  <Link href={academy("/login")} className="w-full sm:w-auto">
                    <Button variant="outline" size="lg" className="w-full rounded-full border-blue-600 px-8 text-lg text-blue-600 hover:bg-blue-50 sm:w-auto">
                      <LogIn className="mr-2 h-5 w-5" /> Log In
                    </Button>
                  </Link>
                </div>
                <ul className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-600 lg:mx-0 lg:justify-start">
                  {["Free demo courses", "Free 1:1 trial class", "Certificates included"].map((t) => (
                    <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-blue-600" /> {t}</li>
                  ))}
                </ul>
              </RevealX>
            </div>
            <RevealX x={48} className="relative h-[300px] w-full overflow-hidden rounded-none bg-white shadow-2xl sm:h-[400px] md:h-[450px] lg:h-[calc(100vh-8rem)] lg:max-h-[820px] lg:min-h-[480px] lg:w-[45%] lg:rounded-l-[61px] xl:w-[50%]">
              <Image
                src="/Kids Dong Robotics.png"
                alt="Kids learning robotics online with RoboCoders"
                fill
                sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 45vw, 50vw"
                className="object-cover"
                priority
              />
              <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-[10px] bg-blue-600 lg:w-[20px] lg:rounded-l-[61px]" />
            </RevealX>
          </div>
        </div>
      </section>

      {/* Free to start */}
      <section className="bg-blue-600 py-14 text-white md:py-20">
        <div className="container">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold md:text-4xl lg:text-5xl">Start Free</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-blue-100 md:text-lg">
              Try RoboCoders before you pay anything.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <HoverLift>
              <Card className="h-full rounded-3xl border-2 border-blue-200 bg-white text-gray-900">
                <CardContent className="flex h-full flex-col p-6">
                  <PlayCircle className="h-10 w-10 text-blue-600" />
                  <h3 className="mt-4 text-xl font-bold">Free demo courses</h3>
                  {freeCourses.length > 0 ? (
                    <ul className="mt-3 flex-1 space-y-2 text-sm">
                      {freeCourses.slice(0, 4).map((c) => (
                        <li key={c.id}>
                          <Link href={academy(`/courses/${c.slug}`)} className="flex items-center gap-2 font-medium text-blue-700 hover:underline">
                            <ArrowRight className="h-4 w-4 shrink-0" /> {c.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 flex-1 text-sm text-gray-700">Complete beginner courses, free forever — new ones are added regularly.</p>
                  )}
                  <Link href={academy(freeCourses[0] ? `/courses/${freeCourses[0].slug}` : "/courses")} className="mt-5">
                    <Button className="w-full rounded-full bg-blue-600 text-white hover:bg-blue-700">Start a free course</Button>
                  </Link>
                </CardContent>
              </Card>
            </HoverLift>
            <HoverLift delay={0.1}>
              <Card className="h-full rounded-3xl border-2 border-amber-300 bg-white text-gray-900">
                <CardContent className="flex h-full flex-col p-6">
                  <CalendarCheck className="h-10 w-10 text-amber-500" />
                  <h3 className="mt-4 text-xl font-bold">Free 1:1 trial class</h3>
                  <p className="mt-2 flex-1 text-sm text-gray-700">
                    {freeTrial
                      ? `A ${freeTrial.sessionMinutes}-minute live class with a RoboCoders tutor — one per learner. Pick any tutor and time.`
                      : "A free live class with a RoboCoders tutor — one per learner. Pick any tutor and time."}
                  </p>
                  <Link href={academy(freeTrial ? `/checkout/${freeTrial.slug}` : "/tutors")} className="mt-5">
                    <Button className="w-full rounded-full bg-amber-500 text-white hover:bg-amber-600">Claim free class</Button>
                  </Link>
                </CardContent>
              </Card>
            </HoverLift>
            <HoverLift delay={0.2}>
              <Card className="h-full rounded-3xl border-2 border-blue-200 bg-white text-gray-900">
                <CardContent className="flex h-full flex-col p-6">
                  <Eye className="h-10 w-10 text-blue-600" />
                  <h3 className="mt-4 text-xl font-bold">Free preview lessons</h3>
                  <p className="mt-2 flex-1 text-sm text-gray-700">
                    Every paid course has free preview lessons, so you can see the teaching style before you buy.
                  </p>
                  <Link href={academy("/courses")} className="mt-5">
                    <Button variant="outline" className="w-full rounded-full border-blue-600 text-blue-600 hover:bg-blue-50">Browse courses</Button>
                  </Link>
                </CardContent>
              </Card>
            </HoverLift>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 md:py-20">
        <div className="container">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold md:text-4xl">How It Works</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <HoverLift key={title} delay={i * 0.08}>
                <div className="h-full rounded-3xl border border-gray-200 p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{i + 1}</span>
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm text-gray-600">{text}</p>
                </div>
              </HoverLift>
            ))}
          </div>
        </div>
      </section>

      {/* Courses & class packs */}
      {(paidCourses.length > 0 || packs.length > 0) && (
        <section className="bg-gray-50 py-14 md:py-20">
          <div className="container">
            <Reveal>
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <h2 className="text-3xl font-extrabold md:text-4xl">Courses &amp; Live Classes</h2>
                <Link href={academy("/courses")} className="font-semibold text-blue-600 hover:underline">View all →</Link>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...paidCourses, ...packs].map((p, i) => (
                <HoverLift key={p.id} delay={i * 0.05}>
                  <Link href={academy(`/courses/${p.slug}`)} className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white">
                    <div className="relative flex aspect-video items-center justify-center bg-blue-50">
                      {p.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Academy admin-provided image URL
                        <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : p.type === "COURSE" ? (
                        <BookOpen className="h-10 w-10 text-blue-600" />
                      ) : (
                        <Video className="h-10 w-10 text-blue-600" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        {p.type === "COURSE" ? "Self-paced course" : `${p.sessionCount} live 1:1 classes`}
                      </p>
                      <h3 className="mt-1 font-bold">{p.title}</h3>
                      {p.description && <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{p.description}</p>}
                      <p className="mt-auto pt-4 text-lg font-extrabold">{priceLabel(p)}</p>
                    </div>
                  </Link>
                </HoverLift>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tutors */}
      {tutors.length > 0 && (
        <section className="py-14 md:py-20">
          <div className="container">
            <Reveal>
              <h2 className="text-center text-3xl font-extrabold md:text-4xl">Meet the Tutors</h2>
            </Reveal>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {tutors.slice(0, 4).map((t) => (
                <Link key={t.id} href={academy(`/tutors/${t.id}`)} className="rounded-3xl border border-gray-200 p-6 text-center transition hover:-translate-y-0.5 hover:shadow-md">
                  {t.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tutor photo URL
                    <img src={t.photoUrl} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-3 font-bold">{t.name}</p>
                  {t.headline && <p className="text-sm text-gray-600">{t.headline}</p>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold md:text-4xl">Frequently Asked Questions</h2>
          </Reveal>
          <div className="mt-8">
            <FAQAccordion faqs={FAQS} />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-blue-600 py-14 text-center text-white md:py-16">
        <Reveal>
          <h2 className="text-3xl font-extrabold md:text-4xl">Ready to start learning?</h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-100">Create your free account and try a demo course today.</p>
          <div className="mt-8 flex flex-col justify-center gap-4 px-4 sm:flex-row">
            <Link href={academy("/signup")}>
              <Button size="lg" className="w-full rounded-full bg-white px-8 text-lg text-blue-700 hover:bg-blue-50 sm:w-auto">Create Free Account</Button>
            </Link>
            <Link href={academy("/login")}>
              <Button size="lg" variant="outline" className="w-full rounded-full border-white bg-transparent px-8 text-lg text-white hover:bg-white/10 sm:w-auto">Log In</Button>
            </Link>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
