"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { focus } from "./JobDetail";

const btn = `inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-ym-text hover:border-ym-blue ${focus}`;

export default function ShareRole({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  const url = () => window.location.href.split(/[?#]/)[0];
  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {}
  }
  const open = (to: string) => window.open(to, "_blank", "noopener,noreferrer");
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share this role">
      <span className="w-full text-sm text-slate-600">Share this role</span>
      <button type="button" onClick={() => void copy()} className={btn}><Link2 className="size-4" aria-hidden />{done ? "Copied" : "Copy link"}</button>
      <button type="button" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${title} at YugMinds: ${url()}`)}`)} className={btn}>WhatsApp</button>
      <button type="button" onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url())}`)} className={btn}>LinkedIn</button>
    </div>
  );
}
