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
  status: "active" | "pending" | "broken" | "revoked";
}

type VerifyState = "loading" | "valid" | "invalid" | "error";

export default function VerifyCertificatePage() {
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
        const msg = err?.response?.data?.message || err?.message || "Certificate not found";
        setErrorMsg(msg);
        setState("invalid");
      });
  }, [shortId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand header */}
      <div className="mb-8 flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-lg leading-none">Yugminds</p>
          <p className="text-xs text-gray-500">Certificate Verification</p>
        </div>
      </div>

      <div className="w-full max-w-lg">
        {state === "loading" && (
          <div className="bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-4 text-gray-500">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="font-medium">Verifying certificate...</p>
            <code className="text-xs bg-gray-100 px-3 py-1 rounded-full">{shortId}</code>
          </div>
        )}

        {state === "valid" && cert && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Green banner */}
            <div className="bg-green-500 px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Certificate Verified</p>
                <p className="text-green-100 text-sm">This is a genuine Yugminds certificate</p>
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
              <Link href="https://yugminds.com" target="_blank" rel="noopener noreferrer">
                <button className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <ExternalLink className="h-4 w-4" /> Visit Yugminds
                </button>
              </Link>
            </div>
          </div>
        )}

        {(state === "invalid" || state === "error") && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Red banner */}
            <div className="bg-red-500 px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <XCircle className="h-8 w-8 text-white" />
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
                <p className="text-red-100 text-sm">
                  {cert?.status === "pending"
                    ? "This certificate is being generated"
                    : cert?.status === "revoked"
                      ? "This certificate has been revoked and is no longer valid"
                      : cert?.status === "broken"
                        ? "This certificate's file could not be retrieved"
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
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                  <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">This certificate is no longer valid</p>
                    <p className="text-red-700 text-xs mt-1">
                      Certificate <code className="bg-white/60 px-1 rounded font-mono">{cert.short_id}</code> was revoked by the issuing school and should not be relied on as proof of achievement.
                    </p>
                  </div>
                </div>
              ) : cert?.status === "broken" ? (
                <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800">
                  <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Certificate file unavailable</p>
                    <p className="text-orange-700 text-xs mt-1">The certificate record exists but its file could not be found. Please contact support.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-gray-600">
                  <p>The certificate ID <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">{shortId}</code> could not be found.</p>
                  <p className="text-xs text-gray-500">Possible reasons:</p>
                  <ul className="text-xs text-gray-500 list-disc ml-4 space-y-1">
                    <li>The ID was typed incorrectly</li>
                    <li>The certificate may have been revoked</li>
                    <li>The certificate was not issued by Yugminds</li>
                  </ul>
                  {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <Link href="/lms/login">
                <button className="w-full py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors">
                  Go to Yugminds LMS
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Certificates issued by Yugminds Education Platform ·{" "}
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
