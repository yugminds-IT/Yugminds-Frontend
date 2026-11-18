import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type Opening = {
  slug: string;
  title: string;
  team: string;
  positions: number;
  location: string;
  jobType: string;
  payMin: number | null;
  payMax: number | null;
  description: string;
  createdAt?: string;
  details?: { teach?: string[]; seeking?: string[] } | null;
};

export const STEPS = [
  ["Apply online", "About five minutes. Attach your resume."],
  ["Screening call", "A short phone chat with our team."],
  ["Interview", "Talk about teaching, kids and technology."],
  ["Demo class", "Teach us a ten-minute topic. We help you prepare."],
  ["Offer and training", "Paid training on our curriculum and Robocoders kits."],
];

export const focus =
  "outline-none focus-visible:ring-2 focus-visible:ring-ym-blue focus-visible:ring-offset-2";
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const pay = (o: Opening) =>
  o.payMin && o.payMax ? `${inr(o.payMin)} – ${inr(o.payMax)} a month` : o.payMax ? `Up to ${inr(o.payMax)} a month` : null;

const DAY = 86_400_000;
const EMPLOYMENT = (t: string) =>
  /part/i.test(t) ? "PART_TIME" : /contract/i.test(t) ? "CONTRACTOR" : /intern/i.test(t) ? "INTERN" : "FULL_TIME";

/** "Posted today / yesterday / 5 days ago / 3 weeks ago". Empty if the date is missing. */
export function posted(iso?: string) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  const d = Math.max(0, Math.floor((Date.now() - t) / DAY));
  if (d === 0) return "Posted today";
  if (d === 1) return "Posted yesterday";
  if (d < 14) return `Posted ${d} days ago`;
  if (d < 60) return `Posted ${Math.floor(d / 7)} weeks ago`;
  return `Posted ${Math.floor(d / 30)} months ago`;
}

export function jobPosting(o: Opening) {
  const start = o.createdAt ? Date.parse(o.createdAt) : NaN;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: o.title,
    description: o.description,
    url: `https://yugminds.org/careers/${o.slug}`,
    identifier: { "@type": "PropertyValue", name: "YugMinds", value: o.slug },
    directApply: true,
    totalJobOpenings: o.positions || 1,
    ...(!Number.isNaN(start) && {
      datePosted: new Date(start).toISOString().slice(0, 10),
      // ponytail: no closing date is stored; 90 days from posting. Add a closesOn field if roles need a real deadline.
      validThrough: new Date(start + 90 * DAY).toISOString(),
    }),
    employmentType: EMPLOYMENT(o.jobType),
    hiringOrganization: { "@type": "Organization", name: "YugMinds", sameAs: "https://yugminds.org" },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: "Hyderabad", addressRegion: "Telangana", addressCountry: "IN" },
    },
    ...(o.payMin && o.payMax && {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "INR",
        value: { "@type": "QuantitativeValue", minValue: o.payMin, maxValue: o.payMax, unitText: "MONTH" },
      },
    }),
  };
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="font-semibold text-ym-text">{title}</h4>
      <ul className="mt-3 space-y-2 text-slate-700">
        {items.map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-2.5 h-px w-4 shrink-0 bg-ym-blue" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const count = (o: Opening) => o.positions || 1;
export const seats = (o: Opening) => `${count(o)} ${count(o) === 1 ? "position" : "positions"}`;

export function Detail({ o }: { o: Opening & { status?: string } }) {
  const p = pay(o);
  return (
    <div className="p-6 md:p-8">
      <h3 className="font-acdisplay text-3xl font-bold leading-tight text-ym-text">{o.title}</h3>
      {posted(o.createdAt) && <p className="mt-1 text-sm text-slate-500">{posted(o.createdAt)}</p>}
      <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {p && (
          <div>
            <dt className="text-slate-500">Pay</dt>
            <dd className="font-semibold text-ym-text">{p}</dd>
          </div>
        )}
        <div>
          <dt className="text-slate-500">Type</dt>
          <dd className="font-semibold text-ym-text">{o.jobType}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Based at</dt>
          <dd className="font-semibold text-ym-text">{o.location}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Openings</dt>
          <dd className="font-semibold text-ym-text">{seats(o)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Team</dt>
          <dd className="font-semibold text-ym-text">{o.team}</dd>
        </div>
      </dl>
      <p className="mt-6 max-w-prose leading-relaxed text-slate-700">{o.description}</p>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <List title="What you will teach" items={o.details?.teach} />
        <List title="Who we are looking for" items={o.details?.seeking} />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {o.status === "paused" || o.status === "closed" ? (
          <p className="rounded-md bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            {o.status === "paused" ? "Applications are paused for this role right now. Please check back soon." : "This role is closed and no longer accepts applications."}
          </p>
        ) : (
          <>
            <Link
              href={`/careers/${o.slug}/apply`}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md bg-ym-blue px-6 py-3 font-semibold text-white transition-colors hover:bg-ym-blue-lit ${focus}`}
            >
              Apply for this role <ArrowRight className="size-4" aria-hidden />
            </Link>
            <span className="text-sm text-slate-500">Takes about 5 minutes</span>
          </>
        )}
        <Link href={`/careers/${o.slug}`} className={`text-sm font-semibold text-ym-blue underline ${focus}`}>
          Open full page
        </Link>
      </div>
    </div>
  );
}

