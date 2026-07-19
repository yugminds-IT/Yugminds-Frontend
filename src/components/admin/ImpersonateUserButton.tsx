"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UserCog } from "lucide-react";
import { startImpersonation, impersonationLandingPath } from "@/lib/impersonation";

/** Admin-only "sign in as this user" trigger. */
export default function ImpersonateUserButton({
  userId,
  label = "Sign in as",
}: {
  userId: number | string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const { role } = await startImpersonation(parseInt(String(userId), 10));
      window.location.href = impersonationLandingPath(role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to impersonate");
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Button
        variant="outline"
        size="sm"
        className="border-amber-500 text-amber-700 hover:bg-amber-50"
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserCog className="h-4 w-4 mr-1" />}
        {label}
      </Button>
    </div>
  );
}
