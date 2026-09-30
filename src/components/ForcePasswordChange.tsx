"use client";

import { useState, useEffect } from "react";
import { KeyRound, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { authApi } from "../lib/api/auth.api";
import { getStoredSession, setStoredSession, waitForSession } from "../lib/session-utils";

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"];
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : "bg-gray-200"}`} />
        ))}
      </div>
      {password && <p className={`text-xs ${score < 3 ? "text-red-500" : score < 5 ? "text-yellow-600" : "text-green-600"}`}>{labels[score - 1] ?? "Very weak"}</p>}
    </div>
  );
}

/** `allowSkip` adds a Cancel button that keeps the issued password permanently (students only). */
export function ForcePasswordChange({ allowSkip = false }: { allowSkip?: boolean }) {
  const [show, setShow] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // After a reload the session is restored asynchronously via refresh.
    void waitForSession().then((res) => {
      if (!cancelled && res?.session?.user?.mustChangePassword) setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const clearFlag = () => {
    const session = getStoredSession();
    if (session?.user) {
      setStoredSession({ ...session, user: { ...session.user, mustChangePassword: false } });
    }
  };

  const handleSkip = async () => {
    setError("");
    setSkipping(true);
    try {
      await authApi.keepPassword();
      clearFlag();
      setShow(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSkipping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!/[A-Z]/.test(newPassword)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[a-z]/.test(newPassword)) { setError("Password must contain at least one lowercase letter."); return; }
    if (!/\d/.test(newPassword)) { setError("Password must contain at least one number."); return; }

    setLoading(true);
    try {
      await authApi.updatePassword({ new_password: newPassword });
      clearFlag();
      setDone(true);
      setTimeout(() => setShow(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Full-screen blocking overlay — only dismissible via Cancel when allowSkip
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <ShieldAlert className="h-6 w-6" />
            <h2 className="text-lg font-bold">{allowSkip ? "Set Your Own Password?" : "Password Change Required"}</h2>
          </div>
          <p className="text-blue-100 text-sm">
            {allowSkip
              ? "You logged in with the password you were given. You can set a new one now, or press Cancel to keep using your current password."
              : "You are logged in with a temporary password. You must set a new password before continuing."}
          </p>
        </div>

        <div className="px-6 py-5">
          {done ? (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-base font-semibold text-gray-800">Password updated successfully!</p>
              <p className="text-sm text-gray-500">Continuing to your dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                    autoFocus
                    required
                  />
                  <button type="button" onClick={() => setShowNew((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && <StrengthBar password={newPassword} />}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirm((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Password requirements:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li className={newPassword.length >= 8 ? "text-green-600" : ""}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(newPassword) ? "text-green-600" : ""}>One uppercase letter</li>
                  <li className={/[a-z]/.test(newPassword) ? "text-green-600" : ""}>One lowercase letter</li>
                  <li className={/\d/.test(newPassword) ? "text-green-600" : ""}>One number</li>
                </ul>
              </div>

              <div className="flex gap-2">
                {allowSkip && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkip}
                    disabled={loading || skipping}
                    className="flex-1 gap-2"
                  >
                    {skipping ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Cancel"}
                  </Button>
                )}
                <Button type="submit" disabled={loading || skipping} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Updating password…</>
                  ) : (
                    <><KeyRound className="h-4 w-4" />Set New Password</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
