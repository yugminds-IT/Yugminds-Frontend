"use client";

import { useEffect } from "react";
import StatusScreen from "@/components/public/StatusScreen";

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);
  return (
    <StatusScreen
      variant="error"
      title="This page hit a problem."
      text="We couldn't load the sign-in page. Try again, or go back to the start of sign-in."
      detail={[error.message, error.digest && `Reference: ${error.digest}`].filter(Boolean).join("\n") || undefined}
      actions={[{ label: "Try again", onClick: reset }, { label: "Go to sign in", href: "/lms/login", kind: "ghost" }]}
    />
  );
}
