import Link from "next/link";
import { Check, GraduationCap, Mic, Video } from "lucide-react";
import { brandHref } from "@/lib/brand-host";
import "./droid.css";

const STEPS = [
  ["Book", "Pick a time for your free trial class."],
  ["Meet", "Talk one on one with a tutor."],
  ["Choose", "Pick the program that fits."],
];
const PROGRAMS = ["Coding", "Robotics", "AI and ML"];

/* The closing call to action. The right side is a looping illustration of what the trial is: a one-on-one call with a tutor,
   then choosing a program (pure CSS, 10s loop). */
export default function HomeCta() {
  return (
    <section className="rh-sec rh-dark rh-cta2-sec" aria-labelledby="rh-cta">
      <div className="rh-wrap rh-cta2">
        <div className="rh-cta2-copy">
          <h2 id="rh-cta">Start with a free trial class.</h2>
          <p className="rh-lede">Meet a tutor one on one, then choose the program that fits.</p>
          <ol className="rh-cta2-steps">
            {STEPS.map(([n, t], i) => (
              <li key={n}><span>{i + 1}</span><div><strong>{n}</strong><p>{t}</p></div></li>
            ))}
          </ol>
          <div className="rh-actions">
            <Link href="/robocoders/online-classes" className="rh-btn rh-btn--primary">Book a trial class</Link>
            <Link href={brandHref("/robocoders/contact")} className="rh-btn rh-btn--ghost">Talk to us</Link>
          </div>
        </div>

        <div className="rh-call" role="img" aria-label="Illustration of a trial class: a one-on-one video call between a tutor and a student, followed by choosing a program.">
          <div className="rh-call-bar" aria-hidden="true"><Video size={14} /> Trial class <em>Free</em></div>
          <div className="rh-call-tiles" aria-hidden="true">
            <div className="rh-tile rh-tile--tutor">
              <span className="rh-tile-av"><GraduationCap size={30} /></span>
              <b>Tutor</b>
              <i className="rh-mic"><Mic size={12} /></i>
              <p className="rh-bub rh-bub--a">Hi! What would you like to build?</p>
            </div>
            <div className="rh-tile rh-tile--student">
              <div className="droid-mini rh-call-droid">
                <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
                <div className="droid__body" />
              </div>
              <b>You</b>
              <p className="rh-bub rh-bub--b">A robot that thinks!</p>
            </div>
          </div>
          <div className="rh-call-pick" aria-hidden="true">
            <span className="rh-call-pick-t">Choose your program</span>
            <div>
              {PROGRAMS.map((p, i) => (
                <span key={p} className={i === 1 ? "is-pick" : undefined}>{p}{i === 1 && <Check size={14} />}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
