"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, CheckCircle, Clock, Copy, Loader2, Search, ShieldCheck, WifiOff, XCircle } from "lucide-react";
import { commonApi } from "@/lib/api/common.api";
import AuthShell from "./AuthShell";

interface CertInfo {
  id: string;
  short_id: string;
  student_name: string;
  course_title: string;
  certificate_name: string;
  issued_at: string;
  status: "active" | "pending" | "revoked" | "broken";
}
type View = "idle" | "loading" | "valid" | "invalid" | "error";
type Kind = "valid" | "pending" | "revoked" | "broken" | "missing" | "error";

const STEPS = [
  "Find the certificate ID on the RoboCoders certificate.",
  "Type it in and press Verify.",
  "See at once whether it is genuine, and who earned it.",
];
const STAMP: Record<Kind, { label: string; Icon: typeof Check }> = {
  valid: { label: "Verified", Icon: Check },
  pending: { label: "Pending", Icon: Clock },
  revoked: { label: "Revoked", Icon: XCircle },
  broken: { label: "Unavailable", Icon: AlertCircle },
  missing: { label: "Not found", Icon: XCircle },
  error: { label: "No answer", Icon: WifiOff },
};
const date = (d: string | Date) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/* The certificate checker. The navy panel is a small scanner: a sample certificate with a light scanning down it while it
   waits or checks, then a stamp that says what was found. The form and the result sit beside it. A server that cannot be
   reached is never shown as "not found", because a real certificate must not be reported as fake during an outage. Pass an
   `initialCode` to check on arrival (the /verify/ID link). */
