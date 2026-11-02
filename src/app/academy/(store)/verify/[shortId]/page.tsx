import type { Metadata } from "next";
import { Award, BadgeCheck, SearchX } from "lucide-react";
import { backendRequest } from "@/lib/backend-client";
import { VerifyForm } from "@/components/academy/VerifyForm";
import type { Certificate } from "@/lib/academy/api";

type Props = { params: Promise<{ shortId: string }> };

// Certificates carry learner names — reachable, but kept out of search indexes.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function VerifyCertificatePage({ params }: Props) {
  const { shortId } = await params;
  const cert = await backendRequest<Certificate>(`/academy/certificates/${encodeURIComponent(shortId)}`).catch(() => null);

  return (
    <section className="ac-top ac-page">
      <div className="rh-wrap" style={{ maxWidth: "40rem", display: "grid", gap: "1.5rem", justifyItems: "center", textAlign: "center" }}>
        {cert ? (
          <>
            <span className="ac-cert-state" data-ok="true"><BadgeCheck size={18} aria-hidden="true" /> Verified certificate</span>
            <div className="ac-cert" style={{ width: "100%" }}>
              <span className="ac-cert-seal"><Award size={28} aria-hidden="true" /></span>
              <p>This certificate was awarded to</p>
              <p className="ac-cert-name">{cert.learnerName}</p>
              <p>for completing</p>
              <p className="ac-cert-course">{cert.courseTitle}</p>
              <p className="ac-cert-id">
                Issued {new Date(cert.issuedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}, certificate ID {cert.shortId}
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="ac-cert-state" data-ok="false"><SearchX size={18} aria-hidden="true" /> Certificate not found</span>
            <h1 style={{ fontSize: "var(--rh-t-h2)" }}>We could not find that ID</h1>
            <p className="rh-lede">Check the certificate ID for typing mistakes and try again.</p>
            <VerifyForm autoFocus />
          </>
        )}
      </div>
    </section>
  );
}
