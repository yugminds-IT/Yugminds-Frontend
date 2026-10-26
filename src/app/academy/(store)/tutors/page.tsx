import Link from "next/link";
import { fetchCatalog } from "@/components/academy/catalog";
import type { Tutor } from "@/lib/academy/api";
import { TutorAvatar } from "@/components/academy/TutorAvatar";

export const revalidate = 300;

export default async function TutorsPage() {
  const tutors = await fetchCatalog<Tutor[]>("/academy/tutors", []);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-acdisplay font-bold">Live 1:1 classes</h1>
      <p className="mt-2 max-w-2xl text-ac-muted">
        Personal classes with RoboCoders tutors — for doubts, school projects, competitions or a full learning plan.
      </p>
      {tutors.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-ac-muted">
          Tutors are being onboarded. Check back soon!
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tutors.map((t) => (
            <Link key={t.id} href={`/academy/tutors/${t.id}`} className="rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-4">
                <TutorAvatar tutor={t} />
                <div>
                  <p className="font-bold">{t.name}</p>
                  {t.headline && <p className="text-sm text-ac-muted">{t.headline}</p>}
                </div>
              </div>
              {t.subjects.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {t.subjects.map((s) => (
                    <span key={s} className="rounded-full bg-ac-soft px-2.5 py-1 text-xs font-medium text-ac-brand">{s}</span>
                  ))}
                </div>
              )}
              <p className="mt-4 text-sm font-semibold text-ac-brand">See open times</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
