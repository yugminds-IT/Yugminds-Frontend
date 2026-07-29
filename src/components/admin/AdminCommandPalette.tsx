"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import {
  School,
  Users,
  User,
  BookOpen,
  Search,
  CornerDownLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
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
      if (e.key === "Escape") changeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    <>
      <button
        onClick={() => changeOpen(true)}
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
        aria-label="Search schools, teachers, students, courses"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0 gap-0 top-[20%] translate-y-0">
          <DialogTitle className="sr-only">Search pages, schools, teachers, students, courses</DialogTitle>
          <div className="flex items-center gap-2 border-b border-gray-100 pl-4 pr-10 py-3">
            {isFetching ? (
              <Loader2 className="h-4 w-4 text-gray-400 shrink-0 animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
            )}
            <Input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter" && results[activeIndex]) { goTo(results[activeIndex]); }
              }}
              placeholder="Search pages, schools, teachers, students, courses…"
              className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto text-sm"
            />
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {debounced.length < 2 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                Type at least 2 characters to search everything.
              </p>
            ) : results.length === 0 && !isFetching ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No matches.</p>
            ) : (
              results.map((item, idx) => {
                const Icon = TYPE_ICON[item.type];
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => goTo(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      idx === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{item.label}</p>
                      {item.sublabel && <p className="truncate text-xs text-gray-500">{item.sublabel}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      {TYPE_LABEL[item.type]}
                    </span>
                    {idx === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
