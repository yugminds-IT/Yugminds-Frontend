"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Printer } from "lucide-react";
import { academy, type Certificate } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";

/** Printable certificate. "Print or save as PDF" uses the browser, no PDF library. */
export default function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    academy.catalog.certificate(id).then(setCert).catch((e) => setError(errorText(e)));
  }, [id]);

  if (error) return <div className="ac-d-page"><p className="ac-d-note" data-tone="error" role="alert">{error}</p></div>;
  if (!cert) return <div className="ac-d-page"><span className="ac-spin" role="status" aria-label="Loading the certificate" /></div>;

  // Only reached client-side (after the fetch), so window is available.
  const { origin, hostname } = window.location;
  const verifyUrl = `${origin}${hostname.startsWith("academy.") ? "" : "/academy"}/verify/${cert.shortId}`;

  return (
    <div className="ac-d-page">
      <div className="ac-d-sheet-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "56rem", margin: "0 auto 1rem" }}>
        <Link href="/academy/learn/certificates" className="ac-back">← Certificates</Link>
        <button type="button" onClick={() => window.print()} className="rh-btn rh-btn--primary"><Printer size={16} aria-hidden="true" style={{ marginRight: "0.4rem" }} /> Print or save as PDF</button>
      </div>
      <div className="ac-d-sheet">
        <Image src="/robocoders-logo.png" alt="RoboCoders Academy" width={803} height={341} />
        <div>
          <p>Certificate of completion</p>
          <p style={{ marginTop: "1rem" }}>This certifies that</p>
          <p className="ac-d-sheet-name">{cert.learnerName}</p>
          <p style={{ marginTop: "1rem" }}>has successfully completed</p>
          <p className="ac-d-sheet-course">{cert.courseTitle}</p>
        </div>
        <div className="ac-d-sheet-foot">
          <p><b>{new Date(cert.issuedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}</b>Date of issue</p>
          <p style={{ textAlign: "right" }}><b>ID {cert.shortId}</b>Verify at {verifyUrl}</p>
        </div>
      </div>
    </div>
  );
}
