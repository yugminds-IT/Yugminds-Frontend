import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend-client";
import { TutorBooking } from "@/components/academy/TutorBooking";
import type { Tutor } from "@/lib/academy/api";
import { TutorAvatar } from "@/components/academy/TutorAvatar";

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

async function load(id: string): Promise<Tutor | null> {
  try {
    return await backendRequest<Tutor>(`/academy/tutors/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tutor = await load((await params).id);
  return tutor ? { title: `${tutor.name} — 1:1 classes | RoboCoders Academy`, description: tutor.headline ?? undefined } : {};
}

export default async function TutorPage({ params }: Props) {
  const { id } = await params;
  const tutor = await load(id);
  if (!tutor) notFound();

  return (
    <section className="ac-top ac-page">
      <div className="rh-wrap ac-detail">
        <div className="ac-detail-main">
          <Link href="/academy/tutors" className="ac-back">← All tutors</Link>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <TutorAvatar tutor={tutor} size="5.5rem" />
            <div>
              <h1 style={{ fontSize: "var(--rh-t-h2)" }}>{tutor.name}</h1>
              {tutor.headline && <p className="rh-lede" style={{ marginTop: "0.4rem" }}>{tutor.headline}</p>}
            </div>
          </div>
          {tutor.subjects.length > 0 && (
            <div className="ac-subjects" style={{ marginTop: 0 }}>
              {tutor.subjects.map((s) => <span key={s} className="rh-tag">{s}</span>)}
            </div>
          )}
          {tutor.bio && <p className="ac-bio" style={{ maxWidth: "var(--rh-measure)", lineHeight: "var(--rh-lh-body)" }}>{tutor.bio}</p>}
        </div>
        <aside className="ac-buy" aria-labelledby="ac-book-h">
          <div className="ac-buy-body">
            <h2 id="ac-book-h" style={{ fontSize: "var(--rh-t-h3)" }}>Book a class</h2>
            <TutorBooking tutorId={tutor.id} />
          </div>
        </aside>
      </div>
    </section>
  );
}
