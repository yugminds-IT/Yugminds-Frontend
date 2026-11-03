"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award } from "lucide-react";
import { academy, type Certificate } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { PageHeader } from "@/components/academy/AcademyShell";
import { EmptyState } from "@/components/academy/ui";

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.me.certificates().then(setCerts).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div className="ac-d-page ac-d-page--narrow">
      <PageHeader title="Certificates" subtitle="Finish every lesson in a course to earn its certificate." />
      {error && <p className="ac-d-note" data-tone="error" role="alert">{error}</p>}
      {certs === null && !error && <span className="ac-spin" role="status" aria-label="Loading your certificates" />}
      {certs?.length === 0 && (
        <EmptyState icon={Award} title="No certificates yet" text="Finish a course and it will appear here." action={<Link href="/academy/learn/courses" className="rh-btn rh-btn--primary">Go to my courses</Link>} />
      )}
      <div className="ac-d-certs">
        {certs?.map((c) => (
          <Link key={c.shortId} href={`/academy/learn/certificates/${c.shortId}`} className="ac-d-cert">
            <span className="ac-d-seal"><Award size={22} aria-hidden="true" /></span>
            <span style={{ minWidth: 0 }}>
              <b>{c.courseTitle}</b>
              <small>Issued {new Date(c.issuedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}, ID {c.shortId}</small>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
