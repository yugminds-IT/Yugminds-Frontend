"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Copy, Eye, EyeOff, Loader2, Lock, XCircle } from "lucide-react";
import { authApi, setAuthToken } from "@/lib/api";
import { clearStoredSession, getSession, getStoredUserId, setLogoutReason } from "@/lib/session-utils";
import { useBeforeUnloadWhenDirty } from "@/hooks/useUnsavedCloseGuard";
import PasswordCoach from "./PasswordCoach";
import DevicesList from "./DevicesList";

/** What differs between roles: where the profile comes from, who may see the page, and how it is saved. */
export interface LoadResult {
  /** set to send the wrong role to another page instead of showing this one */
  redirect?: string;
  fullName: string;
  prefs: Record<string, boolean>;
  raw?: unknown;
}

export interface AccountAdapter {
  load: (userId: string) => Promise<LoadResult>;
  /** gets `full_name` plus every switch, by key */
  save: (data: Record<string, string | boolean>) => Promise<unknown>;
}

export interface PrefSpec {
  key: string;
  label: string;
  description: string;
}

export interface DetailRow {
  label: string;
  value: string;
  /** shown as a code, with a copy button */
  code?: boolean;
}

interface Props {
  adapter: AccountAdapter;
  /** the notification switches this role has */
  prefs: PrefSpec[];
  /** the line under the name in the hero */
  intro?: string;
  /** read-only rows for the details card; the email is always first */
  details?: (raw: unknown) => { where?: string; rows: DetailRow[] };
  /** an extra panel under the form (for example a teacher's schools) */
  aside?: React.ReactNode;
  /** a notice at the top, shown when someone was sent here to change a temporary password */
  forceChange?: boolean;
  /** runs after a successful save; return true to skip the usual reload (the caller is navigating away) */
  afterSave?: () => boolean | void;
}

type PasswordVisibility = { current: boolean; new: boolean; confirm: boolean };
type CurrentPasswordStatus = null | "checking" | "valid" | "invalid";

const initialsOf = (name: string) => name.split(" ").filter(Boolean).map((p) => p[0]).join("").toUpperCase().slice(0, 2) || "U";

/**
 * Account settings for every dashboard: your name, your password (with a live check and a strength coach), the
 * notifications you want, and where you are signed in. One look, one save flow. Roles plug in through the adapter.
 */
