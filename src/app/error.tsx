"use client";

import { useEffect } from "react";
import StatusScreen from "../components/public/StatusScreen";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Error:", error);
  }, [error]);
  return (
    <StatusScreen
      variant="error"
      title="Something went wrong."
      text="That page hit a problem on our side. Try again, and if it keeps happening, let us know and we'll fix it."
      detail={[error.message, error.digest && `Reference: ${error.digest}`].filter(Boolean).join("\n") || undefined}
      actions={[{ label: "Try again", onClick: reset }, { label: "Go home", href: "/", kind: "ghost" }]}
    />
  );
}
