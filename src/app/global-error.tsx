"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import StatusScreen from "../components/public/StatusScreen";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("Global Error:", error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <StatusScreen
          variant="critical"
          title="The site hit a serious problem."
          text="Something broke while loading. Try again, and if it still doesn't work, come back in a few minutes."
          detail={[error?.message, error?.digest && `Reference: ${error.digest}`].filter(Boolean).join("\n") || undefined}
          actions={[{ label: "Try again", onClick: reset }, { label: "Go home", href: "/", kind: "ghost" }]}
        />
      </body>
    </html>
  );
}