export default function CertVerify({ initialCode }: { initialCode?: string }) {
  const [input, setInput] = useState(initialCode ?? "");
  const [view, setView] = useState<View>(initialCode ? "loading" : "idle");
  const [cert, setCert] = useState<CertInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [checked, setChecked] = useState(initialCode ?? "");
  const [copied, setCopied] = useState(false);
  const res = useRef<HTMLDivElement>(null);

  const run = async (raw: string) => {
    const code = raw.trim().toUpperCase().split("/").pop() ?? "";
    if (!code) return;
    setChecked(code);
    setView("loading");
    setCert(null);
    setErrorMsg("");
    try {
      const r = await commonApi.verifyCertificate(code);
      const d = r.data as { valid: boolean; certificate: CertInfo };
      setCert(d.certificate);
      setView(d.valid ? "valid" : "invalid");
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      if (!e?.response) {
        setErrorMsg(e?.message || "Could not reach the verification server.");
        setView("error");
        return;
      }
      setErrorMsg(e?.response?.data?.message || "");
      setView("invalid");
    }
  };

  useEffect(() => {
    if (initialCode) void run(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (view === "valid" || view === "invalid" || view === "error") res.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [view]);

  const reset = () => { setView("idle"); setCert(null); setErrorMsg(""); setInput(""); setChecked(""); };
  const kind: Kind | null =
    view === "valid" ? "valid"
    : view === "error" ? "error"
    : view === "invalid" ? (cert?.status === "pending" ? "pending" : cert?.status === "revoked" ? "revoked" : cert?.status === "broken" ? "broken" : "missing")
    : null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(cert?.short_id ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the code stays selectable */ }
  };
  const S = kind ? STAMP[kind] : null;
  const say =
    view === "loading" ? "Checking the register."
    : kind === "valid" ? "Genuine. This certificate is on our register."
    : kind === "pending" ? "Found, but still being prepared."
    : kind === "revoked" ? "Found, but it has been revoked."
    : kind === "broken" ? "Found, but its file is unavailable."
    : kind === "missing" ? "No certificate with that ID."
    : kind === "error" ? "Could not reach the register."
    : "Waiting for a certificate ID.";

  return (
    <AuthShell
      sideTitle="Is it genuine? Check in seconds."
      sideText="Every RoboCoders certificate has its own ID. Enter it and we look it up on the register."
      side={
        <div className="cv-scanner">
          <div className="cv-doc" data-view={view} data-kind={kind ?? undefined}>
            <Image src="/certificate-of-completion.png" alt="A sample RoboCoders certificate of completion" width={2000} height={1414} sizes="(max-width: 960px) 90vw, 32rem" priority />
            <i className="cv-scan" aria-hidden="true" />
            {S && (
              <span className="cv-stamp" key={kind} aria-hidden="true"><S.Icon size={26} /><b>{S.label}</b></span>
            )}
          </div>
          <p className="cv-cap" aria-live="polite"><span className="cv-dot" data-view={view} aria-hidden="true" />{say}</p>
        </div>
      }
    >
      <h1>Verify a certificate.</h1>
      <p className="rh-lede">Enter the ID printed on a RoboCoders certificate to confirm it is genuine.</p>

      <form className="lg-form" onSubmit={(e) => { e.preventDefault(); void run(input); }}>
        <div className="lg-field">
          <label htmlFor="cert-id">Certificate ID</label>
          <div className="cv-row">
            <div className="lg-input">
              <input id="cert-id" className="cv-code" type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="YM-A1B2C3D4" autoComplete="off" spellCheck={false} autoFocus={!initialCode} disabled={view === "loading"} />
            </div>
            <button type="submit" className="rh-btn rh-btn--primary" disabled={!input.trim() || view === "loading"} aria-busy={view === "loading"}>
              {view === "loading" ? <Loader2 size={16} className="cv-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
              <span>{view === "loading" ? "Checking" : "Verify"}</span>
            </button>
          </div>
          <span className="lg-hint">The ID is printed on the certificate. It looks like YM-A1B2C3D4.</span>
        </div>
      </form>

      <div ref={res} className="cv-out" aria-live="polite">
        {view === "idle" && (
          <ol className="cv-how" aria-label="How verification works">
            {STEPS.map((t, i) => <li key={t} style={{ "--i": i } as React.CSSProperties}><span>{i + 1}</span>{t}</li>)}
          </ol>
        )}

        {view === "loading" && (
          <p className="cv-wait"><Loader2 size={16} className="cv-spin" aria-hidden="true" /> Checking <code>{checked}</code></p>
        )}

        {view === "valid" && cert && (
          <div className="cv-res" data-tone="ok">
            <div className="cv-res-head">
              <span className="cv-badge"><CheckCircle size={26} aria-hidden="true" /></span>
              <div><h2>Certificate verified</h2><p>This is a genuine RoboCoders certificate.</p></div>
            </div>
            <dl className="cv-dl">
              <div style={{ "--i": 0 } as React.CSSProperties}><dt>Awarded to</dt><dd>{cert.student_name}</dd></div>
              <div style={{ "--i": 1 } as React.CSSProperties}><dt>Course completed</dt><dd>{cert.course_title}</dd></div>
              <div style={{ "--i": 2 } as React.CSSProperties}><dt>Certificate</dt><dd>{cert.certificate_name}</dd></div>
              <div style={{ "--i": 3 } as React.CSSProperties}><dt>Issued on</dt><dd>{date(cert.issued_at)}</dd></div>
              <div style={{ "--i": 4 } as React.CSSProperties}>
                <dt>Certificate ID</dt>
                <dd><code>{cert.short_id}</code><button type="button" className="cv-copy" onClick={copy} aria-label="Copy the certificate ID">{copied ? <><Check size={14} aria-hidden="true" /> Copied</> : <><Copy size={14} aria-hidden="true" /> Copy</>}</button></dd>
              </div>
            </dl>
            <div className="cv-res-foot">
              <span><ShieldCheck size={14} aria-hidden="true" /> Checked on {date(new Date())}</span>
              <button type="button" className="rh-link" onClick={reset}>Check another</button>
            </div>
          </div>
        )}

        {view === "invalid" && (
          <div className="cv-res" data-tone={kind === "pending" || kind === "broken" ? "warn" : "bad"}>
            <div className="cv-res-head">
              <span className="cv-badge">{kind === "pending" ? <Clock size={26} aria-hidden="true" /> : kind === "broken" ? <AlertCircle size={26} aria-hidden="true" /> : <XCircle size={26} aria-hidden="true" />}</span>
              <div>
                <h2>{kind === "pending" ? "Certificate pending" : kind === "revoked" ? "Certificate revoked" : kind === "broken" ? "Certificate unavailable" : "Not found"}</h2>
                <p>
                  {kind === "pending" ? "This certificate is still being prepared."
                    : kind === "revoked" ? "It was issued, but it is no longer valid."
                    : kind === "broken" ? "The record exists, but its file could not be retrieved."
                    : "No valid certificate matches this ID."}
                </p>
              </div>
            </div>
            <div className="cv-res-body">
              {kind === "pending" && <p>Check back in a few moments. If it stays pending, contact the issuing school or RoboCoders.</p>}
              {kind === "revoked" && cert && <p>Certificate <code>{cert.short_id}</code>, issued to <b>{cert.student_name}</b> for <b>{cert.course_title}</b>, has been revoked by the issuer. Do not rely on it as proof of achievement.</p>}
              {kind === "broken" && <p>Please contact the issuing school or RoboCoders support and quote the ID <code>{checked}</code>.</p>}
              {kind === "missing" && (
                <>
                  <p>We could not find <code>{checked}</code>. Check that:</p>
                  <ul>
                    <li>the ID was typed exactly as printed, for example YM-A1B2C3D4</li>
                    <li>the certificate was issued by RoboCoders</li>
                  </ul>
                  {errorMsg && <small>{errorMsg}</small>}
                </>
              )}
            </div>
            <div className="cv-res-foot">
              <Link href="/robocoders/contact" className="rh-link">Need help? Contact us</Link>
              <button type="button" className="rh-link" onClick={reset}>Try again <ArrowRight size={14} aria-hidden="true" /></button>
            </div>
          </div>
        )}

        {view === "error" && (
          <div className="cv-res" data-tone="idle">
            <div className="cv-res-head">
              <span className="cv-badge"><WifiOff size={24} aria-hidden="true" /></span>
              <div><h2>Could not check right now</h2><p>This does not mean the certificate is invalid.</p></div>
            </div>
            <div className="cv-res-body">
              <p>We could not reach the verification server. This is usually temporary, so please try again in a moment.</p>
              {errorMsg && <small>{errorMsg}</small>}
            </div>
            <div className="cv-res-foot">
              <span />
              <button type="button" className="rh-btn rh-btn--ghost" onClick={() => void run(checked || input)}>Try again</button>
            </div>
          </div>
        )}
      </div>

      <p className="lg-help cv-foot">
        Certificates are issued by RoboCoders, part of the YugMinds education platform. <Link href="/lms/login" className="rh-link">Sign in</Link>
      </p>
    </AuthShell>
  );
}
