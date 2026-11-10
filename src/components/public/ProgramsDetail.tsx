import Link from "next/link";
import { brandHref } from "@/lib/brand-host";
import { TRACK_DATA } from "./programs-data";

/* The three tracks as plain, readable text: what each one teaches, in order. The tabs above show one track at a time,
   so this puts every track's content in the page text. */
export default function ProgramsDetail() {
  return (
    <section className="rh-sec rh-wash" aria-labelledby="pg-detail">
      <div className="rh-wrap">
        <div className="rh-head">
          <h2 id="pg-detail">What each track teaches.</h2>
        </div>
        <div className="pg-detail">
          {TRACK_DATA.map((t) => (
            <article key={t.id} className="pg-detail-item">
              <h3>{t.heading}</h3>
              <p>{t.answer}</p>
              <ul>
                {t.topics.map(([topic, make]) => (
                  <li key={topic}><b>{topic}.</b> You make: {make.charAt(0).toLowerCase() + make.slice(1)}.</li>
                ))}
              </ul>
              <Link href={brandHref("/robocoders/online-classes")} className="rh-btn rh-btn--ghost">Book a trial class</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
