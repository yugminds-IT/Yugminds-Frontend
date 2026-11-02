"use client";

import { useEffect } from "react";
import StatusScreen from "@/components/public/StatusScreen";

export default function TeacherError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Teacher dashboard error:", error);
  }, [error]);
  return (
    <StatusScreen
      variant="error"
      title="This page hit a problem."
      text="We couldn't load the teacher dashboard. Try again, and if it keeps happening, tell your administrator or contact support."
      tips={["Refresh the page", "Check your internet connection", "Clear your browser cache and cookies"]}
      detail={[error.message, error.digest && `Reference: ${error.digest}`].filter(Boolean).join("\n") || undefined}
      actions={[{ label: "Try again", onClick: reset }, { label: "Go to dashboard", href: "/lms/teacher", kind: "ghost" }]}
    />
  );
}
