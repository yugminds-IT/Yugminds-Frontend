"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCog, LogOut, Loader2 } from "lucide-react";
import {
  getImpersonationInfo,
  exitImpersonation,
  type ImpersonationInfo,
} from "@/lib/impersonation";

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

  useEffect(() => {
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
    <div className="fixed bottom-0 inset-x-0 z-[60] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-[0_-2px_8px_rgba(0,0,0,0.15)]">
      <UserCog className="h-4 w-4 flex-shrink-0" />
      <span>
        Viewing as{" "}
        <strong>{info.targetName || info.targetEmail || "user"}</strong>
        {info.targetRole ? ` (${info.targetRole.replace("_", " ")})` : ""} — you are
        signed in as {info.adminEmail ?? "admin"}
      </span>
      {error && <span className="text-red-900">· {error}</span>}
      <button
        onClick={handleExit}
        disabled={exiting}
        className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-60"
      >
        {exiting ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
        Exit impersonation
      </button>
    </div>
  );
}
