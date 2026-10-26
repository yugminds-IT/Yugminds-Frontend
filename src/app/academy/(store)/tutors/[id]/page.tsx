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
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_400px]">
      <div>
        <Link href="/academy/tutors" className="text-sm font-semibold text-ac-brand hover:underline">← All tutors</Link>
        <div className="mt-4 flex items-center gap-5">
          <TutorAvatar tutor={tutor} size="h-20 w-20" />
          <div>
            <h1 className="text-3xl font-acdisplay font-bold">{tutor.name}</h1>
            {tutor.headline && <p className="mt-1 text-ac-muted">{tutor.headline}</p>}
          </div>
        </div>
        {tutor.subjects.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tutor.subjects.map((s) => (
              <span key={s} className="rounded-full bg-ac-soft px-3 py-1 text-sm font-medium text-ac-brand">{s}</span>
            ))}
          </div>
        )}
        {tutor.bio && <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-700">{tutor.bio}</p>}
      </div>
      <aside className="rounded-2xl border border-slate-200 p-6 lg:sticky lg:top-24 lg:self-start">
        <h2 className="mb-4 text-lg font-acdisplay font-bold">Book a class</h2>
        <TutorBooking tutorId={tutor.id} />
      </aside>
    </div>
  );
}
