import Link from "next/link";
import { GraduationCap } from "lucide-react";

const NAV = [
  { href: "/academy/courses", label: "Courses" },
  { href: "/academy/tutors", label: "1:1 Classes" },
];

export function AcademyHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/academy" className="flex items-center gap-2 font-bold text-ac-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ac-brand text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-acdisplay text-lg font-semibold tracking-tight sm:text-xl">RoboCoders Academy</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-ac-soft hover:text-ac-brand sm:inline-block"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/academy/learn"
            className="rounded-lg bg-ac-brand px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-ac-brand-dark focus-visible:ring-2 focus-visible:ring-ac-brand/40"
          >
            My account
          </Link>
        </nav>
      </div>
      <nav className="flex gap-1 border-t border-slate-100 px-4 py-1 sm:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function AcademyFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-bold text-white">RoboCoders Academy</p>
          <p className="mt-2 text-sm text-slate-400">
            Online coding, robotics and AI — self-paced courses and live 1:1 classes. By YugMinds, Hyderabad.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Learn</p>
          <ul className="mt-2 space-y-1.5">
            <li><Link href="/academy/courses" className="hover:text-white">All courses</Link></li>
            <li><Link href="/academy/tutors" className="hover:text-white">1:1 classes</Link></li>
            <li><Link href="/academy/learn" className="hover:text-white">My account</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Contact</p>
          <ul className="mt-2 space-y-1.5 text-slate-400">
            <li><a href="mailto:info@yugminds.org" className="hover:text-white">info@yugminds.org</a></li>
            <li><a href="tel:+918500345655" className="hover:text-white">+91 85003 45655</a></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} YugMinds Private Limited
      </p>
    </footer>
  );
}
