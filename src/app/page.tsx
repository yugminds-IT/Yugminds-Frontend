"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Menu,
  X,
  Code2,
  Cpu,
  FlaskConical,
  Factory,
  GraduationCap,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Youtube,
  Facebook,
  Monitor,
  Wrench,
  Star,
  Zap,
} from "lucide-react";
import BrandSwitcherBar from "../components/BrandSwitcherBar";

/* ─────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────── */
function YugmindsNavbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { name: "Home", href: "#home" },
    { name: "About", href: "#about" },
    { name: "Services", href: "#services" },
    { name: "Divisions", href: "#divisions" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Image
            src="/Yugminds_Official_Logo-preview.png"
            alt="YugMinds Logo"
            width={44}
            height={44}
            className="object-contain"
            priority
          />
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">
            YugMinds
          </span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.name}
              href={l.href}
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors duration-150"
            >
              {l.name}
            </a>
          ))}
        </div>

        {/* CTA */}
        <a
          href="#contact"
          className="hidden md:inline-flex items-center gap-1.5 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Get in Touch
        </a>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-slate-700"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-5 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.name}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-slate-700 hover:text-blue-600"
            >
              {l.name}
            </a>
          ))}
          <a
            href="#contact"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold text-center hover:bg-blue-700 transition-colors"
          >
            Get in Touch
          </a>
        </div>
      )}
    </nav>
  );
}

