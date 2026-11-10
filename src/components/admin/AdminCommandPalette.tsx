"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Modal from "../portal/Modal";
import { School, Users, User, BookOpen, Search, ArrowRight, Loader2 } from "lucide-react";
import "./overview/overview.css";
import { adminApi, setAuthToken } from "../../lib/api";
import { getSession } from "../../lib/session-utils";

interface ResultItem {
  id: string;
  label: string;
  sublabel?: string;
  type: "school" | "teacher" | "student" | "course" | "page";
  href: string;
}

interface SearchHit {
  id: string;
  label: string;
  sublabel: string | null;
}

async function ensureAccessToken(): Promise<void> {
  const { data } = await getSession();
  const token = data.session?.access_token ?? null;
  if (token) setAuthToken(token);
}

const TYPE_ICON = { school: School, teacher: Users, student: User, course: BookOpen, page: ArrowRight };
const TYPE_LABEL = { school: "School", teacher: "Teacher", student: "Student", course: "Course", page: "Page" };

/** Static navigation targets so the palette doubles as a "go to page" launcher. */
const PAGES: Array<{ label: string; href: string; keywords: string }> = [
  { label: "Dashboard Overview", href: "/lms/admin", keywords: "home overview dashboard" },
  { label: "Schools Management", href: "/lms/admin/schools", keywords: "schools tenant" },
  { label: "School Admin Management", href: "/lms/admin/school-admins", keywords: "school admins" },
  { label: "Teachers Management", href: "/lms/admin/teachers", keywords: "teachers staff" },
  { label: "Students Management", href: "/lms/admin/students", keywords: "students accounts" },
  { label: "Course Management", href: "/lms/admin/courses", keywords: "courses content builder" },
  { label: "Course Progress", href: "/lms/admin/student-progress", keywords: "progress completion" },
  { label: "Certificates", href: "/lms/admin/certificates", keywords: "certificates awards" },
  { label: "Notifications", href: "/lms/admin/notifications", keywords: "notifications announcements" },
  { label: "Password Reset Requests", href: "/lms/admin/password-reset-requests", keywords: "password reset" },
  { label: "Teacher Reports", href: "/lms/admin/reports", keywords: "reports daily attendance" },
  { label: "Joining Codes", href: "/lms/admin/joining-codes", keywords: "joining codes invite" },
  { label: "RoboCoders Licenses", href: "/lms/admin/licenses", keywords: "licenses activation robocoders" },
  { label: "School Logo Management", href: "/lms/admin/logos", keywords: "logos branding" },
  { label: "Community Management", href: "/lms/admin/community", keywords: "community cms" },
  { label: "Performance Analytics", href: "/lms/admin/analytics", keywords: "analytics performance charts" },
  { label: "Assignment Analytics", href: "/lms/admin/assignment-analytics", keywords: "assignments analytics" },
  { label: "System Monitoring", href: "/lms/admin/monitoring", keywords: "monitoring health cache" },
  { label: "Audit Log", href: "/lms/admin/audit-log", keywords: "audit log history changes who" },
  { label: "System Controls", href: "/lms/admin/system-controls", keywords: "maintenance feature flags announcement controls" },
  { label: "Trash", href: "/lms/admin/trash", keywords: "trash deleted restore recycle" },
  { label: "Contact Submissions", href: "/lms/admin/contact-submissions", keywords: "contact submissions inquiries" },
  { label: "Settings", href: "/lms/admin/settings", keywords: "settings profile security" },
];

export default function AdminCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Resets query/selection whenever the palette closes — routed through one
  // setter so this never needs a separate effect reacting to `open`.
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
    }
  };

  // ⌘K / Ctrl+K opens the palette from anywhere in the admin area.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          const next = !v;
          if (!next) { setQuery(""); setDebounced(""); setActiveIndex(0); }
          return next;
        });
      }
    };
    // The dashboard's Search button asks for the palette through this event, so it opens from anywhere without props.
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("admin-palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("admin-palette:open", onOpen);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Server-side entity search: covers every record in the database (not a
  // client-side preload), debounced per keystroke, cached briefly per query.
  const { data: hits, isFetching } = useQuery({
    queryKey: ["admin", "palette", "search", debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
    queryFn: async () => {
      await ensureAccessToken();
      const { data } = await adminApi.search(debounced);
      return data as {
        schools: SearchHit[];
        teachers: SearchHit[];
        students: SearchHit[];
        courses: SearchHit[];
      };
    },
  });

  const results: ResultItem[] = useMemo(() => {
    const q = debounced.toLowerCase();
    if (q.length < 2) return [];
    const pageItems: ResultItem[] = PAGES.filter(
      (p) => p.label.toLowerCase().includes(q) || p.keywords.includes(q),
    ).map((p) => ({ id: p.href, label: p.label, type: "page", href: p.href }));

    const entity = (
      list: SearchHit[] | undefined,
      type: ResultItem["type"],
      href: string,
    ): ResultItem[] =>
      (list ?? []).map((h) => ({
        id: h.id,
        label: h.label,
        sublabel: h.sublabel ?? undefined,
        type,
        href,
      }));

    return [
      ...pageItems.slice(0, 4),
      ...entity(hits?.schools, "school", "/lms/admin/schools"),
      ...entity(hits?.teachers, "teacher", "/lms/admin/teachers"),
      ...entity(hits?.students, "student", "/lms/admin/students"),
      ...entity(hits?.courses, "course", "/lms/admin/courses"),
    ].slice(0, 24);
  }, [hits, debounced]);

  const goTo = (item: ResultItem) => {
    changeOpen(false);
    router.push(item.href);
  };

  return (
    <Modal open={open} onClose={() => changeOpen(false)} title="Search" subtitle="Pages, schools, teachers, students and courses.">
      <div className="ao-pal">
        <div className="ao-pal-input">
          {isFetching ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
          <input
            className="sd-field"
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="ao-pal-list"
            aria-label="Search everything"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter" && results[activeIndex]) { goTo(results[activeIndex]); }
            }}
            placeholder="Type a name, a school or a page"
            autoFocus
          />
        </div>

        {debounced.length < 2 ? (
          <p className="ao-pal-note">Type at least 2 characters to search everything.</p>
        ) : results.length === 0 && !isFetching ? (
          <p className="ao-pal-note">No matches for &ldquo;{debounced}&rdquo;.</p>
        ) : (
          <ul id="ao-pal-list" className="ao-pal-list" role="listbox" aria-label="Results">
            {results.map((item, idx) => {
              const Icon = TYPE_ICON[item.type];
              return (
                <li key={`${item.type}-${item.id}`} role="presentation">
                  <button type="button" role="option" aria-selected={idx === activeIndex} className="ao-hit" onClick={() => goTo(item)} onMouseEnter={() => setActiveIndex(idx)}>
                    <span className="ao-hit-ico" aria-hidden="true"><Icon /></span>
                    <span><b>{item.label}</b>{item.sublabel && <small>{item.sublabel}</small>}</span>
                    <span className="ao-hit-type">{TYPE_LABEL[item.type]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="ao-pal-foot">Arrow keys to move, Enter to open, Esc to close.</p>
      </div>
    </Modal>
  );
}
