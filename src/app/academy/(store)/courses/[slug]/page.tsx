import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronDown, FileText, HelpCircle, Link2, PlayCircle, Type, type LucideIcon } from "lucide-react";
import { backendRequest } from "@/lib/backend-client";
import { Price } from "@/components/academy/ProductCard";
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

const LESSON: Record<LessonType, { label: string; Icon: LucideIcon }> = {
  VIDEO: { label: "Video", Icon: PlayCircle },
  PDF: { label: "PDF", Icon: FileText },
  TEXT: { label: "Reading", Icon: Type },
  QUIZ: { label: "Quiz", Icon: HelpCircle },
  LINK: { label: "Activity", Icon: Link2 },
};

export default async function CourseDetailPage({ params }: Props) {
  const product = await load((await params).slug);
  if (!product) notFound();

  const isCourse = product.type === "COURSE";
  const lessons = product.curriculum.reduce((n, ch) => n + ch.lessons.length, 0);
  const minutes = product.curriculum.reduce((n, ch) => n + ch.lessons.reduce((m, c) => m + (c.durationMinutes ?? 0), 0), 0);
  const cta = product.priceInPaise === 0 ? (isCourse ? "Enroll free" : "Claim free class") : isCourse ? "Buy course" : "Buy class pack";

  return (
    <section className="ac-top ac-page">
      <div className="rh-wrap ac-detail">
        <div className="ac-detail-main">
          <Link href="/academy/courses" className="ac-back">← All courses</Link>
          <h1>{product.title}</h1>
          {product.description && <p className="rh-lede ac-desc">{product.description}</p>}

          {isCourse ? (
            <section className="ac-curr" aria-labelledby="ac-curr-h">
              <div className="rh-head" style={{ marginBottom: "1.25rem" }}>
                <h2 id="ac-curr-h">What is in the course</h2>
                <p className="ac-hint">
                  {product.curriculum.length} modules, {lessons} lessons{minutes > 0 && `, about ${Math.round(minutes / 60) || 1} hours`}
                </p>
              </div>
              <div className="ac-mods">
                {product.curriculum.map((ch, i) => (
                  <details key={ch.id} className="ac-mod" open={i === 0}>
                    <summary>
                      <span className="ac-mod-n">{i + 1}</span>
                      <span><b>{ch.title}</b> <small>{ch.lessons.length} lessons</small></span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <ul className="ac-lessons">
                      {ch.lessons.map((l, j) => {
                        const { label, Icon } = LESSON[l.type];
                        return (
                          <li key={j}>
                            <Icon size={16} aria-hidden="true" />
                            <span>{l.title}</span>
                            <small>
                              {l.isPreview && <span className="ac-free" style={{ marginRight: "0.5rem" }}>Free preview</span>}
                              {[label, l.durationMinutes ? `${l.durationMinutes} min` : null].filter(Boolean).join(", ")}
                            </small>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          ) : (
            <section aria-labelledby="ac-how-h">
              <h2 id="ac-how-h" style={{ fontSize: "var(--rh-t-h3)", marginBottom: "1.25rem" }}>How it works</h2>
              <ol className="ac-order">
                <li>Buy the pack and get {product.sessionCount} class credits.</li>
                <li>Pick a tutor and a time that suits you.</li>
                <li>Join the live {product.sessionMinutes}-minute class from your account.</li>
                <li>Cancel 24 hours ahead and the credit comes back.</li>
              </ol>
            </section>
          )}
        </div>

        <aside className="ac-buy" aria-label="Buy">
          {product.thumbnailUrl && (
            <span className="ac-art ac-art--lg">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-provided URL, may be any host */}
              <img src={product.thumbnailUrl} alt="" />
            </span>
          )}
          <div className="ac-buy-body">
            <Price product={product} large />
            <Link href={`/academy/checkout/${product.slug}`} className="rh-btn rh-btn--primary">{cta}</Link>
            <ul className="ac-checks">
              {(isCourse
                ? ["Lifetime access in your account", "Learn on phone, tablet or laptop", "Certificate when you finish"]
                : [`${product.sessionCount} live classes, ${product.sessionMinutes} minutes each`, "Choose your tutor and time", "Free reschedule up to 24 hours before"]
              ).map((t) => (
                <li key={t}><Check size={16} aria-hidden="true" /><span>{t}</span></li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
