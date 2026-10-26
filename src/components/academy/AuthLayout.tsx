"use client";

import { useState } from "react";
import { Award, Bot, CheckCircle2, Eye, EyeOff, PlayCircle, Video } from "lucide-react";

const PARTS = [
  { icon: PlayCircle, name: "Self-paced courses", note: "Video lessons, readings and quizzes" },
  { icon: Video, name: "Live 1:1 classes", note: "Book a RoboCoders tutor" },
  { icon: Award, name: "Certificates", note: "Verifiable, one per course" },
];

/**
 * Split auth screen (LMS layout), drawn as a kit's parts page: blue graph
 * paper on the left listing what the account includes, form on the right.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full">
      <section className="ac-graph-blue relative hidden shrink-0 flex-col justify-between p-10 text-white md:flex md:w-[44%] lg:p-14">
        <Bot className="h-12 w-12 text-white/90" strokeWidth={1.5} aria-hidden />
        <div>
          <h2 className="max-w-md font-acdisplay text-4xl font-bold leading-[1.1] lg:text-5xl">
            One account. Everything you need to start building.
          </h2>
          <ul className="mt-10 grid max-w-lg gap-3">
            {PARTS.map(({ icon: Icon, name, note }) => (
              <li key={name} className="flex items-center gap-4 rounded-xl border border-white/25 bg-white/5 p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/50">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{name}</span>
                  <span className="block text-sm text-blue-100">{note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-blue-100">By YugMinds, Hyderabad. Separate from the school Student Portal.</p>
      </section>
      <section className="flex min-w-0 flex-1 items-start justify-center px-6 py-10 sm:items-center sm:p-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}

/** Rounded "glass" input wrapper from the LMS sign-in page. */
export function GlassField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="mt-1.5 rounded-xl border border-slate-300 bg-white transition-colors focus-within:border-ac-brand focus-within:ring-2 focus-within:ring-ac-brand/20">
        {children}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const glassInput = "w-full rounded-xl bg-transparent px-4 py-3.5 text-base focus:outline-none sm:text-sm";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${glassInput} pr-12`} />
      <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-1 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="whitespace-pre-line rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">{message}</p>;
}

export function AuthSubmit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button disabled={busy} className="w-full rounded-lg bg-ac-brand py-3.5 font-semibold text-white transition-colors hover:bg-ac-brand-dark disabled:opacity-60 sm:py-4">
      {children}
    </button>
  );
}

export function PasswordRules() {
  return (
    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> 8+ characters with an uppercase letter, a lowercase letter and a number</span>
  );
}
