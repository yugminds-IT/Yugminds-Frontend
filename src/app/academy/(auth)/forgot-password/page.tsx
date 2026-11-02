import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";

// ponytail: no email service yet. The Academy admin issues a one-time password.
// Add a self-serve email reset once transactional email is set up.
export default function ForgotPasswordPage() {
  return (
    <>
      <h1>Forgot your password?</h1>
      <p className="rh-lede">
        Contact us with the email you signed up with. We&apos;ll send a one-time password, and you&apos;ll choose a new one when you sign in.
      </p>
      <div className="lg-contact">
        <a href="mailto:info@yugminds.org?subject=RoboCoders%20Academy%20password%20reset">
          <span className="lg-contact-ico"><Mail size={20} aria-hidden="true" /></span>info@yugminds.org
        </a>
        <a href="tel:+918500345655">
          <span className="lg-contact-ico"><Phone size={20} aria-hidden="true" /></span>+91 85003 45655
        </a>
      </div>
      <div className="lg-helps">
        <p className="lg-help">
          <Link href="/academy/login" className="rh-link"><ArrowLeft size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> Back to sign in</Link>
        </p>
      </div>
    </>
  );
}
