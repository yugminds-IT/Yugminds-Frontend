"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { commonApi } from "@/lib/api/common.api";
import {
  CheckCircle,
  XCircle,
  Award,
  Clock,
  User,
  BookOpen,
  Calendar,
  Shield,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface CertInfo {
  id: string;
  short_id: string;
  student_name: string;
  course_title: string;
  certificate_name: string;
  issued_at: string;
  status: "active" | "pending" | "revoked" | "broken";
}

type VerifyState = "loading" | "valid" | "invalid" | "error";

export default function RobocodersVerifyCertificatePage() {
  const params = useParams();
  const shortId = String(params?.shortId ?? "");

  const [state, setState] = useState<VerifyState>("loading");
  const [cert, setCert] = useState<CertInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!shortId) { setState("error"); setErrorMsg("No certificate ID provided"); return; }

    commonApi.verifyCertificate(shortId)
      .then((res) => {
        const d = res.data as { valid: boolean; certificate: CertInfo };
        setCert(d.certificate);
        setState(d.valid ? "valid" : "invalid");
      })
      .catch((err) => {
        // No `response` means the request never reached the backend at all
        // (network error/timeout) — that's not the same as the backend
        // confirming this ID doesn't exist, and must not be shown as
        // "Certificate Not Found" (a genuine cert holder hitting a
        // transient outage would otherwise see their real certificate
        // reported as invalid).
        if (!err?.response) {
          setErrorMsg(err?.message || "Could not reach the verification server.");
          setState("error");
          return;
        }
        const msg = err?.response?.data?.message || "Certificate not found";
        setErrorMsg(msg);
        setState("invalid");
      });
  }, [shortId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand header */}
      <div className="mb-8 flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg leading-none">Robocoders</p>
          <p className="text-xs text-gray-500">Certificate Verification · by Yugminds</p>
        </div>
      </div>

      <div className="w-full max-w-lg">
        {state === "loading" && (
          <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-4 text-gray-500">
            <Loader2 className="h-10 w-10 animate-spin text-blue-700" />
            <p className="font-medium">Verifying certificate...</p>
            <code className="text-xs bg-gray-100 px-3 py-1 rounded-full">{shortId}</code>
          </div>
        )}

        {state === "valid" && cert && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Green banner */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Certificate Verified ✓</p>
                <p className="text-green-100 text-sm">This is a genuine Robocoders certificate</p>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Certificate Details</p>
                <div className="space-y-3">
                  <DetailRow icon={<Award className="h-4 w-4 text-yellow-600" />} label="Certificate" value={cert.certificate_name} />
                  <DetailRow icon={<User className="h-4 w-4 text-blue-600" />} label="Awarded To" value={cert.student_name} />
                  <DetailRow icon={<BookOpen className="h-4 w-4 text-purple-600" />} label="Course" value={cert.course_title} />
                  <DetailRow icon={<Calendar className="h-4 w-4 text-gray-500" />} label="Issue Date" value={new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
                  <DetailRow
                    icon={<Shield className="h-4 w-4 text-green-600" />}
                    label="Certificate ID"
                    value={<code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-sm">{cert.short_id}</code>}
                  />
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span>Verified on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <Link href="https://yugminds.com/robocoders" target="_blank" rel="noopener noreferrer">
                <button className="w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <ExternalLink className="h-4 w-4" /> Visit Robocoders
                </button>
              </Link>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-5 flex items-center gap-4 bg-gradient-to-r from-gray-500 to-gray-600">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <XCircle className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Couldn&apos;t Verify Right Now</p>
                <p className="text-white/80 text-sm">This doesn&apos;t mean your certificate is invalid</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                We couldn&apos;t reach the verification server just now. This is usually temporary —
                please try again in a moment.
              </p>
              {errorMsg && <p className="text-xs text-gray-400">{errorMsg}</p>}
            </div>
            <div className="px-6 pb-6">
              <Link href={`/robocoders/lms/verify/${shortId}`}>
                <button className="w-full py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors">
                  Try again
                </button>
              </Link>
            </div>
          </div>
        )}

        {state === "invalid" && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div
              className={`px-6 py-5 flex items-center gap-4 ${
                cert?.status === "pending"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500"
                  : cert?.status === "revoked"
                    ? "bg-gradient-to-r from-gray-600 to-gray-700"
                    : "bg-gradient-to-r from-red-500 to-rose-500"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {cert?.status === "pending" ? <Clock className="h-8 w-8 text-white" /> : <XCircle className="h-8 w-8 text-white" />}
              </div>
              <div>
                <p className="text-white font-bold text-xl">
                  {cert?.status === "pending"
                    ? "Certificate Pending"
                    : cert?.status === "revoked"
                      ? "Certificate Revoked"
                      : cert?.status === "broken"
                        ? "Certificate Unavailable"
                        : "Certificate Not Found"}
                </p>
                <p className="text-white/80 text-sm">
                  {cert?.status === "pending"
                    ? "This certificate is being generated"
                    : cert?.status === "revoked"
                      ? "This certificate has been revoked and is no longer valid"
                      : cert?.status === "broken"
                        ? "This certificate exists but could not be rendered"
                        : "This certificate ID is not valid"}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {cert?.status === "pending" ? (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
                  <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Certificate is being processed</p>
                    <p className="text-yellow-700 text-xs mt-1">Please check back in a few moments. If this persists, contact support.</p>
                  </div>
                </div>
              ) : cert?.status === "revoked" ? (
                <p className="text-sm text-gray-600">
                  Certificate <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">{cert.short_id}</code>{" "}
                  was issued to <strong>{cert.student_name}</strong> for <strong>{cert.course_title}</strong>, but has since
                  been revoked by the issuer.
                </p>
              ) : cert?.status === "broken" ? (
                <p className="text-sm text-gray-600">
                  This certificate ID exists in our records but its file could not be generated. Please contact the issuing
                  school or Yugminds support.
                </p>
              ) : (
                <div className="space-y-3 text-sm text-gray-600">
                  <p>The certificate ID <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">{shortId}</code> could not be found.</p>
                  <p className="text-xs text-gray-500">Possible reasons:</p>
                  <ul className="text-xs text-gray-500 list-disc ml-4 space-y-1">
                    <li>The ID was typed incorrectly</li>
                    <li>The certificate was not issued by Robocoders</li>
                  </ul>
                  {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <Link href="/robocoders/lms/verify">
                <button className="w-full py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors">
                  Try another certificate
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Certificates issued by Robocoders · Yugminds Education Platform ·{" "}
          <Link href="/lms/login" className="underline hover:text-gray-600">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <div className="text-sm font-medium text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}
