import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YugmindsShell } from "@/components/yugminds/YugmindsSite";
import { jobPosting, type Opening } from "@/components/yugminds/JobDetail";
import JobPage from "@/components/yugminds/JobPage";
import { getBaseURL } from "@/lib/api/axios";

type Full = Opening & { status: string };

async function load(slug: string): Promise<Full | null> {
  try {
    const r = await fetch(`${getBaseURL()}/careers/openings/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } });
    return r.ok ? ((await r.json()) as Full) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const o = await load((await params).slug);
  if (!o) return { title: "Role not found | YugMinds", robots: { index: false } };
  const title = `${o.title} at YugMinds, ${o.location}`;
  const description = o.description.slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: `/careers/${o.slug}` },
    openGraph: { title, description, type: "website" },
    robots: o.status === "open" ? undefined : { index: false },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const o = await load((await params).slug);
  if (!o) notFound();
  return (
    <YugmindsShell>
      {o.status === "open" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPosting(o)).replace(/</g, "\\u003c") }} />
      )}
      <JobPage o={o} />
    </YugmindsShell>
  );
}
