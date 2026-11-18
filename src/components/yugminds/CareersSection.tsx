"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Clock, Users } from "lucide-react";
import { commonApi } from "@/lib/api/common.api";
import { Detail, STEPS, count, focus, jobPosting, pay, seats, type Opening } from "./JobDetail";

export default function CareersSection() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [team, setTeam] = useState("All");
  const [sel, setSel] = useState("");

  useEffect(() => {
    commonApi.careers
      .openings()
      .then((r: { data?: { openings?: Opening[] } }) => {
        const list = r.data?.openings;
        if (Array.isArray(list)) {
          setOpenings(list);
          setSel((s) => (list.some((o) => o.slug === s) ? s : (list[0]?.slug ?? "")));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const teams = useMemo(() => ["All", ...Array.from(new Set(openings.map((o) => o.team)))], [openings]);
  const shown = openings.filter((o) => team === "All" || o.team === team);
  const current = shown.find((o) => o.slug === sel) ?? shown[0];

  return (
    <section id="careers" aria-labelledby="careers-title" className="scroll-mt-16 border-t border-slate-200">
      {openings.map((o) => (
        <script key={o.slug} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPosting(o)).replace(/</g, "\\u003c") }} />
      ))}
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-28">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 id="careers-title" className="font-acdisplay text-4xl font-bold leading-[1.05] tracking-tight text-ym-text md:text-6xl">
              Work with us.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              We build robots, software and the people who teach with them. Pick a role to see what it involves, then
              apply in about five minutes.
            </p>
          </div>
          <p className="text-sm font-semibold text-ym-blue" aria-live="polite">
            {(() => {
              const n = openings.reduce((a, o) => a + count(o), 0);
              if (!loaded) return "";
              return `${openings.length} open ${openings.length === 1 ? "role" : "roles"}${n !== openings.length ? ` · ${n} positions` : ""}`;
            })()}
          </p>
        </div>

        {teams.length > 2 && (
          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter roles by team">
            {teams.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={team === t}
                onClick={() => setTeam(t)}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${focus} ${
                  team === t ? "border-ym-blue bg-ym-blue text-white" : "border-slate-300 text-slate-700 hover:border-ym-blue"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {!loaded ? (
          <div className="mt-10 h-64 animate-pulse rounded-xl bg-slate-100" aria-hidden />
        ) : shown.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <p className="font-acdisplay text-2xl font-bold text-ym-text">No open roles right now.</p>
            <p className="mt-2 text-slate-600">Send us a note and we will reach out when something opens.</p>
            <Link href="/#contact" className={`mt-5 inline-flex min-h-11 items-center rounded-md bg-ym-blue px-5 font-semibold text-white hover:bg-ym-blue-lit ${focus}`}>
              Contact us
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
              {shown.map((o) => {
                const on = current?.slug === o.slug;
                return (
                  <li key={o.slug}>
                    <button
                      type="button"
                      aria-expanded={on}
                      aria-controls={`role-${o.slug}`}
                      onClick={() => setSel(o.slug)}
                      className={`relative block w-full px-5 py-5 text-left transition-colors ${focus} ${on ? "bg-slate-50" : "hover:bg-slate-50"}`}
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 bg-ym-blue transition-opacity ${on ? "opacity-100" : "opacity-0"}`} aria-hidden />
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-acdisplay text-xl font-bold text-ym-text">{o.title}</span>
                        <ArrowRight className={`mt-1.5 size-4 shrink-0 text-ym-blue transition-transform lg:rotate-0 ${on ? "rotate-90" : ""}`} aria-hidden />
                      </span>
                      <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" aria-hidden />{o.team}</span>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden />{o.location}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden />{o.jobType}</span>
                        <span>{seats(o)}</span>
                      </span>
                      {pay(o) && <span className="mt-2 block text-sm font-semibold text-ym-text">{pay(o)}</span>}
                    </button>
                    {/* Phones: the detail opens under its row. Desktop uses the panel on the right. */}
                    {on && (
                      <div id={`role-${o.slug}`} className="border-t border-slate-200 bg-white lg:hidden">
                        <Detail o={o} />
                      </div>
                    )}
                  </li>
                );
              })}
              <li className="bg-slate-50 px-5 py-4 text-sm text-slate-600">
                Do not see your role?{" "}
                <Link href="/#contact" className={`font-semibold text-ym-blue underline ${focus}`}>Tell us what you do.</Link>
              </li>
            </ul>
            {current && (
              <div className="hidden rounded-xl border border-slate-200 bg-white lg:sticky lg:top-24 lg:block">
                <Detail o={current} />
              </div>
            )}
          </div>
        )}

        <p className="mt-10 text-slate-600">
          Already applied?{" "}
          <Link href="/careers/status" className={`font-semibold text-ym-blue underline ${focus}`}>Check your application status.</Link>
        </p>
        <h3 className="font-acdisplay mt-10 text-2xl font-bold text-ym-text">How hiring works</h3>
        <ol className="mt-6 grid gap-6 md:grid-cols-5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="border-t-2 border-ym-blue pt-3">
              <span className="text-sm font-semibold text-ym-blue">Step {i + 1}</span>
              <p className="mt-1 font-semibold text-ym-text">{t}</p>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
