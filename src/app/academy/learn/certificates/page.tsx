"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { academy, type Certificate } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.me.certificates().then(setCerts).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <PageHeader title="Certificates" subtitle="Finish every lesson in a course to earn its certificate." />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {certs?.length === 0 && <p className="text-sm text-ac-muted">No certificates yet — keep going!</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {certs?.map((c) => (
          <Link key={c.shortId} href={`/academy/learn/certificates/${c.shortId}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-ac-brand">
            <Award className="h-10 w-10 shrink-0 text-ac-accent" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{c.courseTitle}</p>
              <p className="text-xs text-ac-muted">Issued {new Date(c.issuedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}, ID {c.shortId}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
