import Link from "next/link";
import { KeyRound, Mail, Phone } from "lucide-react";

// ponytail: no email service yet — the Academy admin issues a one-time password.
// Add a self-serve email reset once transactional email is set up.
export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ac-soft text-ac-brand"><KeyRound className="h-6 w-6" /></span>
      <div>
        <h1 className="font-acdisplay text-3xl font-bold leading-tight text-ac-ink sm:text-4xl">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Contact us with the email you signed up with. We&apos;ll send a one-time password, and you&apos;ll choose a new one when you sign in.
        </p>
      </div>
      <div className="space-y-3">
        <a href="mailto:info@yugminds.org?subject=RoboCoders%20Academy%20password%20reset" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-ac-brand">
          <Mail className="h-5 w-5 text-ac-brand" /><span className="font-medium">info@yugminds.org</span>
        </a>
        <a href="tel:+918500345655" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-ac-brand">
          <Phone className="h-5 w-5 text-ac-brand" /><span className="font-medium">+91 85003 45655</span>
        </a>
      </div>
      <Link href="/academy/login" className="text-center text-sm font-medium text-ac-brand hover:underline">← Back to sign in</Link>
    </div>
  );
}
