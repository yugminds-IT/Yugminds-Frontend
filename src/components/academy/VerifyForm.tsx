"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Looks a certificate up by the ID printed on it. */
export function VerifyForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [id, setId] = useState("");
  return (
    <form
      className="ac-verify"
      onSubmit={(e) => {
        e.preventDefault();
        const v = id.trim();
        if (v) router.push(`/academy/verify/${encodeURIComponent(v)}`);
      }}
    >
      <label htmlFor="ac-cert-id" className="sr-only">Certificate ID</label>
      <input id="ac-cert-id" value={id} onChange={(e) => setId(e.target.value)} placeholder="Certificate ID" autoComplete="off" autoFocus={autoFocus} />
      <button type="submit" className="rh-btn rh-btn--primary" disabled={!id.trim()}>Verify</button>
    </form>
  );
}
