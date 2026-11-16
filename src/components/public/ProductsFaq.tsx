"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, HelpCircle } from "lucide-react";

/* Product questions. A mouse opens a row when it moves over it (after a short intent delay) and closes it on leaving
   the list; reacting to movement, not "enter", stops rows sliding under a still cursor from chain-opening. Tap and
   keyboard toggle on click. An answer can point to the product it is about,
   which also fills the space beside its text. */
export default function ProductsFaq({ faqs }: { faqs: { question: string; answer: string; href?: string; cta?: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mouse = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const hover = (i: number | null, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(i), delay);
  };
  return (
    <ul className="rh-faq2-list pd-faq" onMouseLeave={() => mouse.current && hover(null, 200)}>
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <li key={f.question} className="rh-faq2-item" data-open={isOpen}
            onPointerMove={(e) => { mouse.current = e.pointerType === "mouse"; if (mouse.current && !isOpen) hover(i, 120); else if (mouse.current) clearTimeout(timer.current); }}>
            <h3>
              <button type="button" aria-expanded={isOpen} aria-controls={`pd-a-${i}`} id={`pd-q-${i}`} onClick={(e) => { if (!mouse.current || e.detail === 0) setOpen(isOpen ? null : i); }}>
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
