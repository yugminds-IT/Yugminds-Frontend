"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, Loader2, LogOut, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export interface DeviceSession {
  id: string;
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | string;
  ip: string | null;
  location: string;
  lastSeenAt: string;
  current: boolean;
}

export interface SessionsApi {
  list: () => Promise<DeviceSession[]>;
  revoke: (id: string) => Promise<unknown>;
  revokeOthers: () => Promise<unknown>;
  revokeAll: () => Promise<unknown>;
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "Active now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const ICONS = { mobile: Smartphone, tablet: Tablet } as const;

/**
 * "Where you're signed in": every device with a live session, with log out per
 * device and log out everywhere. API-agnostic so LMS and Academy share it.
 * onSignedOut runs after "log out all devices" (which also ends this device).
 */
export function DevicesAndSessions({ api, onSignedOut }: { api: SessionsApi; onSignedOut: () => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await api.list());
      setError("");
    } catch {
      setError("Could not load your devices. Please try again.");
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      await load();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const logOut = async (s: DeviceSession) => {
    const ok = await confirm({
      title: "Log out this device?",
      description: `${s.browser} on ${s.os} will be signed out.`,
      confirmText: "Log out",
      variant: "danger",
    });
    if (ok) await run(s.id, () => api.revoke(s.id), "Device logged out");
  };

  const logOutOthers = async () => {
    const ok = await confirm({
      title: "Log out all other devices?",
      description: "You'll stay signed in here.",
      confirmText: "Log out others",
      variant: "danger",
    });
    if (ok) await run("others", api.revokeOthers, "Other devices logged out");
  };

  const logOutAll = async () => {
    const ok = await confirm({
      title: "Log out of all devices?",
      description: "Every device, including this one, will be signed out.",
      confirmText: "Log out everywhere",
      variant: "danger",
    });
    if (!ok) return;
    setBusy("all");
    try {
      await api.revokeAll();
      onSignedOut();
    } catch {
      setBusy(null);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <section className="space-y-3" aria-labelledby="devices-heading">
      <div>
        <h3 id="devices-heading" className="text-lg font-semibold">
          Devices &amp; sessions
        </h3>
        <p className="text-sm text-gray-500">Where your account is signed in. Log out any device you don&apos;t recognise.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!sessions && !error && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
        </p>
      )}

      <ul className="space-y-2">
        {sessions?.map((s) => {
          const Icon = ICONS[s.deviceType as keyof typeof ICONS] ?? Laptop;
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Icon className="h-6 w-6 shrink-0 text-gray-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.browser} on {s.os}
                  {s.current && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">This device</span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {s.location}
                  {s.ip ? ` · ${s.ip}` : ""} · {ago(s.lastSeenAt)}
                </p>
              </div>
              {!s.current && (
                <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => logOut(s)}>
                  {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log out"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {sessions && (
        <div className="flex flex-wrap gap-2">
          {others > 0 && (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={logOutOthers}>
              Log out all other devices
            </Button>
          )}
          <Button type="button" variant="destructive" disabled={busy !== null} onClick={logOutAll}>
            {busy === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            Log out of all devices
          </Button>
        </div>
      )}
    </section>
  );
}
