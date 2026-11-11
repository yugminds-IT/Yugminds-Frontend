"use client";

import { useState } from "react";
import { ago } from "./notifications";

/** When someone last signed in: "Yesterday", "3 days ago", with the exact time on hover. */
export default function LastSignIn({ at }: { at?: string | null }) {
  const [now] = useState(() => Date.now());
  if (!at) return <span className="sm-chip" data-warn="true">Never signed in</span>;
  const exact = new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  return <span title={`Last signed in ${exact}`}>{ago(at, now)}</span>;
}
