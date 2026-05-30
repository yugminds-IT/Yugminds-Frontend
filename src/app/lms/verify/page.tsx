"use client";

import { useState } from "react";
import { commonApi } from "@/lib/api/common.api";
import {
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Award,
  User,
  BookOpen,
  Calendar,
  Clock,
  Loader2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface CertInfo {
  id: string;
  short_id: string;
  student_name: string;
  course_title: string;
  certificate_name: string;
  issued_at: string;
  status: "active" | "pending";
}

type VerifyState = "idle" | "loading" | "valid" | "invalid" | "error";

export default function VerifyPage() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<VerifyState>("idle");
  const [cert, setCert] = useState<CertInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = input.trim().toUpperCase();
    if (!code) return;

    // If they paste a full URL or path, extract just the code
    const extracted = code.split("/").pop() ?? code;

    setState("loading");
    setCert(null);
    setErrorMsg("");

    try {
      const res = await commonApi.verifyCertificate(extracted);
      const d = res.data as { valid: boolean; certificate: CertInfo };
      setCert(d.certificate);
      setState(d.valid ? "valid" : "invalid");
    } catch (err: unknown) {
      const msg =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.response?.data?.message ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.message ||
        "Certificate not found";
      setErrorMsg(msg);
      setState("invalid");
    }
  };

  const handleReset = () => {
    setState("idle");
    setCert(null);
    setErrorMsg("");
    setInput("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-xl leading-none">Yugminds</p>
          <p className="text-sm text-gray-500">Certificate Verification Portal</p>
        </div>
      </div>

      <div className="w-full max-w-lg space-y-5">
        {/* Search card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify Certificate</h1>
          <p className="text-sm text-gray-500 mb-6">
            Enter the certificate ID printed on the certificate to verify its authenticity.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Certificate ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. YM-A1B2C3D4"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:font-sans placeholder:text-gray-400"
                  disabled={state === "loading"}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!input.trim() || state === "loading"}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors"
                >
                  {state === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Verify</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                The certificate ID is printed on your certificate (format: YM-XXXXXXXX)
              </p>
            </div>
          </form>
        </div>

        {/* Result */}
        {state === "valid" && cert && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Green header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-xl">Certificate Verified ✓</p>
                <p className="text-green-100 text-sm">This is a genuine Yugminds certificate</p>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Certificate Details</p>
              <div className="space-y-3">
                <DetailRow
                  icon={<Award className="h-4 w-4 text-yellow-600" />}
                  label="Certificate"
                  value={cert.certificate_name}
                />
                <DetailRow
                  icon={<User className="h-4 w-4 text-blue-600" />}
                  label="Awarded To"
                  value={cert.student_name}
                />
                <DetailRow
                  icon={<BookOpen className="h-4 w-4 text-purple-600" />}
                  label="Course Completed"
                  value={cert.course_title}
                />
                <DetailRow
                  icon={<Calendar className="h-4 w-4 text-gray-500" />}
                  label="Issue Date"
                  value={new Date(cert.issued_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
                <DetailRow
                  icon={<Shield className="h-4 w-4 text-green-600" />}
                  label="Certificate ID"
                  value={
                    <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-sm">
                      {cert.short_id}
                    </code>
                  }
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-between">
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  Verified on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                <button
                  onClick={handleReset}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Verify another
                </button>
              </div>
            </div>
          </div>
        )}

        {state === "invalid" && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Red header */}
            <div className={`px-6 py-5 flex items-center gap-4 ${cert?.status === "pending" ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-red-500 to-rose-500"}`}>
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {cert?.status === "pending"
                  ? <Clock className="h-8 w-8 text-white" />
                  : <XCircle className="h-8 w-8 text-white" />
                }
              </div>
              <div>
                <p className="text-white font-bold text-xl">
                  {cert?.status === "pending" ? "Certificate Pending" : "Not Found"}
                </p>
                <p className="text-white/80 text-sm">
                  {cert?.status === "pending"
                    ? "This certificate is still being generated"
                    : "No valid certificate found for this ID"}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {cert?.status === "pending" ? (
                <p className="text-sm text-gray-600">
                  The certificate has been issued but is still being processed. Please check back in a few moments.
                </p>
              ) : (
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    No certificate was found for ID{" "}
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">{input.trim().toUpperCase()}</code>.
                  </p>
                  <ul className="text-xs text-gray-500 list-disc ml-4 space-y-1 mt-2">
                    <li>Check the ID is entered correctly (format: YM-XXXXXXXX)</li>
                    <li>The certificate may have been revoked</li>
                    <li>The certificate was not issued by Yugminds</li>
                  </ul>
                  {errorMsg && <p className="text-xs text-red-500 mt-1">{errorMsg}</p>}
                </div>
              )}
              <div className="pt-2 border-t flex justify-end">
                <button onClick={handleReset} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  Try again <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        {state === "idle" && (
          <div className="bg-white/60 rounded-2xl p-5 text-sm text-gray-500 space-y-3">
            <p className="font-semibold text-gray-700 text-xs uppercase tracking-wider">How it works</p>
            <div className="space-y-2">
              {[
                "Find the Certificate ID on your Yugminds certificate (format: YM-XXXXXXXX)",
                "Enter the ID in the box above and click Verify",
                "Instantly see if the certificate is genuine and view the course details",
              ].map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Certificates issued by Yugminds Education Platform ·{" "}
          <Link href="/lms/login" className="underline hover:text-gray-600">
            Sign in to your account
          </Link>
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
