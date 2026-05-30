"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  School,
  ArrowLeft,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { commonApi } from "@/lib/api";
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

/** Per-rule indicator shown below the password field */
function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600" : "text-gray-400"}`}>
      {met ? (
        <CheckCircle className="h-3 w-3 flex-shrink-0" />
      ) : (
        <X className="h-3 w-3 flex-shrink-0" />
      )}
      {label}
    </li>
  );
}

/** Coloured strength bar */
function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length; // 0-4

  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][score];
  const colour = ["bg-red-400", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"][score];
  const width = ["w-1/4", "w-1/4", "w-2/4", "w-3/4", "w-full"][score];

  return (
    <div className="mt-1.5 space-y-1">
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full transition-all duration-300 ${colour} ${width}`} />
      </div>
      <p className={`text-xs font-medium ${colour.replace("bg-", "text-")}`}>{label}</p>
    </div>
  );
}

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <School className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Create your account</h2>
          <p className="mt-2 text-sm text-gray-600">Join the Student Portal with your joining code</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === "code" ? "Enter Joining Code" : "Student Registration"}</CardTitle>
            <CardDescription>
              {step === "code"
                ? "Enter the joining code provided by your school"
                : `Registering for ${validationResult?.school_name || "your school"}`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === "code" ? (
              // ── Step 1 ──────────────────────────────────────────────────────
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="joiningCode">Joining Code</Label>
                  <Input
                    id="joiningCode"
                    type="text"
                    value={joiningCode}
                    onChange={(e) => setJoiningCode(e.target.value.toUpperCase())}
                    placeholder="Enter your joining code"
                    className="mt-1 uppercase"
                    disabled={isValidating}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), validateJoiningCode())}
                  />
                  <p className="mt-1 text-xs text-gray-500">Get this code from your school administrator</p>
                </div>

                <Button
                  type="button"
                  onClick={validateJoiningCode}
                  className="w-full"
                  disabled={isValidating || !joiningCode.trim()}
                >
                  {isValidating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</>
                  ) : (
                    "Validate Code"
                  )}
                </Button>
              </div>
            ) : (
              // ── Step 2 ──────────────────────────────────────────────────────
              <form onSubmit={handleSignup} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {message && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{message}</AlertDescription>
                  </Alert>
                )}

                {/* School info */}
                {validationResult?.is_valid && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <School className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <div className="font-semibold">{validationResult.school_name}</div>
                      <div className="text-sm space-y-0.5">
                        {validationResult.grade && (
                          <div>
                            {validationResult.grade.startsWith("Grade ")
                              ? validationResult.grade
                              : `Grade ${validationResult.grade}`}
                          </div>
                        )}
                        {validationResult.section && <div>Section: {validationResult.section}</div>}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Full Name */}
                <div>
                  <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="mt-1"
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email">Email address <span className="text-red-500">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1"
                    placeholder="Enter your email"
                  />
                </div>

                {/* Parent / Guardian Name */}
                <div>
                  <Label htmlFor="parentName">Parent / Guardian Name</Label>
                  <Input
                    id="parentName"
                    type="text"
                    autoComplete="off"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="mt-1"
                    placeholder="Enter parent or guardian name"
                  />
                </div>

                {/* Parent / Guardian Phone */}
                <div>
                  <Label htmlFor="parentPhone">Parent / Guardian Phone</Label>
                  <Input
                    id="parentPhone"
                    type="tel"
                    autoComplete="off"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="mt-1"
                    placeholder="Enter parent or guardian phone number"
                  />
                </div>

                {/* Password */}
                <div>
                  <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  <PasswordStrengthBar password={password} />

                  {/* Rule checklist — shown once user starts typing */}
                  {passwordTouched && (
                    <ul className="mt-2 space-y-1 pl-0.5">
                      <PasswordRule met={pwRules.length} label="At least 8 characters" />
                      <PasswordRule met={pwRules.upper}  label="At least one uppercase letter (A-Z)" />
                      <PasswordRule met={pwRules.lower}  label="At least one lowercase letter (a-z)" />
                      <PasswordRule met={pwRules.number} label="At least one number (0-9)" />
                    </ul>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`pr-10 ${
                        confirmPassword && confirmPassword !== password
                          ? "border-red-400 focus-visible:ring-red-400"
                          : confirmPassword && confirmPassword === password
                          ? "border-green-400 focus-visible:ring-green-400"
                          : ""
                      }`}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                  )}
                  {confirmPassword && confirmPassword === password && (
                    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setStep("code"); setError(""); setMessage(""); }}
                    className="flex-1"
                    disabled={loading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading || !Object.values(pwRules).every(Boolean)}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link href="/lms/login" className="text-sm text-blue-600 hover:text-blue-500">
                Already have an account? Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
