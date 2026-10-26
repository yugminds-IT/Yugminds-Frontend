"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Printer } from "lucide-react";
import { academy, type Certificate } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";

/** Printable certificate — "Print / Save as PDF" uses the browser, no PDF library. */
export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.catalog.certificate(id).then(setCert).catch((e) => setError(errorText(e)));
  }, [id]);

  if (error) return <p className="p-8 text-red-600">{error}</p>;
  if (!cert) return <div className="p-8"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ac-brand" /></div>;

  // Only reached client-side (after the fetch), so window is available.
  const { origin, hostname } = window.location;
  const verifyUrl = `${origin}${hostname.startsWith("academy.") ? "" : "/academy"}/verify/${cert.shortId}`;

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto mb-4 flex max-w-4xl justify-between print:hidden">
        <Link href="/academy/learn/certificates" className="text-sm font-semibold text-ac-brand hover:underline">← Certificates</Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-ac-brand px-5 py-2 text-sm font-semibold text-white hover:bg-ac-brand-dark">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>
      <div className="mx-auto aspect-[1.414] max-w-4xl rounded-lg border-[10px] border-double border-ac-brand bg-white p-8 text-center shadow-sm sm:p-14 print:shadow-none">
        <div className="flex h-full flex-col items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-ac-brand">
            <GraduationCap className="h-7 w-7" /> RoboCoders Academy
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-ac-muted">Certificate of completion</p>
            <p className="mt-4 text-sm text-ac-muted">This certifies that</p>
            <p className="mt-2 text-3xl font-acdisplay font-bold text-ac-ink sm:text-4xl">{cert.learnerName}</p>
            <p className="mt-4 text-sm text-ac-muted">has successfully completed</p>
            <p className="mt-2 text-xl font-bold text-ac-ink sm:text-2xl">{cert.courseTitle}</p>
          </div>
          <div className="flex w-full flex-wrap items-end justify-between gap-4 text-left text-xs text-ac-muted">
            <div>
              <p className="font-semibold text-ac-ink">{new Date(cert.issuedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
              <p>Date of issue</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-ac-ink">ID {cert.shortId}</p>
              <p>Verify at {verifyUrl}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
