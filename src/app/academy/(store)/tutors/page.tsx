import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchCatalog } from "@/components/academy/catalog";
import { TutorAvatar } from "@/components/academy/TutorAvatar";
import type { Tutor } from "@/lib/academy/api";

export const revalidate = 300;

export default async function TutorsPage() {
  const tutors = await fetchCatalog<Tutor[]>("/academy/tutors", []);
  return (
    <section className="ac-top ac-page" aria-labelledby="ac-tutors-h">
      <div className="rh-wrap">
        <div className="ac-pagehead">
          <h1 id="ac-tutors-h" style={{ fontSize: "var(--rh-t-h2)", maxWidth: "16ch" }}>Live 1:1 classes</h1>
          <p className="rh-lede">Personal classes with RoboCoders tutors, for doubts, school projects, competitions or a full learning plan. Your first trial class is free.</p>
        </div>
        {tutors.length === 0 ? (
          <div className="ac-empty">
            <b>Tutors are being onboarded</b>
            <p>Start with a free course while you wait.</p>
            <Link href="/academy/courses" className="rh-btn rh-btn--primary">Browse courses</Link>
          </div>
        ) : (
          <ul className="ac-list">
            {tutors.map((t) => (
              <li key={t.id}>
                <Link href={`/academy/tutors/${t.id}`} className="ac-row">
                  <TutorAvatar tutor={t} size="4.25rem" />
                  <span>
                    <span className="ac-row-title">{t.name}</span>
                    {t.headline && <span className="ac-row-meta" style={{ display: "block" }}>{t.headline}</span>}
                    {t.subjects.length > 0 && (
                      <span className="ac-subjects">
                        {t.subjects.map((s) => <span key={s} className="rh-tag">{s}</span>)}
                      </span>
                    )}
                  </span>
                  <span className="ac-row-end"><ArrowRight size={18} aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