export default function AccountSettings({ adapter, prefs, intro, details, aside, forceChange = false, afterSave }: Props) {
  const router = useRouter();
  const defaults = Object.fromEntries(prefs.map((p) => [p.key, true])) as Record<string, boolean>;

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [raw, setRaw] = useState<unknown>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>(defaults);
  const [initial, setInitial] = useState<{ full_name: string; prefs: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordFields, setPasswordFields] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [showPassword, setShowPassword] = useState<PasswordVisibility>({ current: false, new: false, confirm: false });
  const [currentPasswordStatus, setCurrentPasswordStatus] = useState<CurrentPasswordStatus>(null);
  const verifyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Warn before the tab closes with edits that are not saved.
  const dirtyForGuard = !!initial && (fullName !== initial.full_name || JSON.stringify(notificationPrefs) !== initial.prefs || !!passwordFields.new_password);
  useBeforeUnloadWhenDirty(dirtyForGuard);

  const loadUserData = useCallback(async () => {
    try {
      const userId = getStoredUserId();
      const { data: sessionData } = await getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken) setAuthToken(accessToken);

      setLogoutReason("session_expired");
      if (!userId) { router.push("/lms/login"); return; }

      const authUser = { id: userId, email: sessionData.session?.user?.email } as { id: string; email?: string };
      const res = await adapter.load(userId);
      if (res.redirect) { router.push(res.redirect); return; }

      const merged = { ...defaults, ...res.prefs };
      setUser(authUser);
      setFullName(res.fullName);
      setEmail(authUser.email || "");
      setRaw(res.raw ?? null);
      setNotificationPrefs(merged);
      setInitial({ full_name: res.fullName, prefs: JSON.stringify(merged) });
      setPasswordFields({ current_password: "", new_password: "", confirm_password: "" });
      setCurrentPasswordStatus(null);
    } catch (error) {
      console.error("Error fetching user:", error);
      setLogoutReason("session_expired");
      router.push("/lms/login");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adapter and prefs are stable per page
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
    setPasswordFields((prev) => ({ ...prev, current_password: value, new_password: "", confirm_password: "" }));
    setCurrentPasswordStatus(null);
    if (verifyDebounceRef.current) clearTimeout(verifyDebounceRef.current);
    if (value) verifyDebounceRef.current = setTimeout(() => verifyCurrentPassword(value), 600);
  };

  const handleSave = async () => {
    if (!user) { setMessage({ type: "error", text: "Your details did not load. Refresh the page." }); return; }
    if (!fullName.trim()) { setMessage({ type: "error", text: "Add your name first." }); return; }

    if (passwordFields.new_password) {
      if (!passwordFields.current_password) { setMessage({ type: "error", text: "Type your current password to change it." }); return; }
      if (currentPasswordStatus !== "valid") { setMessage({ type: "error", text: "Your current password is not right." }); return; }
      if (passwordFields.new_password !== passwordFields.confirm_password) { setMessage({ type: "error", text: "The two new passwords are different." }); return; }
      const { validatePasswordClient } = await import("@/lib/password-validation");
      const passwordError = validatePasswordClient(passwordFields.new_password);
      if (passwordError) { setMessage({ type: "error", text: passwordError }); return; }
    }

    setSaving(true);
    setMessage(null);

    let nameSaved = false;
    try {
      await adapter.save({ full_name: fullName.trim(), ...notificationPrefs });
      nameSaved = true;

      if (passwordFields.new_password && currentPasswordStatus === "valid") {
        const res = await authApi.updatePassword({ current_password: passwordFields.current_password, new_password: passwordFields.new_password });
        // Changing the password bumps tokenVersion server-side (invalidates the token this very request used), so swap in
        // the freshly issued access token or the reload below would 401 straight after a successful save.
        const newAccessToken = (res.data as { tokens?: { accessToken?: string } })?.tokens?.accessToken;
        if (newAccessToken) setAuthToken(newAccessToken);
      }

      setMessage({ type: "success", text: "Your changes are saved." });
      setPasswordFields({ current_password: "", new_password: "", confirm_password: "" });
      setCurrentPasswordStatus(null);

      if (afterSave?.()) return;
      await loadUserData();
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (error instanceof Error ? error.message : "Unknown error");
      // If the name already saved, the password step is what failed: say so rather than imply nothing was saved.
      setMessage({
        type: "error",
        text: nameSaved ? `Your name was saved, but your password was not changed. ${errMsg}` : `Your changes were not saved. ${errMsg}`,
      });
      if (nameSaved) await loadUserData();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sd-page" aria-busy="true">
        <div className="sd-skel" style={{ height: "14rem" }} />
        <div className="sd-skel" style={{ height: "10rem" }} />
      </div>
    );
  }

  const newPasswordDisabled = !passwordFields.current_password || currentPasswordStatus !== "valid";
  const dirty = dirtyForGuard;
  const mismatch = !!passwordFields.confirm_password && !!passwordFields.new_password && passwordFields.confirm_password !== passwordFields.new_password;
  const matches = !!passwordFields.confirm_password && !!passwordFields.new_password && !mismatch;
  const info = details ? details(raw) : { rows: [] as DetailRow[] };
  const shownName = fullName.trim() || "Your name";

  const discard = () => {
    if (!initial) return;
    setFullName(initial.full_name);
    setNotificationPrefs(JSON.parse(initial.prefs));
    setPasswordFields({ current_password: "", new_password: "", confirm_password: "" });
    setCurrentPasswordStatus(null);
    setMessage(null);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the text is still on screen */ }
  };

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="st-title">
        <div className="sd-hero-copy">
          <h1 id="st-title" className="mc-hero-title">Settings</h1>
          <div className="st-hero-id">
            <span className="st-avatar" aria-hidden="true">{initialsOf(shownName)}</span>
            <div>
              <p className="sd-status" style={{ margin: 0 }}><strong>{shownName}</strong></p>
              {info.where && <p className="sd-where" style={{ margin: "0.2rem 0 0" }}>{info.where}</p>}
            </div>
          </div>
          <p className="sd-where">{intro ?? "Change your name, your password and what you hear about."}</p>
        </div>
        <div className="sd-run-card" style={{ marginTop: 0 }}>
          <dl className="st-details" aria-label="Details that are kept for you">
            <div><dt><Lock aria-hidden="true" />Email</dt><dd>{email || "—"}</dd></div>
            {info.rows.map((r) => (
              <div key={r.label}>
                <dt><Lock aria-hidden="true" />{r.label}</dt>
                <dd>
                  {r.code ? <code>{r.value}</code> : r.value}
                  {r.code && (
                    <button className="st-copy" onClick={() => copy(r.value)} aria-label={copied ? "Copied" : `Copy ${r.label.toLowerCase()}`} title={copied ? "Copied" : "Copy"}>
                      {copied ? <Check /> : <Copy />}
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="sd-run-foot"><span>These are kept for you and cannot be changed here.</span></div>
        </div>
      </section>

      {forceChange && (
        <div className="ls-note" data-t="warn" role="alert">
          <b>Set a new password to continue</b>
          <p>You signed in with a temporary password. Choose your own below.</p>
        </div>
      )}

      {message && (
        <div className="ls-note" data-t={message.type === "error" ? "late" : undefined} role={message.type === "error" ? "alert" : "status"} style={message.type === "success" ? { background: "rgb(251 191 36 / 0.16)", borderColor: "var(--sd-amber-deep)" } : undefined}>
          <b>{message.type === "success" ? "Saved" : "Not saved"}</b>
          <p>{message.text}</p>
        </div>
      )}

      <div className="st-grid">
        <div className="st-col">
          <section className="sd-panel" aria-labelledby="st-you">
            <div className="sd-panel-head"><div><h2 id="st-you">About you</h2><p>This is the name other people see.</p></div></div>
            <div className="st-fields">
              <div className="sd-field-wrap">
                <label htmlFor="full_name">Your name</label>
                <input id="full_name" className="sd-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Type your full name" autoComplete="name" />
              </div>
            </div>
          </section>

          <section className="sd-panel" aria-labelledby="st-notes">
            <div className="sd-panel-head"><div><h2 id="st-notes">What you hear about</h2><p>Choose which messages show up in your notifications. We do not send emails.</p></div></div>
            <div>
              {prefs.map((item) => (
                <div key={item.key} className="st-pref">
                  <div>
                    <b id={`${item.key}-l`}>{item.label}</b>
                    <span>{item.description}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!notificationPrefs[item.key]}
                    aria-labelledby={`${item.key}-l`}
                    className="st-switch"
                    onClick={() => setNotificationPrefs((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="sd-panel" aria-labelledby="st-pw">
          <div className="sd-panel-head"><div><h2 id="st-pw">Change your password</h2><p>First type the one you use now. Then pick a new one.</p></div></div>
          <div className="st-fields">
            <div className="sd-field-wrap">
              <label htmlFor="current_password">Current password</label>
              <div className="st-input">
                <input
                  id="current_password"
                  className="sd-field"
                  type={showPassword.current ? "text" : "password"}
                  value={passwordFields.current_password}
                  onChange={(e) => handleCurrentPasswordChange(e.target.value)}
                  placeholder="The password you use now"
                  autoComplete="current-password"
                />
                <div className="st-input-r">
                  {passwordFields.current_password && currentPasswordStatus === "checking" && <Loader2 className="animate-spin" aria-label="Checking" />}
                  {currentPasswordStatus === "valid" && <CheckCircle2 aria-label="Correct" color="var(--sd-amber-deep)" />}
                  {currentPasswordStatus === "invalid" && passwordFields.current_password && <XCircle aria-label="Not right" color="var(--sd-late)" />}
                  <button type="button" className="st-eye" onClick={() => setShowPassword((p) => ({ ...p, current: !p.current }))} aria-label={showPassword.current ? "Hide password" : "Show password"}>
                    {showPassword.current ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              {currentPasswordStatus === "invalid" && passwordFields.current_password && <p className="st-hint" data-t="bad">That is not your password.</p>}
              {currentPasswordStatus === "valid" && <p className="st-hint" data-t="good">Correct. Now pick a new one.</p>}
            </div>

            <div className="sd-field-wrap">
              <label htmlFor="new_password">New password</label>
              <div className="st-input">
                <input
                  id="new_password"
                  className="sd-field"
                  type={showPassword.new ? "text" : "password"}
                  value={passwordFields.new_password}
                  onChange={(e) => setPasswordFields((p) => ({ ...p, new_password: e.target.value }))}
                  placeholder="Type a new password"
                  disabled={newPasswordDisabled}
                  autoComplete="new-password"
                />
                <div className="st-input-r">
                  <button type="button" className="st-eye" disabled={newPasswordDisabled} onClick={() => setShowPassword((p) => ({ ...p, new: !p.new }))} aria-label={showPassword.new ? "Hide password" : "Show password"}>
                    {showPassword.new ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              {newPasswordDisabled && <p className="st-hint">Type your current password first.</p>}
            </div>

            {!newPasswordDisabled && <PasswordCoach password={passwordFields.new_password} />}

            <div className="sd-field-wrap">
              <label htmlFor="confirm_password">Type it again</label>
              <div className="st-input">
                <input
                  id="confirm_password"
                  className="sd-field"
                  type={showPassword.confirm ? "text" : "password"}
                  value={passwordFields.confirm_password}
                  onChange={(e) => setPasswordFields((p) => ({ ...p, confirm_password: e.target.value }))}
                  placeholder="Type the same password"
                  disabled={newPasswordDisabled}
                  autoComplete="new-password"
                />
                <div className="st-input-r">
                  <button type="button" className="st-eye" disabled={newPasswordDisabled} onClick={() => setShowPassword((p) => ({ ...p, confirm: !p.confirm }))} aria-label={showPassword.confirm ? "Hide password" : "Show password"}>
                    {showPassword.confirm ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              {mismatch && <p className="st-hint" data-t="bad">The two passwords are different.</p>}
              {matches && <p className="st-hint" data-t="good">They match.</p>}
            </div>
          </div>
        </section>
      </div>

      {aside}

      <section className="sd-panel" aria-labelledby="st-dev">
        <div className="sd-panel-head"><div><h2 id="st-dev">Where you are signed in</h2><p>Log out any device you do not recognise.</p></div></div>
        <DevicesList
          api={authApi.sessions}
          onSignedOut={() => {
            // Same exit as the sidebar logout: reason first so the session check cannot overwrite it.
            setLogoutReason("logged_out");
            clearStoredSession(true, "logged_out");
            window.location.href = "/lms/login";
          }}
        />
      </section>

      {dirty && (
        <div className="st-save" role="status">
          <b>You have changes that are not saved</b>
          <div className="st-save-acts">
            <button className="sd-btn sd-btn--line" onClick={discard} disabled={saving}>Discard</button>
            <button className="sd-btn sd-btn--amber" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
