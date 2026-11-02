import Link from "next/link";
import { Instagram, Youtube, Facebook, MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/social-links";
import FooterVisitCount from "./FooterVisitCount";
import FooterTop from "./FooterTop";
import FooterLogo from "./FooterLogo";
import { display, body } from "../app/robocoders/robo-fonts";
import "./public/robo-home.css";
import "./public/droid.css";

const QUICK = [
  { href: "/about", label: "About Us" },
  { href: "/programs", label: "Our Programs" },
  { href: "/products", label: "Products" },
  { href: "/community", label: "Community" },
  { href: "/for-schools", label: "For Schools" },
  { href: "/for-parents", label: "For Parents" },
  { href: "/contact", label: "Contact Us" },
];
const SOCIAL_ICON = { instagram: Instagram, youtube: Youtube, facebook: Facebook, whatsapp: MessageCircle } as const;
const SOCIAL = SOCIAL_LINKS.map(({ platform, label, url }) => ({ href: url, label, Icon: SOCIAL_ICON[platform as keyof typeof SOCIAL_ICON] }));

export default function Footer() {
  return (
    <footer id="contact" className={`rf ${display.variable} ${body.variable}`}>
      <FooterTop />
      <div className="rf-wrap">
        <div className="rf-cta">
          <div>
            <h2>Ready to build something?</h2>
            <p>Book a free trial class and meet a tutor one on one.</p>
          </div>
          <Link href="/robocoders/online-classes" className="rf-btn">Book a free trial</Link>
        </div>

        <div className="rf-grid">
          <div className="rf-brand">
            <FooterLogo />
            <p>An EdTech initiative by YugMinds, empowering the next generation with cutting-edge STEM education through AI, robotics, and programming.</p>
          </div>

          <nav aria-label="Quick links">
            <h3>Quick links</h3>
            <ul className="rf-links">
              {QUICK.map((l) => (
                <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </nav>

          <div>
            <h3>Contact</h3>
            <ul className="rf-contact">
              <li><Mail size={16} aria-hidden="true" /><a href="mailto:robocoders@yugminds.org">robocoders@yugminds.org</a></li>
              <li><Phone size={16} aria-hidden="true" /><a href="tel:+918500345655">+91 85003 45655</a></li>
              <li><MapPin size={16} aria-hidden="true" /><span>Begumpet, Hyderabad, Telangana, India.</span></li>
            </ul>
          </div>

          <div>
            <h3>Follow us</h3>
            <ul className="rf-social">
              {SOCIAL.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon size={20} aria-hidden="true" /></a>
                </li>
              ))}
            </ul>
            <FooterVisitCount />
          </div>
        </div>

        <div className="rf-base">
          <p>© 2024 Robo Coders™ by Yugminds. All rights reserved.</p>
          <p>Privacy Policy · Terms of Service</p>
        </div>
      </div>
    </footer>
  );
}
