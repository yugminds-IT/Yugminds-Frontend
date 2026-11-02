"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Cpu, MessageCircle, Plus, School, Wallet, type LucideIcon } from "lucide-react";
import { brandHref } from "@/lib/brand-host";

type Cat = "start" | "plans" | "schools" | "kits";
const CATS: { id: Cat; label: string; Icon: LucideIcon }[] = [
  { id: "start", label: "Getting started", Icon: BookOpen },
  { id: "plans", label: "Plans and access", Icon: Wallet },
  { id: "schools", label: "Schools", Icon: School },
  { id: "kits", label: "Kits and software", Icon: Cpu },
];

// Every answer restates something already on the site (programs, products, for-schools and for-parents pages).
const FAQS: { cat: Cat; q: string; a: string }[] = [
  { cat: "start", q: "What ages do you teach?", a: "Programs cover ages 6 to 18, from beginner to advanced. The offline Studio software is for ages 8 and above." },
  { cat: "start", q: "What will my child learn?", a: "Three tracks: coding fundamentals with block and text programming, robotics and electronics with Arduino, ESP32 and sensors, and AI and machine learning basics taught by building apps that decide." },
  { cat: "start", q: "How long is a program?", a: "Programs run 8 to 12 weeks, from beginner to advanced." },
  { cat: "start", q: "Can we try a class first?", a: "Yes. Start with a free trial class, meet a tutor one on one, then choose the program that fits." },
  { cat: "plans", q: "Does my child need internet?", a: "RoboCoders Studio has an offline version that works without internet, made for schools. Students who practise at home can use the online version. Online classes need a connection." },
  { cat: "plans", q: "Do students get a certificate?", a: "Yes. Finishing a course earns a certificate that anyone can verify online, and students keep lifetime access to the material." },
  { cat: "plans", q: "What does it cost?", a: "Plans start at ₹999 per course, with ₹1,499 per semester and ₹1,999 per year options." },
  { cat: "schools", q: "Can our school run RoboCoders?", a: "Yes. We handle setup and instructor training, then launch classes and track progress with you. A school starts with a consultation, then customization, setup and launch." },
  { cat: "schools", q: "Who teaches the classes?", a: "Trained RoboCoders instructors can teach independently or co-teach with your staff. Kits, textbooks and LMS access are included, and 24/7 tech support backs every class." },
  { cat: "schools", q: "Can schools order in bulk?", a: "Yes. Schools can contact the RoboCoders team for bulk orders, product demos and classroom packages." },
  { cat: "kits", q: "What is in the Robotics Kit?", a: "A custom ESP32 board, sensors, motors and a chassis, with 40+ guided projects. It supports block and C coding and works with laptops, desktops and Chromebooks." },
  { cat: "kits", q: "Is there a screen-free option for young kids?", a: "Yes. The RoboCoders Play Kit teaches coding without a screen: kids lay out direction cards and the robot follows them." },
];

/* FAQ: filter by topic and one answer open at a time with a smooth slide. With a mouse, an answer opens as the pointer
   reaches its question and everything closes when the pointer leaves the list; clicking (and touch or keyboard) still
   toggles. The heading, topics, questions and the ask bar rise in once as the section scrolls into view. */
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

        <ul className="rh-faq2-list" key={cat} onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(null)}>
          {shown.map((f, k) => {
            const isOpen = open === f.i;
            return (
              <li key={f.q} className="rh-faq2-item" data-open={isOpen} style={{ "--i": k } as React.CSSProperties} onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(f.i)}>
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
