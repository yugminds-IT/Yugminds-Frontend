/**
 * Single source of truth for turning a notification's raw backend `type`
 * (e.g. "assignment_retake_request", "grade_posted") into a human-readable
 * label + color, shared across every role's notifications page so they all
 * render the same real backend values consistently instead of each
 * reinventing an incomplete dictionary.
 *
 * Any type not explicitly listed here still gets a readable fallback label
 * (title-cased from the raw string) rather than leaking the raw enum text.
 */

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ClipboardList,
  RefreshCw,
  Award,
  MessageSquare,
  Calendar,
  Users,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Trophy,
} from "lucide-react";

export interface NotificationTypeDisplay {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for a colored badge/card accent. */
  badgeClassName: string;
  cardClassName: string;
}

const DEFAULT_DISPLAY: Omit<NotificationTypeDisplay, "label"> = {
  icon: Bell,
  badgeClassName: "bg-gray-50 text-gray-700 border-gray-200",
  cardClassName: "bg-gray-50 border-gray-200",
};

const KNOWN_TYPES: Record<string, NotificationTypeDisplay> = {
  assignment_due: {
    label: "Assignment Due",
    icon: ClipboardList,
    badgeClassName: "bg-orange-50 text-orange-700 border-orange-200",
    cardClassName: "bg-orange-50 border-orange-200",
  },
  assignment_retake_request: {
    label: "Retake Request",
    icon: RefreshCw,
    badgeClassName: "bg-purple-50 text-purple-700 border-purple-200",
    cardClassName: "bg-purple-50 border-purple-200",
  },
  grade_posted: {
    label: "Grade Posted",
    icon: Award,
    badgeClassName: "bg-green-50 text-green-700 border-green-200",
    cardClassName: "bg-green-50 border-green-200",
  },
  student_message: {
    label: "Message",
    icon: MessageSquare,
    badgeClassName: "bg-blue-50 text-blue-700 border-blue-200",
    cardClassName: "bg-blue-50 border-blue-200",
  },
  schedule: {
    label: "Schedule",
    icon: Calendar,
    badgeClassName: "bg-indigo-50 text-indigo-700 border-indigo-200",
    cardClassName: "bg-indigo-50 border-indigo-200",
  },
  students: {
    label: "Students",
    icon: Users,
    badgeClassName: "bg-teal-50 text-teal-700 border-teal-200",
    cardClassName: "bg-teal-50 border-teal-200",
  },
  certificate: {
    label: "Certificate",
    icon: Trophy,
    badgeClassName: "bg-yellow-50 text-yellow-700 border-yellow-200",
    cardClassName: "bg-yellow-50 border-yellow-200",
  },
  course_enrollment: {
    label: "Course Enrollment",
    icon: BookOpen,
    badgeClassName: "bg-blue-50 text-blue-700 border-blue-200",
    cardClassName: "bg-blue-50 border-blue-200",
  },
  system_alert: {
    label: "System Alert",
    icon: AlertTriangle,
    badgeClassName: "bg-red-50 text-red-700 border-red-200",
    cardClassName: "bg-red-50 border-red-200",
  },
  achievement: {
    label: "Achievement",
    icon: Trophy,
    badgeClassName: "bg-yellow-50 text-yellow-700 border-yellow-200",
    cardClassName: "bg-yellow-50 border-yellow-200",
  },
  info: {
    label: "Info",
    icon: Info,
    badgeClassName: "bg-blue-50 text-blue-700 border-blue-200",
    cardClassName: "bg-blue-50 border-blue-200",
  },
  success: {
    label: "Success",
    icon: CheckCircle,
    badgeClassName: "bg-green-50 text-green-700 border-green-200",
    cardClassName: "bg-green-50 border-green-200",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
    cardClassName: "bg-amber-50 border-amber-200",
  },
  error: {
    label: "Error",
    icon: XCircle,
    badgeClassName: "bg-red-50 text-red-700 border-red-200",
    cardClassName: "bg-red-50 border-red-200",
  },
  general: {
    label: "General",
    ...DEFAULT_DISPLAY,
  },
};

function titleCase(raw: string): string {
  const words = raw.toLowerCase().split(/[_\s]+/).filter(Boolean);
  if (words.length === 0) return "General";
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function formatNotificationType(
  type: string | null | undefined,
): NotificationTypeDisplay {
  const key = (type ?? "general").trim().toLowerCase();
  const known = KNOWN_TYPES[key];
  if (known) return known;
  return { label: titleCase(key), ...DEFAULT_DISPLAY };
}
