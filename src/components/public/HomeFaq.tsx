"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Cpu, MessageCircle, Plus, School, Wallet, type LucideIcon } from "lucide-react";
import { brandHref } from "@/lib/brand-host";

import { FAQS, type FaqCat as Cat } from "./home-faq-data";
const CATS: { id: Cat; label: string; Icon: LucideIcon }[] = [
  { id: "start", label: "Getting started", Icon: BookOpen },
  { id: "plans", label: "Plans and access", Icon: Wallet },
  { id: "schools", label: "Schools", Icon: School },
  { id: "kits", label: "Kits and software", Icon: Cpu },
];


/* FAQ: filter by topic and one answer open at a time with a smooth slide. Click, tap or keyboard toggles; hover never
   does, because the rows move as answers open and a passing cursor would chain-open them. The heading, topics,
   questions and the ask bar rise in once as the section scrolls into view. */
export default function HomeFaq() {
  const [cat, setCat] = useState<Cat>("start");
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setSeen(true);
      setOpen((o) => o ?? 0); // the first answer opens as the section arrives, to show what the list does
      io.disconnect();
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const shown = FAQS.map((f, i) => ({ ...f, i })).filter((f) => f.cat === cat);
  const Icon = CATS.find((x) => x.id === cat)!.Icon;

  return (
    <section className="rh-sec" aria-labelledby="rh-faq">
      <div className="rh-wrap rh-faq3" ref={box} data-seen={seen}>
        <div className="rh-faq3-head">
          <h2 id="rh-faq">Questions, answered.</h2>
          <p className="rh-lede">Pick a topic to see the questions families and schools ask most.</p>
          <div className="rh-faq2-cats" role="group" aria-label="Question topics">
            {CATS.map(({ id, label, Icon }) => (
              <button key={id} type="button" aria-pressed={cat === id} onClick={() => { setCat(id); setOpen(null); }}>
                <Icon size={16} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </div>

        <ul className="rh-faq2-list" key={cat}>
          {shown.map((f, k) => {
            const isOpen = open === f.i;
            return (
              <li key={f.q} className="rh-faq2-item" data-open={isOpen} style={{ "--i": k } as React.CSSProperties}>
                <h3>
                  <button type="button" aria-expanded={isOpen} aria-controls={`faq-a-${f.i}`} id={`faq-q-${f.i}`} onClick={() => setOpen(isOpen ? null : f.i)}>
                    <span className="rh-faq2-ico"><Icon size={16} aria-hidden="true" /></span>
                    <span className="rh-faq2-q">{f.q}</span>
                    <span className="rh-faq2-plus"><Plus size={18} aria-hidden="true" /></span>
                  </button>
                </h3>
                <div className="rh-faq2-a" id={`faq-a-${f.i}`} role="region" aria-labelledby={`faq-q-${f.i}`}>
                  <div><p>{f.a}</p></div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="rh-faq3-ask">
          <span><MessageCircle size={22} aria-hidden="true" /></span>
          <div>
            <h3>Still have a question?</h3>
            <p>Talk to our team. We reply to every message.</p>
          </div>
          <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--primary">Contact us</Link>
        </div>
      </div>
    </section>
  );
}
