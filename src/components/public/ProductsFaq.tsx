"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, HelpCircle } from "lucide-react";

/* Product questions. Click, tap or keyboard toggles; hover never does, because rows move as answers open and a passing
   cursor would chain-open them. An answer can point to the product it is about,
   which also fills the space beside its text. */
export default function ProductsFaq({ faqs }: { faqs: { question: string; answer: string; href?: string; cta?: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="rh-faq2-list pd-faq">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <li key={f.question} className="rh-faq2-item" data-open={isOpen}>
            <h3>
              <button type="button" aria-expanded={isOpen} aria-controls={`pd-a-${i}`} id={`pd-q-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span className="rh-faq2-ico"><HelpCircle size={16} aria-hidden="true" /></span>
                <span className="rh-faq2-q">{f.question}</span>
                <span className="rh-faq2-plus"><Plus size={18} aria-hidden="true" /></span>
              </button>
            </h3>
            <div className="rh-faq2-a" id={`pd-a-${i}`} role="region" aria-labelledby={`pd-q-${i}`}>
              <div className="pd-faq-a">
                <p>{f.answer}</p>
                {f.href && <Link href={f.href} className="rh-btn rh-btn--ghost pd-faq-go" tabIndex={isOpen ? 0 : -1}>{f.cta}</Link>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
