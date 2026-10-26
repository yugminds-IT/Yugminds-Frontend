import type { Metadata } from "next";
import { BadgeCheck, XCircle } from "lucide-react";
import { backendRequest } from "@/lib/backend-client";
import type { Certificate } from "@/lib/academy/api";

type Props = { params: Promise<{ shortId: string }> };

// Certificates carry learner names — reachable, but kept out of search indexes.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function VerifyCertificatePage({ params }: Props) {
  const { shortId } = await params;
  const cert = await backendRequest<Certificate>(`/academy/certificates/${encodeURIComponent(shortId)}`).catch(() => null);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {cert ? (
        <>
          <BadgeCheck className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-acdisplay font-bold">Verified certificate</h1>
          <div className="mt-6 rounded-2xl border border-slate-200 p-6 text-left">
            <p className="text-sm text-ac-muted">Awarded to</p>
            <p className="text-xl font-bold">{cert.learnerName}</p>
            <p className="mt-4 text-sm text-ac-muted">For completing</p>
            <p className="text-lg font-semibold">{cert.courseTitle}</p>
            <p className="mt-4 text-sm text-ac-muted">
              Issued {new Date(cert.issuedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}, certificate ID {cert.shortId}
            </p>
          </div>
        </>
      ) : (
        <>
          <XCircle className="mx-auto h-14 w-14 text-red-500" />
          <h1 className="mt-4 text-2xl font-acdisplay font-bold">Certificate not found</h1>
          <p className="mt-2 text-ac-muted">Check the certificate ID and try again.</p>
        </>
      )}
    </div>
  );
}
