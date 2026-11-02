"use client";

import { ArrowUp } from "lucide-react";

/* A small droid rolls along the footer's top edge; the button takes visitors back to the top. */
export default function FooterTop() {
  return (
    <div className="rf-road" aria-hidden="false">
      <div className="rf-rolling" aria-hidden="true">
        <div className="rf-lane">
          <div className="droid-mini rf-droid">
            <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
            <div className="droid__body" />
          </div>
        </div>
      </div>
      <button type="button" className="rf-top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
        Back to top <ArrowUp size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
