"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Award, CalendarClock, Check, GraduationCap, Headset } from "lucide-react";

const LAUNCH = [
  ["Consultation", "We learn what your school needs."],
  ["Customize", "We shape the programme to your timetable."],
  ["Setup", "Kits, software and instructors get ready."],
  ["Launch", "Classes start and we track progress with you."],
];
const PROMISES: [string, typeof Check][] = [
  ["Fits your timetable", CalendarClock],
  ["Trained instructors", GraduationCap],
  ["24/7 tech support", Headset],
];
const PRICES = [
  { price: "₹999", per: "per course" },
  { price: "₹1,499", per: "per semester" },
  { price: "₹1,999", per: "per year" },
];

// true once the element has scrolled into view (stays true), so a block animates in when the visitor reaches it
function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

export default function HomeAudiences() {
  const [schoolRef, schoolSeen] = useSeen<HTMLDivElement>();
  const [parentRef, parentSeen] = useSeen<HTMLDivElement>();
  const [plan, setPlan] = useState(1);
  const [step, setStep] = useState(-1);
  const cert = useRef<HTMLDivElement>(null);

  // launch steps light up one after another once the schools block is in view
  useEffect(() => {
    if (!schoolSeen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStep(LAUNCH.length - 1); return; }
    let n = 0;
    setStep(0);
    const id = setInterval(() => {
      n += 1;
      setStep(n);
      if (n >= LAUNCH.length - 1) clearInterval(id);
    }, 1100);
    return () => clearInterval(id);
  }, [schoolSeen]);

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cert.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg)`;
  };
  const untilt = () => { if (cert.current) cert.current.style.transform = ""; };

  return (
    <section className="rh-sec rh-wash" aria-labelledby="rh-audiences">
      <div className="rh-wrap">
        <div className="rh-head">
          <h2 id="rh-audiences">Built for schools and families.</h2>
        </div>

        {/* 1. Schools */}
        <div className="rh-aud" ref={schoolRef} data-seen={schoolSeen}>
          <div className="rh-photo rh-aud-media">
            <Image src="/For School.png" alt="Students working on robots and code in a school classroom" fill sizes="(max-width: 960px) 100vw, 560px" />
          </div>
          <div className="rh-aud-copy">
            <h3>For schools</h3>
            <p>We fit into your timetable, bring trained instructors and back every class with 24/7 tech support.</p>
            <ul className="rh-au-chips">
              {PROMISES.map(([t, Icon]) => <li key={t}><Icon size={16} aria-hidden="true" />{t}</li>)}
            </ul>
            <ol className="rh-launch2" aria-label="How a school launches">
              {LAUNCH.map(([name, text], i) => (
                <li key={name} data-state={i < step ? "done" : i === step ? "active" : "todo"}>
                  <span className="rh-launch2-n">{i < step ? <Check size={16} aria-hidden="true" /> : i + 1}</span>
                  <div>
                    <strong>{name}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/robocoders/for-schools" className="rh-link">Bring RoboCoders to your school</Link>
          </div>
        </div>

        {/* 2. Parents */}
        <div className="rh-aud rh-aud--flip" ref={parentRef} data-seen={parentSeen}>
          <div className="rh-aud-certwrap rh-aud-media" onPointerMove={tilt} onPointerLeave={untilt}>
            <div className="rh-au-cert" ref={cert}>
              <Image src="/certificate-of-completion.png" alt="Sample RoboCoders certificate of completion" width={2000} height={1414} sizes="(max-width: 960px) 100vw, 560px" />
              <span className="rh-au-glint" />
            </div>
          </div>
          <div className="rh-aud-copy">
            <h3>For parents</h3>
            <p>Real projects build confidence. Your child leaves with a portfolio and a certificate to show for it.</p>
            <ul className="rh-au-chips">
              <li><Award size={16} aria-hidden="true" />A portfolio to share</li>
              <li><Award size={16} aria-hidden="true" />A certificate to show</li>
            </ul>
            <div className="rh-au-plans" role="radiogroup" aria-label="Plans">
              {PRICES.map((p, i) => (
                <button key={p.per} type="button" role="radio" aria-checked={plan === i} data-on={plan === i} onClick={() => setPlan(i)}>
                  <strong>{p.price}</strong>
                  <span>{p.per}</span>
                </button>
              ))}
            </div>
            <Link href="/robocoders/for-parents" className="rh-link">See plans for parents</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
