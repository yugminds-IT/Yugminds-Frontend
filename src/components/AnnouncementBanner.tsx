"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

interface Announcement {
  enabled: boolean;
  text: string;
  level: "info" | "warning" | "critical";
}

const LEVEL_CLS: Record<Announcement["level"], string> = {
  info: "bg-blue-600 text-white",
  warning: "bg-amber-500 text-amber-950",
  critical: "bg-red-600 text-white",
};

const DISMISS_KEY = "announcement_dismissed";

/**
 * Platform announcement banner controlled from Admin → System Controls.
 * Fetches the public /system-status endpoint; dismissal is remembered per
 * message per session.
 */
export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
    fetch(`${base}/system-status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { announcement?: Announcement } | null) => {
        if (cancelled || !data?.announcement?.enabled || !data.announcement.text) return;
        const a = data.announcement;
        try {
          if (sessionStorage.getItem(DISMISS_KEY) === a.text) {
            setDismissed(true);
          }
        } catch {
          // sessionStorage unavailable — show the banner anyway
        }
        setAnnouncement(a);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || dismissed) return null;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[55] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium shadow-md ${LEVEL_CLS[announcement.level] ?? LEVEL_CLS.info}`}
      role="status"
    >
      <Megaphone className="h-4 w-4 flex-shrink-0" />
      <span>{announcement.text}</span>
      <button
        aria-label="Dismiss announcement"
        className="ml-2 opacity-80 hover:opacity-100"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, announcement.text);
          } catch {
            // non-fatal
          }
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
