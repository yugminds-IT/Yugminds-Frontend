"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  XCircle,
  Loader2,
  Lock,
  AlertCircle,
} from "lucide-react";
import { commonApi, authApi, setAuthToken } from "@/lib/api";
import { getSession, getStoredUserId } from "@/lib/session-utils";

type PasswordVisibility = { current: boolean; new: boolean; confirm: boolean };
type CurrentPasswordStatus = null | "checking" | "valid" | "invalid";

function StudentSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceChange = searchParams.get("force_change") === "true";

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profileData, setProfileData] = useState({ full_name: "", email: "" });
  const [extraInfo, setExtraInfo] = useState<{ school?: string; grade?: string; joining_code?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordFields, setPasswordFields] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [showPassword, setShowPassword] = useState<PasswordVisibility>({ current: false, new: false, confirm: false });
  const [currentPasswordStatus, setCurrentPasswordStatus] = useState<CurrentPasswordStatus>(null);
  const verifyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUserData = useCallback(async () => {
    try {
      const userId = getStoredUserId();
      const { data: sessionData } = await getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) setAuthToken(accessToken);

      if (!userId) { router.push("/lms/login"); return; }

      const authUser = { id: userId, email: sessionData.session?.user?.email } as { id: string; email?: string };

      const { data: profileResp } = await commonApi.profile.get({ userId: authUser.id });
      const profile = (profileResp as { profile?: unknown })?.profile ?? profileResp;

      setUser(authUser);
      setProfileData({
        full_name: (profile as { full_name?: string })?.full_name || "",
        email: authUser.email || "",
      });

      const p = profile as { students?: Array<{ schools?: Array<{ name?: string }>; grade?: string; joining_code?: string }> };
      setExtraInfo({
        school: p?.students?.[0]?.schools?.[0]?.name,
        grade: p?.students?.[0]?.grade,
        joining_code: p?.students?.[0]?.joining_code,
      });

      setPasswordFields({ current_password: "", new_password: "", confirm_password: "" });
      setCurrentPasswordStatus(null);
    } catch (error) {
      console.error("Error fetching user:", error);
      router.push("/lms/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const verifyCurrentPassword = useCallback(async (password: string) => {
    if (!password) { setCurrentPasswordStatus(null); return; }
    setCurrentPasswordStatus("checking");
    try {
      const { data } = await authApi.verifyPassword({ current_password: password });
      setCurrentPasswordStatus(data.valid ? "valid" : "invalid");
    } catch {
      setCurrentPasswordStatus("invalid");
    }
  }, []);

  const handleCurrentPasswordChange = (value: string) => {
    setPasswordFields(prev => ({ ...prev, current_password: value, new_password: "", confirm_password: "" }));
    setCurrentPasswordStatus(null);
    if (verifyDebounceRef.current) clearTimeout(verifyDebounceRef.current);
    if (value) verifyDebounceRef.current = setTimeout(() => verifyCurrentPassword(value), 600);
  };

  const handleSave = async () => {
    if (!user) { setMessage({ type: "error", text: "User data not loaded. Please refresh." }); return; }
    if (!profileData.full_name.trim()) { setMessage({ type: "error", text: "Full name is required." }); return; }

    if (passwordFields.new_password) {
      if (!passwordFields.current_password) { setMessage({ type: "error", text: "Please enter your current password to change it." }); return; }
      if (currentPasswordStatus !== "valid") { setMessage({ type: "error", text: "Current password is incorrect." }); return; }
      if (passwordFields.new_password !== passwordFields.confirm_password) { setMessage({ type: "error", text: "New passwords do not match." }); return; }
      const { validatePasswordClient } = await import("@/lib/password-validation");
      const passwordError = validatePasswordClient(passwordFields.new_password);
      if (passwordError) { setMessage({ type: "error", text: passwordError }); return; }
    }

    setSaving(true);
    setMessage(null);

    try {
      await commonApi.profile.update({ full_name: profileData.full_name.trim() });

      if (passwordFields.new_password && currentPasswordStatus === "valid") {
        await authApi.updatePassword({ current_password: passwordFields.current_password, new_password: passwordFields.new_password });
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setPasswordFields({ current_password: "", new_password: "", confirm_password: "" });
      setCurrentPasswordStatus(null);

      if (forceChange) {
        setTimeout(() => router.push("/lms/student"), 2000);
      } else {
        await loadUserData();
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: unknown) {
      const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (error instanceof Error ? error.message : "Unknown error");
      setMessage({ type: "error", text: `Error updating profile: ${errMsg}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const newPasswordDisabled = !passwordFields.current_password || currentPasswordStatus !== "valid";

  const CurrentPasswordIcon = () => {
    if (!passwordFields.current_password) return null;
    if (currentPasswordStatus === "checking") return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    if (currentPasswordStatus === "valid") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (currentPasswordStatus === "invalid") return <XCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account settings</p>
      </div>

      {forceChange && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">Password Change Required</p>
                <p className="text-sm text-orange-700 mt-1">
                  For security reasons, you must change your temporary password before accessing your account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {message && (
        <div className={`p-4 rounded-md flex items-center justify-between ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          <div className="flex items-center">
            {message.type === "success" ? <CheckCircle className="h-5 w-5 mr-2" /> : <AlertTriangle className="h-5 w-5 mr-2" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="mr-2 h-5 w-5" />
            Student Profile
          </CardTitle>
          <CardDescription>Update your personal information and password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={profileData.full_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-500">Email Address</Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                <span className="flex-1 text-sm text-gray-500">{profileData.email}</span>
                <Lock className="h-4 w-4 text-gray-400 shrink-0" />
              </div>
              <p className="text-xs text-gray-400">Email is fixed and cannot be changed</p>
            </div>
          </div>

          {(extraInfo.school || extraInfo.grade || extraInfo.joining_code) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {extraInfo.school && (
                <div className="space-y-2">
                  <Label className="text-gray-500">School</Label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                    <span className="flex-1 text-sm text-gray-500">{extraInfo.school}</span>
                    <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                  </div>
                </div>
              )}
              {extraInfo.grade && (
                <div className="space-y-2">
                  <Label className="text-gray-500">Grade</Label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                    <span className="flex-1 text-sm text-gray-500">{extraInfo.grade}</span>
                    <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                  </div>
                </div>
              )}
              {extraInfo.joining_code && (
                <div className="space-y-2">
                  <Label className="text-gray-500">Joining Code</Label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                    <span className="flex-1 text-sm text-gray-500 font-mono">{extraInfo.joining_code}</span>
                    <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Change Password</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current_password"
                    type={showPassword.current ? "text" : "password"}
                    value={passwordFields.current_password}
                    onChange={(e) => handleCurrentPasswordChange(e.target.value)}
                    placeholder="Enter current password"
                    className="pr-16"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                    <CurrentPasswordIcon />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => ({ ...p, current: !p.current }))}
                      className="text-gray-400 hover:text-gray-600 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {currentPasswordStatus === "invalid" && passwordFields.current_password && (
                  <p className="text-xs text-red-500">Incorrect password</p>
                )}
                {currentPasswordStatus === "valid" && (
                  <p className="text-xs text-green-600">Password verified</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password" className={newPasswordDisabled ? "text-gray-400" : ""}>
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showPassword.new ? "text" : "password"}
                    value={passwordFields.new_password}
                    onChange={(e) => setPasswordFields(p => ({ ...p, new_password: e.target.value }))}
                    placeholder="Enter new password"
                    disabled={newPasswordDisabled}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => ({ ...p, new: !p.new }))}
                    disabled={newPasswordDisabled}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-40"
                    tabIndex={-1}
                  >
                    {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPasswordDisabled && <p className="text-xs text-gray-400">Verify current password first</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password" className={newPasswordDisabled ? "text-gray-400" : ""}>
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showPassword.confirm ? "text" : "password"}
                    value={passwordFields.confirm_password}
                    onChange={(e) => setPasswordFields(p => ({ ...p, confirm_password: e.target.value }))}
                    placeholder="Confirm new password"
                    disabled={newPasswordDisabled}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => ({ ...p, confirm: !p.confirm }))}
                    disabled={newPasswordDisabled}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-40"
                    tabIndex={-1}
                  >
                    {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordFields.confirm_password && passwordFields.new_password && passwordFields.confirm_password !== passwordFields.new_password && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
                {passwordFields.confirm_password && passwordFields.new_password && passwordFields.confirm_password === passwordFields.new_password && (
                  <p className="text-xs text-green-600">Passwords match</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StudentSettings() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <StudentSettingsInner />
    </Suspense>
  );
}
