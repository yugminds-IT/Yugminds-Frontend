import Link from "next/link";
import { ArrowRight, Clock, GraduationCap, MapPin, Users } from "lucide-react";
import ShareRole from "./ShareRole";
import { STEPS, focus, inr, posted, seats, type Opening } from "./JobDetail";

type Full = Opening & { status: string };

const applyCls = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ym-blue px-6 font-semibold text-white transition-colors hover:bg-ym-blue-lit ${focus}`;

function Bullets({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h2 className="font-acdisplay text-xl font-bold text-ym-text">{title}</h2>
      <ul className="mt-4 space-y-3 text-slate-700">
        {items.map((t) => (
          <li key={t} className="flex gap-3 leading-relaxed">
            <span className="mt-3 h-px w-4 shrink-0 bg-ym-blue" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-ym-text">
      <Icon className="size-4 shrink-0 text-ym-blue" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/** The hiring path drawn as a trace: filled node = where the reader is now. */
function Path() {
  return (
    <section aria-labelledby="path-title" className="mt-14 border-t border-slate-200 pt-10">
      <h2 id="path-title" className="font-acdisplay text-2xl font-bold text-ym-text">What happens after you apply</h2>
      <ol className="mt-8 grid gap-8 md:grid-cols-5 md:gap-6">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="relative pl-12 md:pl-0 md:pt-12">
            <span
              aria-hidden
              className={`absolute left-0 top-0 grid size-8 place-items-center rounded-full border-2 border-ym-blue text-sm font-bold ${i === 0 ? "bg-ym-blue text-white" : "bg-white text-ym-blue"}`}
            >
              {i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute left-4 top-9 -bottom-8 w-px bg-ym-blue/30 md:-bottom-auto md:left-9 md:right-[-1.5rem] md:top-4 md:h-px md:w-auto" />
            )}
            <p className="font-semibold text-ym-text">{t}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function JobPage({ o }: { o: Full }) {
  const live = o.status === "open";
  const lo = o.payMin && o.payMax ? `${inr(o.payMin)} – ${inr(o.payMax)}` : o.payMax ? `Up to ${inr(o.payMax)}` : null;
  const note = o.status === "paused"
    ? "Applications are paused for this role right now. Please check back soon."
    : "This role is closed and no longer accepts applications.";

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 pt-24 md:px-10 md:pt-28 lg:pb-20">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
        <Link href="/#careers" className={`font-semibold text-ym-blue underline ${focus}`}>Careers</Link>
        <span aria-hidden> › </span>
        <span>{o.title}</span>
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <article>
          <h1 className="font-acdisplay text-4xl font-bold leading-[1.05] tracking-tight text-ym-text md:text-6xl">{o.title}</h1>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-slate-700">
            <Fact icon={MapPin}>{o.location}</Fact>
            <Fact icon={GraduationCap}>{o.team}</Fact>
            <Fact icon={Clock}>{o.jobType}</Fact>
          </ul>
          {posted(o.createdAt) && <p className="mt-3 text-sm text-slate-500">{posted(o.createdAt)}</p>}

          <p className="mt-10 max-w-[62ch] text-lg leading-relaxed text-slate-800">{o.description}</p>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <Bullets title="What you will teach" items={o.details?.teach} />
            <Bullets title="Who we are looking for" items={o.details?.seeking} />
          </div>

          <Path />
        </article>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Apply for this role">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {lo && (
              <>
                <p className="font-acdisplay text-3xl font-bold leading-tight text-ym-text">{lo}</p>
                <p className="mt-1 text-sm text-slate-500">a month</p>
              </>
            )}
            <ul className={`space-y-3 text-sm ${lo ? "mt-5 border-t border-slate-100 pt-5" : ""}`}>
              <Fact icon={Users}>{seats(o)} open</Fact>
              <Fact icon={Clock}>{o.jobType}</Fact>
              <Fact icon={MapPin}>{o.location}</Fact>
            </ul>
            <div className="mt-6">
              {live ? (
                <>
                  <Link href={`/careers/${o.slug}/apply`} className={applyCls}>
                    Apply for this role <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <p className="mt-3 text-center text-sm text-slate-500">About 5 minutes. Keep your resume (PDF or Word) ready.</p>
                </>
              ) : (
                <p className="rounded-md bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{note}</p>
              )}
            </div>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <ShareRole title={o.title} />
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-600">
            <Link href="/#careers" className={`font-semibold text-ym-blue underline ${focus}`}>See all open roles</Link>
            <br />
            Already applied?{" "}
            <Link href="/careers/status" className={`font-semibold text-ym-blue underline ${focus}`}>Check your status.</Link>
          </p>
        </aside>
      </div>

      {live && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 p-3 pr-24 backdrop-blur lg:hidden">
          <p className="min-w-0 truncate font-acdisplay text-lg font-bold text-ym-text">{lo ?? o.title}</p>
          <Link href={`/careers/${o.slug}/apply`} className={`${applyCls} !w-auto shrink-0 !min-h-11`}>Apply</Link>
        </div>
      )}
    </div>
  );
}
