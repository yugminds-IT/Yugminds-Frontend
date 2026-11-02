"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { commonApi } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import "./droid.css";

const TOPICS = [
  {
    id: "Free trial class",
    team: "Tutor team",
    hint: "Your child's age and the days that suit you for a first class.",
    steps: ["We get in touch to find a time that suits your child.", "Your child joins a free trial class with a tutor."],
  },
  {
    id: "Programs and fees",
    team: "Programs team",
    hint: "Your child's age and what they enjoy, so we can suggest a program.",
    steps: ["We send fees and batch timings for your child's age.", "You pick a program, or try a class first."],
  },
  {
    id: "School partnership",
    team: "Partnerships team",
    hint: "Your school's name, city and the grades you have in mind.",
    steps: ["Our partnerships team gets in touch to learn about your school.", "We plan a demo session at your school."],
  },
  {
    id: "Kits and Simulator",
    team: "Kits team",
    hint: "Which kit you're looking at, and how many you need.",
    steps: ["We suggest the right kit for your child or class.", "We share prices and delivery details."],
  },
  {
    id: "Technical support",
    team: "Tech support",
    hint: "The kit or software, what you tried, and what happened.",
    steps: ["A trainer looks into the problem.", "We reply with a fix, or call to walk you through it."],
  },
  {
    id: "Something else",
    team: "RoboCoders team",
    hint: "Tell us what you have in mind.",
    steps: ["The right person on the team picks it up.", "We reply by email or phone."],
  },
] as const;

type Form = {
  firstName: string;
  lastName: string;
  areaCode: string;
  phoneNumber: string;
  email: string;
  purpose: string;
  message: string;
};
type Field = keyof Form;

const EMPTY: Form = { firstName: "", lastName: "", areaCode: "+91", phoneNumber: "", email: "", purpose: "", message: "" };
const MAX = 5000;

function validate(f: Form): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  if (!f.purpose) e.purpose = "Pick what your message is about.";
  if (!f.firstName.trim()) e.firstName = "Enter your first name.";
  if (!f.lastName.trim()) e.lastName = "Enter your last name.";
  if (!f.email.trim()) e.email = "Enter your email so we can reply.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter an email like name@example.com.";
  if (f.phoneNumber && !/^[\d\s-]{6,15}$/.test(f.phoneNumber.trim())) e.phoneNumber = "Use digits only, like 98765 43210.";
  if (!f.message.trim()) e.message = "Write a short message.";
  else if (f.message.length > MAX) e.message = `Keep it under ${MAX} characters.`;
  return e;
}

const ORDER: Field[] = ["purpose", "firstName", "lastName", "email", "phoneNumber", "message"];

