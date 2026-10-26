import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Video } from "lucide-react";
import { backendRequest } from "@/lib/backend-client";
import { Price } from "@/components/academy/ProductCard";
import { StepRail } from "@/components/academy/StepRail";
import type { LessonType, ProductDetail } from "@/lib/academy/api";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<ProductDetail | null> {
  try {
    return await backendRequest<ProductDetail>(`/academy/products/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await load((await params).slug);
  if (!product) return {};
  return {
    title: `${product.title} — RoboCoders Academy`,
    description: product.description?.slice(0, 160) ?? undefined,
  };
}

const LESSON_KIND: Record<LessonType, string> = { VIDEO: "Video", PDF: "PDF", TEXT: "Reading", QUIZ: "Quiz", LINK: "Activity" };

export default async function CourseDetailPage({ params }: Props) {
  const product = await load((await params).slug);
  if (!product) notFound();

  const isCourse = product.type === "COURSE";
  const lessons = product.curriculum.reduce((n, ch) => n + ch.lessons.length, 0);
  const minutes = product.curriculum.reduce(
    (n, ch) => n + ch.lessons.reduce((m, c) => m + (c.durationMinutes ?? 0), 0),
    0,
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_360px]">
      <div>
        <Link href="/academy/courses" className="text-sm font-semibold text-ac-brand hover:underline">← All courses</Link>
        <h1 className="mt-3 text-3xl font-acdisplay font-bold sm:text-4xl">{product.title}</h1>
        {product.description && (
          <p className="mt-4 whitespace-pre-line text-lg text-ac-muted">{product.description}</p>
        )}

        {isCourse ? (
          <section className="mt-10">
            <h2 className="text-xl font-acdisplay font-bold">Curriculum</h2>
            <p className="mt-1 text-sm text-ac-muted">
              {product.curriculum.length} modules, {lessons} lessons
              {minutes > 0 && `, about ${Math.round(minutes / 60) || 1} hours`}
            </p>
            <div className="mt-6 space-y-8">
              {product.curriculum.map((ch, i) => {
                const start = product.curriculum.slice(0, i).reduce((n, m) => n + m.lessons.length, 1);
                return (
                  <div key={ch.id}>
                    <h3 className="font-acdisplay text-lg font-semibold text-ac-ink">Module {i + 1}: {ch.title}</h3>
                    <div className="mt-2">
                      <StepRail
                        compact
                        start={start}
                        steps={ch.lessons.map((c, j) => ({
                          id: `${ch.id}-${j}`,
                          title: c.title,
                          state: "todo" as const,
                          meta: [LESSON_KIND[c.type], c.durationMinutes ? `${c.durationMinutes} min` : null, c.isPreview ? "free preview" : null]
                            .filter(Boolean)
                            .join(", "),
                        }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="mt-10 rounded-2xl bg-ac-soft p-6">
            <Video className="h-8 w-8 text-ac-brand" />
            <h2 className="mt-3 text-xl font-acdisplay font-bold">How it works</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ac-muted">
              <li>Buy the pack — you get {product.sessionCount} class credits.</li>
              <li>Pick a tutor and a time that suits you.</li>
              <li>Join the live {product.sessionMinutes}-minute class from your account.</li>
              <li>Cancel 24 hours ahead and the credit comes back.</li>
            </ol>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {product.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-provided URL, may be any host
            <img src={product.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
          )}
          <div className="p-6">
            <Price product={product} large />
            <Link
              href={`/academy/checkout/${product.slug}`}
              className="mt-5 block rounded-lg bg-ac-brand px-6 py-3.5 text-center font-semibold text-white hover:bg-ac-brand-dark"
            >
              {product.priceInPaise === 0
                ? isCourse ? "Enroll free" : "Claim free class"
                : isCourse ? "Buy course" : "Buy class pack"}
            </Link>
            <ul className="mt-5 space-y-2 text-sm text-ac-muted">
              {(isCourse
                ? ["Lifetime access in your account", "Learn on phone, tablet or laptop", "Certificate on completion"]
                : [`${product.sessionCount} live classes, ${product.sessionMinutes} min each`, "Choose your tutor and time", "Free reschedule up to 24h before"]
              ).map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
