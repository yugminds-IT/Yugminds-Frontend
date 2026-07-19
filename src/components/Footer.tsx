import Link from "next/link";
import { Instagram, Youtube, Facebook, Mail, Phone, MapPin } from "lucide-react";
import { Reveal, HoverLift } from "./public/robo-motion";

export default function Footer() {
  const quickLinks = [
    { href: "/about", label: "About Us" },
    { href: "/programs", label: "Our Programs" },
    { href: "/community", label: "Community" },
    { href: "/for-schools", label: "For Schools" },
    { href: "/for-parents", label: "For Parents" },
    { href: "/contact", label: "Contact Us" },
  ];

  return (
    <footer id="contact" className="footer-section bg-gray-900 text-white pt-20 pb-8 w-full relative z-10 mt-0 overflow-hidden">
      {/* faint oversized watermark */}
      <p className="pointer-events-none select-none absolute -bottom-8 left-1/2 -translate-x-1/2 text-[7rem] md:text-[11rem] font-extrabold text-white/[0.03] whitespace-nowrap leading-none">
        Robo Coders
      </p>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <Reveal className="lg:col-span-2">
            <div className="text-3xl md:text-4xl font-extrabold mb-6 text-white">Robo Coders™</div>
            <p className="text-gray-400 mb-8 max-w-lg text-base md:text-lg leading-relaxed">An EdTech initiative by YugMinds, empowering the next generation with cutting‑edge STEM education through AI, robotics, and programming.</p>
            <div className="space-y-3 text-base text-gray-300">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                  <Mail className="h-4 w-4" />
                </span>
                <span>robocoders07@gmail.com</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                  <Phone className="h-4 w-4" />
                </span>
                <span>+91 85003 45655</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600/20 text-blue-400 mt-0.5 flex-shrink-0">
                  <MapPin className="h-4 w-4" />
                </span>
                <span>Begumpet,<br/>Hyderabad, Telangana, India.</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="font-semibold text-xl mb-6 text-white">Quick Links</div>
            <ul className="space-y-3 text-base text-gray-300">
              {quickLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group inline-flex items-center hover:text-white transition-colors">
                    <span className="relative">
                      {l.label}
                      <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-blue-400 transition-all duration-300 group-hover:w-full" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="font-semibold text-xl mb-6 text-white">Follow Us</div>
            <div className="flex gap-4 mb-10">
              <HoverLift>
                <a href="https://www.instagram.com/robocoders?igsh=MTJweGVsMzg5M2I3MQ==" target="_blank" rel="noopener noreferrer" className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 hover:opacity-90 transition-opacity shadow-lg" aria-label="Instagram">
                  <Instagram className="h-6 w-6 text-white" />
                </a>
              </HoverLift>
              <HoverLift delay={0.05}>
                <a href="https://youtube.com/@robocoders?si=KcRjT1jfLJg7jMkq" target="_blank" rel="noopener noreferrer" className="w-12 h-12 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 transition-colors shadow-lg" aria-label="YouTube">
                  <Youtube className="h-6 w-6 text-white" />
                </a>
              </HoverLift>
              <HoverLift delay={0.1}>
                <a href="https://www.facebook.com/share/1V8yjknAGv/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg" aria-label="Facebook">
                  <Facebook className="h-6 w-6 text-white" />
                </a>
              </HoverLift>
            </div>
          </Reveal>
        </div>

        <div className="border-t border-white/10 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-sm text-gray-400">
            <p className="text-center">
              © 2024 Robo Coders™ by Yugminds. All rights reserved. |{" "}
              <Link href="/privacy-policy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>{" "}
              |{" "}
              <Link href="/terms-of-service" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
