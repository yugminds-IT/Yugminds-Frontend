"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle, Eye, EyeOff, X } from "lucide-react";
import { commonApi } from "@/lib/api";
import AuthShell from "@/components/public/AuthShell";
import AuthSteps from "@/components/public/AuthSteps";
import { validatePassword } from "@/lib/password-validation";

interface ValidationResult {
  is_valid: boolean;
  school_id?: string;
  school_name?: string;
  grade?: string;
  section?: string;
  expires_at?: string;
  message?: string;
}

const STEPS = [
  { name: "Get your joining code", text: "Your school administrator gives you a code." },
  { name: "Enter your details", text: "Confirm your school, then add your name, email and a password." },
  { name: "Sign in", text: "Your account is ready for the Student Portal." },
];

const LEVELS = [
  { label: "Too short", color: "#dc2626" },
  { label: "Weak", color: "#dc2626" },
  { label: "Fair", color: "#d97706" },
  { label: "Good", color: "#2563eb" },
  { label: "Strong", color: "#16a34a" },
];

export default function SignupPage() {
  const [step, setStep] = useState<"code" | "form">("code");
  const [joiningCode, setJoiningCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  // Password rule checks (live)
  const pwRules = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const passwordTouched = password.length > 0;

  // ── Step 1: Validate Joining Code ──────────────────────────────────────────
  const validateJoiningCode = async () => {
    if (!joiningCode.trim()) {
      setError("Please enter a joining code");
      return;
    }
    setIsValidating(true);
    setError("");
    setValidationResult(null);
    try {
      const { data: result } = await commonApi.validateJoiningCode({
        code: joiningCode.trim().toUpperCase(),
      });
      if (result.is_valid) {
        setValidationResult(result);
        setStep("form");
      } else {
        setError(result.message || "Invalid or expired joining code");
        setValidationResult({ is_valid: false, message: result.message });
      }
    } catch {
      setError("Failed to validate joining code. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  // ── Step 2: Register Student ───────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!fullName.trim()) return setError("Full name is required"), setLoading(false), undefined;
    if (!email.trim()) return setError("Email is required"), setLoading(false), undefined;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const { errors } = validatePassword(password);
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    if (!validationResult?.is_valid) {
      setError("Please validate your joining code first");
      return;
    }

    setLoading(true);
    try {
      const { data: result } = await commonApi.validateJoiningCode({
        code: joiningCode.trim().toUpperCase(),
        studentData: {
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          parent_name: parentName.trim() || undefined,
          parent_phone: parentPhone.trim() || undefined,
        },
      });

      if (result.success) {
        setMessage(
          `Welcome to ${validationResult.school_name}! Your account has been created successfully.`
        );
        setTimeout(() => router.push("/lms/login"), 3000);
      } else {
        setError(result.error || result.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stage = message ? 3 : step === "code" ? 0 : 1;
  const score = [pwRules.length, pwRules.upper, pwRules.lower, pwRules.number].filter(Boolean).length;
  const level = LEVELS[score];
  const mismatch = confirmPassword !== "" && confirmPassword !== password;
  const match = confirmPassword !== "" && confirmPassword === password;

  const side = (
    <>
      {validationResult?.is_valid && step === "form" && (
        <div className="lg-school">
          <b>{validationResult.school_name}</b>
          <span>
            {[
              validationResult.grade && (validationResult.grade.startsWith("Grade ") ? validationResult.grade : `Grade ${validationResult.grade}`),
              validationResult.section && `Section ${validationResult.section}`,
            ].filter(Boolean).join(", ") || "Code confirmed"}
          </span>
        </div>
      )}
      <AuthSteps steps={STEPS} stage={stage} label="How joining works" />
    </>
  );

  const note = (tone: string, icon: React.ReactNode, text: string, redirectMs?: number) => (
    <div className="lg-note" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      {icon}
      <div><p>{text}</p></div>
      {redirectMs && <i className="lg-bar" style={{ "--ms": redirectMs + "ms" } as React.CSSProperties} aria-hidden="true" />}
    </div>
  );

  return (
    <AuthShell sideTitle="Join your school's portal." sideText="Your school gives you a joining code. Enter it, add your details, and you're in." side={side} wide>
      <h1>Create your account.</h1>
      <p className="rh-lede">
        {step === "code" ? "Enter the joining code your school gave you." : `Registering for ${validationResult?.school_name || "your school"}.`}
      </p>

      {error && note("error", <AlertCircle size={18} aria-hidden="true" />, error)}
      {message && note("ok", <CheckCircle size={18} aria-hidden="true" />, message, message.includes("created successfully") ? 3000 : undefined)}

      {step === "code" ? (
        <div className="lg-form">
          <div className="lg-field">
            <label htmlFor="joiningCode">Joining code</label>
            <div className="lg-input">
              <input
                id="joiningCode"
                data-code
                type="text"
                value={joiningCode}
                onChange={(e) => setJoiningCode(e.target.value.toUpperCase())}
                placeholder="ENTER YOUR CODE"
                disabled={isValidating}
                autoComplete="off"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), validateJoiningCode())}
              />
            </div>
            <span className="lg-hint">Ask your school administrator if you don&apos;t have one.</span>
          </div>
          <button type="button" onClick={validateJoiningCode} className="rh-btn rh-btn--primary lg-submit" disabled={isValidating || !joiningCode.trim()} aria-busy={isValidating}>
            {isValidating && <span className="lg-spin" aria-hidden="true" />}
            {isValidating ? "Checking code" : "Check code"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="lg-form">
          <div className="lg-field">
            <label htmlFor="fullName">Full name <span className="lg-req" aria-hidden="true">*</span></label>
            <div className="lg-input"><input id="fullName" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Your full name" /></div>
          </div>
          <div className="lg-field">
            <label htmlFor="email">Email address <span className="lg-req" aria-hidden="true">*</span></label>
            <div className="lg-input"><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></div>
          </div>
          <div className="lg-field">
            <label htmlFor="parentName">Parent or guardian name</label>
            <div className="lg-input"><input id="parentName" type="text" autoComplete="off" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Optional" /></div>
          </div>
          <div className="lg-field">
            <label htmlFor="parentPhone">Parent or guardian phone</label>
            <div className="lg-input"><input id="parentPhone" type="tel" autoComplete="off" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Optional" /></div>
          </div>

          <div className="lg-field">
            <label htmlFor="password">Password <span className="lg-req" aria-hidden="true">*</span></label>
            <div className="lg-input lg-input--pw">
              <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Create a password" />
              <button type="button" className="lg-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
            {passwordTouched && (
              <>
                <div className="au-strength" style={{ "--n": score, "--lvl": level.color } as React.CSSProperties}>
                  <div className="au-strength-bar"><i /></div>
                  <small>{level.label}</small>
                </div>
                <ul className="au-rules">
                  {[
                    [pwRules.length, "At least 8 characters"],
                    [pwRules.upper, "An uppercase letter (A-Z)"],
                    [pwRules.lower, "A lowercase letter (a-z)"],
                    [pwRules.number, "A number (0-9)"],
                  ].map(([met, label]) => (
                    <li key={label as string} data-met={met as boolean}>
                      {met ? <CheckCircle size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                      {label as string}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="lg-field">
            <label htmlFor="confirmPassword">Confirm password <span className="lg-req" aria-hidden="true">*</span></label>
            <div className="lg-input lg-input--pw">
              <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={mismatch ? "is-bad" : match ? "is-good" : undefined} placeholder="Type it again" />
              <button type="button" className="lg-eye" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                {showConfirmPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
            {mismatch && <span className="lg-hint" data-tone="bad">Passwords do not match.</span>}
            {match && <span className="lg-hint" data-tone="good">Passwords match.</span>}
          </div>

          <div className="lg-actions">
            <button type="button" className="rh-btn rh-btn--ghost" onClick={() => { setStep("code"); setError(""); setMessage(""); }} disabled={loading}>Back</button>
            <button type="submit" className="rh-btn rh-btn--primary" disabled={loading || !Object.values(pwRules).every(Boolean)} aria-busy={loading}>
              {loading && <span className="lg-spin" aria-hidden="true" />}
              {loading ? "Creating account" : "Create account"}
            </button>
          </div>
        </form>
      )}

      <div className="lg-helps">
        <p className="lg-help">Already have an account? <Link href="/lms/login" className="rh-link">Sign in</Link></p>
      </div>
    </AuthShell>
  );
}
