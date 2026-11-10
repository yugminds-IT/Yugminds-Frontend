"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, LogOut, Loader2 } from "lucide-react";
import {
  getImpersonationInfo,
  exitImpersonation,
  type ImpersonationInfo,
} from "@/lib/impersonation";
import { useBannerSpace } from "@/hooks/useBannerSpace";

/**
 * Fixed banner shown while an admin is impersonating another user.
 * Mounted in the student / teacher / school-admin layouts; renders nothing
 * for normal sessions.
 */
export default function ImpersonationBanner() {
  const router = useRouter();
  const [info, setInfo] = useState<ImpersonationInfo | null>(null);
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  useBannerSpace(bar, "bottom", !!info);

  // Read from sessionStorage after mount, so server and client render the same first.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(getImpersonationInfo());
  }, []);

  if (!info) return null;

  const handleExit = async () => {
    setExiting(true);
    setError(null);
    try {
      await exitImpersonation();
      router.push("/lms/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to exit");
      setExiting(false);
    }
  };

  return (
    <div ref={bar} className="sd-banner" data-edge="bottom" data-tone="amber" role="status">
      <UserCog aria-hidden="true" />
      <span>
        Viewing as{" "}
        <strong>{info.targetName || info.targetEmail || "user"}</strong>
        {info.targetRole ? ` (${info.targetRole.replace("_", " ")})` : ""}. You are
        signed in as {info.adminEmail ?? "admin"}.
      </span>
      {error && <span className="sd-banner-err">{error}</span>}
      <button onClick={handleExit} disabled={exiting} className="sd-banner-btn">
        {exiting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        Exit impersonation
      </button>
    </div>
  );
}