export default function ContactForm() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Form | null>(null);
  const [flying, setFlying] = useState(false);
  const [back, setBack] = useState(false);
  const [focus, setFocus] = useState<Field | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { clearSavedData } = useAutoSaveForm({
    formId: "contact-form",
    formData: form,
    useSession: false,
    onLoad: (data) => {
      const known = TOPICS.some((t) => t.id === data.purpose);
      setForm({ ...EMPTY, ...data, purpose: known ? data.purpose : "" });
    },
  });

  const errors = validate(form);
  const show = (k: Field) => (tried || touched[k]) && errors[k];
  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const blur = (k: Field) => () => setTouched((t) => ({ ...t, [k]: true }));

  const topic = TOPICS.find((t) => t.id === form.purpose);
  const name = `${form.firstName} ${form.lastName}`.trim();
  const team = topic?.team ?? "RoboCoders team";
  const checks = [
    { label: "Topic", ok: !errors.purpose },
    { label: "Your name", ok: !errors.firstName && !errors.lastName },
    { label: "Email", ok: !errors.email },
    { label: "Message", ok: !errors.message },
  ];
  const ready = checks.every((c) => c.ok);
  const at = (...fields: Field[]) => (focus && fields.includes(focus)) || undefined;

  const onFocus = (e: React.FocusEvent<HTMLFormElement>) => {
    const el = e.target as EventTarget as HTMLInputElement;
    if (el.name === "purpose") setFocus("purpose");
    else if (el.classList.contains("ct-code")) setFocus("phoneNumber");
    else setFocus((el.id?.replace("ct-", "") as Field) || null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    const first = ORDER.find((k) => errors[k]);
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(first === "purpose" ? "input[name=purpose]" : `#ct-${first}`);
      el?.focus();
      return;
    }
    setSending(true);
    try {
      await commonApi.contact({ ...form, phoneNumber: form.phoneNumber.trim(), email: form.email.trim() });
      clearSavedData();
      setFlying(true);
      setTimeout(() => {
        setSent(form);
        setFlying(false);
        setForm(EMPTY);
        setTouched({});
        setTried(false);
      }, 700);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The message didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    const t = TOPICS.find((x) => x.id === sent.purpose);
    return (
      <div
        className="ct-done"
        role="status"
        ref={(el) => {
          if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
        }}
      >
        <div className="ct-done-droid" aria-hidden="true">
          <div className="droid__head-container">
            <div className="droid__antenna" />
            <div className="droid__antenna" />
            <div className="droid__head" />
          </div>
          <div className="droid__body" />
        </div>
        <div className="ct-done-copy">
          <h3>Message sent.</h3>
          <p>
            Thanks, {sent.firstName}. We&apos;ll reply to <b>{sent.email}</b> within 24 hours
            {sent.phoneNumber ? <>, or call you on <b>{sent.areaCode} {sent.phoneNumber}</b></> : null}.
          </p>
          {t && (
            <ol className="ct-steps ct-steps--done">
              <li data-done>Delivered to {t.team}.</li>
              {t.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          )}
          <div className="rh-actions">
            {sent.purpose === "School partnership" ? (
              <Link href="/robocoders/for-schools" className="rh-btn rh-btn--primary">See how schools start</Link>
            ) : (
              <Link href="/robocoders/programs" className="rh-btn rh-btn--primary">Explore programs</Link>
            )}
            <button type="button" className="rh-btn rh-btn--ghost" onClick={() => { setSent(null); setBack(true); }}>
              Send another message
            </button>
          </div>
        </div>
      </div>
    );
  }

  const err = (k: Field) =>
    show(k) ? <p className="ct-err" id={`ct-${k}-err`}>{errors[k]}</p> : null;
  const aria = (k: Field) => ({
    "aria-invalid": show(k) ? true : undefined,
    "aria-describedby": show(k) ? `ct-${k}-err` : undefined,
  });

  return (
    <div className="ct-form-grid" data-back={back || undefined}>
      <form ref={formRef} className="ct-form" onSubmit={submit} onFocus={onFocus} onBlur={() => setFocus(null)} noValidate>
        <fieldset className="ct-topics" aria-describedby={show("purpose") ? "ct-purpose-err" : undefined}>
          <legend>What&apos;s it about?</legend>
          <div className="ct-chips">
            {TOPICS.map((t) => (
              <label key={t.id} className="ct-chip">
                <input
                  type="radio"
                  name="purpose"
                  value={t.id}
                  checked={form.purpose === t.id}
                  onChange={() => setForm((f) => ({ ...f, purpose: t.id }))}
                />
                <span>{t.id}</span>
              </label>
            ))}
          </div>
          {err("purpose")}
        </fieldset>

        <div className="ct-row">
          <div className="ct-field">
            <label htmlFor="ct-firstName">First name</label>
            <input id="ct-firstName" autoComplete="given-name" autoCapitalize="words" enterKeyHint="next" value={form.firstName} onChange={set("firstName")} onBlur={blur("firstName")} maxLength={80} {...aria("firstName")} />
            {err("firstName")}
          </div>
          <div className="ct-field">
            <label htmlFor="ct-lastName">Last name</label>
            <input id="ct-lastName" autoComplete="family-name" autoCapitalize="words" enterKeyHint="next" value={form.lastName} onChange={set("lastName")} onBlur={blur("lastName")} maxLength={80} {...aria("lastName")} />
            {err("lastName")}
          </div>
        </div>

        <div className="ct-row">
          <div className="ct-field">
            <label htmlFor="ct-email">Email</label>
            <input id="ct-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" value={form.email} onChange={set("email")} onBlur={blur("email")} maxLength={200} {...aria("email")} />
            {err("email")}
          </div>
          <div className="ct-field">
            <label htmlFor="ct-phoneNumber">
              Phone <span className="ct-opt">optional, for a call back</span>
            </label>
            <div className="ct-phone">
              <input aria-label="Country code" className="ct-code" value={form.areaCode} onChange={set("areaCode")} maxLength={5} />
              <input id="ct-phoneNumber" type="tel" inputMode="tel" autoComplete="tel-national" enterKeyHint="next" value={form.phoneNumber} onChange={set("phoneNumber")} onBlur={blur("phoneNumber")} {...aria("phoneNumber")} />
            </div>
            {err("phoneNumber")}
          </div>
        </div>

        <div className="ct-field">
          <label htmlFor="ct-message">Message</label>
          <textarea
            id="ct-message"
            rows={5}
            value={form.message}
            onChange={set("message")}
            onBlur={blur("message")}
            placeholder={topic ? topic.hint : "Pick a topic above and we'll suggest what to include."}
            {...aria("message")}
          />
          <div className="ct-under">
            {err("message") ?? <span />}
            {form.message.length > MAX - 500 && (
              <span className="ct-count" data-over={form.message.length > MAX || undefined}>
                {MAX - form.message.length} characters left
              </span>
            )}
          </div>
        </div>

        <div className="ct-submit">
          <button type="submit" className="rh-btn rh-btn--primary" disabled={sending || flying}>
            {sending ? "Sending…" : "Send message"}
          </button>
          <p>Saved on this device as you type, until you send it.</p>
        </div>
      </form>

      <aside className="ct-side" aria-label="Your message, as the team will get it">
        <div className="ct-card" data-fly={flying || undefined} data-ready={ready || undefined}>
          <div className="ct-card-head">
            <span>New message</span>
            {topic ? <b className="ct-card-topic" key={topic.id}>{topic.id}</b> : <b className="ct-card-topic ct-card-topic--empty">No topic yet</b>}
          </div>
          <dl className="ct-card-meta">
            <div data-focus={at("purpose")}>
              <dt>To</dt>
              <dd key={team} className="ct-card-to">{team}</dd>
            </div>
            <div data-focus={at("firstName", "lastName")}>
              <dt>From</dt>
              <dd data-empty={!name || undefined}>{name || "Your name"}</dd>
            </div>
            <div data-focus={at("email")}>
              <dt>Reply to</dt>
              <dd data-empty={!form.email || undefined}>{form.email || "Your email"}</dd>
            </div>
            {(form.phoneNumber || focus === "phoneNumber") && (
              <div data-focus={at("phoneNumber")}>
                <dt>Phone</dt>
                <dd data-empty={!form.phoneNumber || undefined}>{form.phoneNumber ? `${form.areaCode} ${form.phoneNumber}` : "Optional"}</dd>
              </div>
            )}
          </dl>
          <p className="ct-card-body" data-focus={at("message")} data-empty={!form.message || undefined}>
            {form.message || (focus === "message" ? "" : "Your message shows up here as you write it.")}
            {focus === "message" && <span className="ct-caret" />}
          </p>
          <ul className="ct-checks" aria-label="Ready to send">
            {checks.map((c) => (
              <li key={c.label} data-ok={c.ok || undefined}>
                <span>{c.ok && <Check />}</span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="ct-route" data-ready={ready || undefined} data-fly={flying || undefined}>
          <span className="ct-track" aria-hidden="true"><i /></span>
          <div className="ct-node">
            <div className="ct-sorter" aria-hidden="true">
              <div className="droid__head-container">
                <div className="droid__antenna" />
                <div className="droid__antenna" />
                <div className="droid__head" />
              </div>
              <div className="droid__body" />
            </div>
            <p>
              <small>{flying ? "Delivered to" : ready ? "Ready to go to" : "Goes to"}</small>
              <b key={team}>{team}</b>
            </p>
          </div>
        </div>

        <div className="ct-next">
          <h3>What happens next</h3>
          <ol className="ct-steps" key={topic?.id ?? "none"}>
            <li>We read your message within one working day.</li>
            {(topic ?? TOPICS[5]).steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </div>
      </aside>
    </div>
  );
}
