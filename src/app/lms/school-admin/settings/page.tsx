"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { commonApi, authApi, setAuthToken } from "@/lib/api";
import { schoolAdminApi } from "@/lib/api/school-admin.api";
import { getSession, getStoredUserId, setLogoutReason } from "@/lib/session-utils";

type PasswordVisibility = { current: boolean; new: boolean; confirm: boolean };
type CurrentPasswordStatus = null | "checking" | "valid" | "invalid";

export default function SchoolAdminSettings() {
  const router = useRouter();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profileData, setProfileData] = useState({ full_name: "", email: "" });
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

      setLogoutReason('session_expired');
      if (!userId) { router.push("/lms/login"); return; }

      const authUser = { id: userId, email: sessionData.session?.user?.email } as { id: string; email?: string };

      const { data: roleData } = await commonApi.getRole(authUser.id);
      const role = String((roleData as { role?: string })?.role ?? "").trim().toLowerCase();
      if (role !== "school_admin") { router.push("/lms/redirect"); return; }

      const { data: profileResp } = await schoolAdminApi.profile.get();
      const profileData = profileResp as { full_name?: string; profile?: { full_name?: string } };
      const fullName = profileData?.full_name ?? profileData?.profile?.full_name ?? "";

      setUser(authUser);
      setProfileData({
        full_name: fullName,
        email: authUser.email || "",
      });

      setPasswordFields({ current_password: "", new_password: "", confirm_password: "" });
      setCurrentPasswordStatus(null);
    } catch (error) {
      console.error("Error fetching user:", error);
      setLogoutReason('session_expired');
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

    let nameSaved = false;
    try {
      await schoolAdminApi.profile.update({ full_name: profileData.full_name.trim() });
      nameSaved = true;

      if (passwordFields.new_password && currentPasswordStatus === "valid") {
        const res = await authApi.updatePassword({ current_password: passwordFields.current_password, new_password: passwordFields.new_password });
        // Changing password bumps tokenVersion server-side (invalidates the
        // token this very request was authenticated with) — swap in the
        // freshly-issued access token so subsequent calls on this page
        // don't 401 immediately after a successful save.
        const newAccessToken = (res.data as { tokens?: { accessToken?: string } })?.tokens?.accessToken;
        if (newAccessToken) setAuthToken(newAccessToken);
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setPasswordFields({ current_password: "", new_password: "", confirm_password: "" });
      setCurrentPasswordStatus(null);
      await loadUserData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (error instanceof Error ? error.message : "Unknown error");
      // If the name update already succeeded, the password step is what
      // failed — say so explicitly rather than implying nothing was saved.
      setMessage({
        type: "error",
        text: nameSaved
          ? `Name saved, but the password change failed: ${errMsg}`
          : `Error updating profile: ${errMsg}`,
      });
      if (nameSaved) await loadUserData();
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account settings</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-md flex items-center justify-between ${
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
            School Admin Profile
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