/* ─────────────────────────────────────────────
   HERO
───────────────────────────────────────────── */
function HeroSection() {
  return (
    <section
      id="home"
      className="bg-gradient-to-br from-slate-50 via-blue-50 to-white"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20 grid md:grid-cols-2 gap-10 items-center min-h-[88vh]">
        {/* Left text */}
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3 h-3" /> Multi-domain Innovation Company
          </p>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.1] text-slate-900 mb-6">
            Building
            <br />
            <span className="text-blue-600">Tomorrow&apos;s</span>
            <br />
            Industries
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed mb-8 max-w-md">
            YugMinds Private Limited is a multi-disciplinary company spanning
            software development, manufacturing, R&amp;D, and hardware
            engineering — with Robocoders™ as our flagship EdTech initiative.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#divisions"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-7 py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              Explore Divisions
            </a>
            <a
              href="#about"
              className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 px-7 py-3.5 rounded-lg font-semibold hover:border-blue-300 hover:text-blue-600 transition-colors text-sm"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Right — geometric building visual */}
        <div className="relative flex justify-center items-end h-[400px] md:h-[520px] overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200">
          {/* Architectural towers */}
          <div className="absolute bottom-0 inset-x-0 flex items-end justify-center gap-2 px-6">
            {[110, 160, 210, 260, 215, 165, 115].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}px` }}
                className={`flex-1 rounded-t-xl ${
                  i % 3 === 0
                    ? "bg-gradient-to-b from-blue-300 to-blue-600"
                    : i % 3 === 1
                    ? "bg-gradient-to-b from-blue-400 to-blue-700"
                    : "bg-gradient-to-b from-sky-300 to-blue-500"
                } opacity-80`}
              >
                {/* Window grid */}
                <div className="grid grid-cols-2 gap-0.5 p-1 pt-2">
                  {Array(8)
                    .fill(0)
                    .map((_, j) => (
                      <div
                        key={j}
                        className="bg-white/20 rounded-[1px]"
                        style={{ height: "6px" }}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Dot grid decoration */}
          <div className="absolute top-6 right-6 grid grid-cols-5 gap-1.5">
            {Array(20)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-blue-400 rounded-full opacity-50"
                />
              ))}
          </div>

          {/* Floating stat card */}
          <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-5 py-3">
            <p className="text-xs text-slate-500 font-medium">
              Active Projects
            </p>
            <p className="text-2xl font-extrabold text-blue-600">200+</p>
          </div>

          {/* Top-left label */}
          <div className="absolute top-6 left-6 bg-blue-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
            Est. 2019
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FEATURES / SERVICES
───────────────────────────────────────────── */
function FeaturesSection() {
  const cards = [
    {
      icon: <Zap className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50",
      title: "Software Development",
      desc: "Expert teams building scalable web, mobile, and enterprise solutions tailored to global client needs.",
    },
    {
      icon: <Factory className="w-5 h-5 text-emerald-600" />,
      bg: "bg-emerald-50",
      title: "Manufacturing",
      desc: "State-of-the-art manufacturing processes delivering precision-engineered products at scale.",
    },
    {
      icon: <FlaskConical className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50",
      title: "Research & Development",
      desc: "Dedicated R&D labs constantly pushing the boundaries of technology, engineering, and applied science.",
    },
  ];

  return (
    <section id="services" className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Two-column header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight md:max-w-sm">
            What our company
            <br />
            provides for you
          </h2>
          <p className="text-slate-500 text-base leading-relaxed md:max-w-xs md:text-right">
            We always give each of our clients the highest level of excellence
            using the diverse services of our company.
          </p>
        </div>

        <hr className="border-slate-100 mb-12" />

        {/* Cards */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {cards.map((c, i) => (
            <div
              key={i}
              className="border border-slate-100 rounded-2xl p-6 hover:shadow-md transition-all duration-200 group"
            >
              <div
                className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center mb-5`}
              >
                {c.icon}
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">
                {c.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                {c.desc}
              </p>
              <a
                href="#divisions"
                className="inline-flex items-center gap-1 text-blue-600 text-sm font-medium group-hover:gap-2 transition-all"
              >
                Read more <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   OUR DIVISIONS (like "Our Property" in ref)
───────────────────────────────────────────── */
function DivisionsSection() {
  const [active, setActive] = useState("All");
  const tabs = ["All", "Software", "Manufacturing", "Hardware", "EdTech"];

  const divisions = [
    {
      cat: "Software",
      gradient: "from-blue-500 to-blue-700",
      icon: <Code2 className="w-10 h-10 text-white" />,
      title: "Software Development",
      desc: "Custom web, mobile & enterprise solutions.",
    },
    {
      cat: "Manufacturing",
      gradient: "from-emerald-500 to-emerald-700",
      icon: <Factory className="w-10 h-10 text-white" />,
      title: "Manufacturing",
      desc: "Precision-engineered products at scale.",
    },
    {
      cat: "Hardware",
      gradient: "from-orange-500 to-orange-700",
      icon: <Cpu className="w-10 h-10 text-white" />,
      title: "Hardware Engineering",
      desc: "Cutting-edge hardware design & prototyping.",
    },
    {
      cat: "EdTech",
      gradient: "from-purple-500 to-purple-700",
      icon: <GraduationCap className="w-10 h-10 text-white" />,
      title: "Robocoders™ EdTech",
      desc: "Teaching coding, robotics & AI to students.",
    },
  ];

  const shown =
    active === "All" ? divisions : divisions.filter((d) => d.cat === active);

  return (
    <section id="divisions" className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">
            Our Divisions
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            We operate across multiple specialized domains with dedicated expert
            teams for each.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-1 mb-10">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`px-5 py-2 text-sm font-medium transition-all duration-150 ${
                active === t
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-500 hover:text-slate-800 border-b-2 border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {shown.map((d, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden border border-slate-100 hover:shadow-lg transition-all duration-200 group"
            >
              {/* Visual */}
              <div
                className={`h-44 bg-gradient-to-br ${d.gradient} flex items-center justify-center relative`}
              >
                {d.icon}
                <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
              </div>
              {/* Content */}
              <div className="p-5">
                <h3 className="font-bold text-slate-900 mb-1">{d.title}</h3>
                <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                  {d.desc}
                </p>
                <a
                  href="#contact"
                  className="text-blue-600 text-sm font-semibold hover:underline"
                >
                  See More
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   CTA SECTION (like "consumer is with brand")
───────────────────────────────────────────── */
function CTASection() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-6">
            The more clients trust{" "}
            <span className="text-blue-600">
              YugMinds with their vision,
            </span>{" "}
            the more they achieve together
          </h2>
          <p className="text-slate-500 leading-relaxed mb-8 max-w-md">
            A company built on trust and innovation. Our multi-domain expertise
            sets us apart and makes us the preferred partner for businesses
            worldwide.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-7 py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            Partner With Us
          </a>
        </div>

        {/* Right — stats panel */}
        <div className="relative">
          <div className="bg-white rounded-2xl shadow-lg p-8 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-blue-50 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-50 rounded-full" />
            <div className="grid grid-cols-2 gap-8 relative z-10">
              {[
                { value: "200+", label: "Projects Delivered" },
                { value: "50+", label: "Clients Worldwide" },
                { value: "5+", label: "Business Domains" },
                { value: "10+", label: "Years of Excellence" },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl font-extrabold text-blue-600">
                    {s.value}
                  </p>
                  <p className="text-slate-500 text-sm mt-1 font-medium">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   ABOUT / BUSINESS GROWTH SECTION
───────────────────────────────────────────── */
function AboutSection() {
  const services = [
    {
      icon: <Monitor className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50",
      title: "Technology Solutions",
      desc: "We operate in fast-paced environments where companies must constantly evolve. Our tech solutions keep you ahead of the curve.",
    },
    {
      icon: <Wrench className="w-5 h-5 text-teal-600" />,
      bg: "bg-teal-50",
      title: "Hardware & Manufacturing",
      desc: "Where our service meets hardware engineering — strategy consulting and precision manufacturing planning through the entire lifecycle.",
    },
  ];

  return (
    <section id="about" className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-16 items-center">
        {/* Left */}
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-6">
            What we will do for your Business to grow and Develop better
          </h2>
          <p className="text-slate-500 leading-relaxed mb-6">
            YugMinds brings together world-class expertise across multiple
            disciplines to help your business scale, innovate, and lead within
            your industry.
          </p>
          <a
            href="#divisions"
            className="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm hover:gap-3 transition-all"
          >
            Learn more <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Right — service cards */}
        <div className="flex flex-col gap-4">
          {services.map((s, i) => (
            <div
              key={i}
              className="flex gap-4 p-5 border border-slate-100 rounded-2xl hover:shadow-sm transition-all"
            >
              <div
                className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}
              >
                {s.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 text-sm">
                  {s.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   LEADERSHIP / ABOUT CEO SECTION
───────────────────────────────────────────── */
function LeadershipSection() {
  return (
    <section className="bg-white py-20 border-t border-slate-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-2 gap-16 items-center">
        {/* Left — circular visual */}
        <div className="flex justify-center">
          <div className="relative inline-block">
            {/* Outer dashed ring */}
            <div className="w-64 h-64 rounded-full border-2 border-dashed border-blue-200 flex items-center justify-center">
              {/* Inner avatar */}
              <div className="w-48 h-48 rounded-full bg-white flex items-center justify-center shadow-xl overflow-hidden">
                <Image
                  src="/Yugminds_Official_Logo-preview.png"
                  alt="YugMinds Logo"
                  width={140}
                  height={140}
                  className="object-contain"
                />
              </div>
            </div>
            {/* Name badge */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-xl px-4 py-2 flex items-center gap-2 whitespace-nowrap border border-slate-100">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-bold text-slate-700">
                YugMinds Pvt Ltd
              </span>
              <span className="text-xs text-slate-400">· Est. 2019</span>
            </div>
          </div>
        </div>

        {/* Right — text */}
        <div>
          <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold mb-5">
            <Star className="w-3 h-3 fill-blue-600" />
            Great Company · Trusted Team
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-5">
            About YugMinds
          </h2>
          <p className="text-slate-500 leading-relaxed mb-6">
            Founded with a vision to transform industries through technology and
            innovation, YugMinds Private Limited has grown into a multi-domain
            powerhouse. From software to silicon, manufacturing to EdTech — we
            build solutions that last and make a difference.
          </p>
          <a
            href="#divisions"
            className="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm hover:gap-3 transition-all"
          >
            Learn more <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────── */
function YugmindsFooter() {
  const cols = [
    {
      heading: "Services",
      links: [
        "Software Dev",
        "Manufacturing",
        "Hardware Engg",
        "R&D",
        "EdTech",
      ],
    },
    {
      heading: "Divisions",
      links: [
        "Software",
        "Manufacturing",
        "Hardware",
        "Robocoders™",
        "R&D Lab",
      ],
    },
    {
      heading: "About",
      links: ["Our Story", "Leadership", "Careers", "News", "Partners"],
    },
  ];

  return (
    <footer id="contact" className="bg-white border-t border-slate-100 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Image
                src="/Yugminds_Official_Logo-preview.png"
                alt="YugMinds Logo"
                width={40}
                height={40}
                className="object-contain"
              />
              <span className="text-lg font-bold text-slate-600">YugMinds</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900">
              Ready to get started?
            </h3>
          </div>
          <a
            href="mailto:yugminds@gmail.com"
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Join <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <hr className="border-slate-100 mb-12" />

        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {cols.map((col) => (
            <div key={col.heading}>
              <h4 className="font-bold text-slate-900 text-sm mb-4">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-slate-500 text-sm hover:text-blue-600 transition-colors"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact column */}
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-slate-500 text-sm">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                yugminds@gmail.com
              </li>
              <li className="flex items-start gap-2 text-slate-500 text-sm">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                +91 85003 45655
              </li>
              <li className="flex items-start gap-2 text-slate-500 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                Begumpet, Hyderabad,
                <br />
                Telangana, India.
              </li>
            </ul>
          </div>
        </div>

        <hr className="border-slate-100 mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex gap-6 text-slate-400 text-xs">
            <a href="#" className="hover:text-slate-600 transition-colors">
              Terms &amp; Conditions
            </a>
            <a href="#" className="hover:text-slate-600 transition-colors">
              Privacy Policy
            </a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#"
              aria-label="Facebook"
              className="text-slate-400 hover:text-blue-600 transition-colors"
            >
              <Facebook className="w-4 h-4" />
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="text-slate-400 hover:text-pink-500 transition-colors"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="#"
              aria-label="YouTube"
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <Youtube className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   PAGE EXPORT
───────────────────────────────────────────── */
export default function YugmindsHomePage() {
  return (
    <div className="min-h-screen">
      <BrandSwitcherBar />
      <YugmindsNavbar />
      <HeroSection />
      <FeaturesSection />
      <DivisionsSection />
      <CTASection />
      <AboutSection />
      <LeadershipSection />
      <YugmindsFooter />
    </div>
  );
}
