"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  BookOpen,
  Building,
  Calendar,
  CheckCircle,
  Key,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { ManagementTableColumn } from "@/components/ui/management-table";

// ——— Schools ———

export type SchoolManagementRow = {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  addressLine: string;
  school_admin_name?: string;
  school_admin_email?: string;
  teachersCount: number;
  studentsCount: number;
  statusLabel: string;
  is_active: boolean;
  joinCodeCount: number;
  established_year?: number;
  grades_offered?: string[];
  searchBlob: string;
  adminBlob: string;
  peopleLine: string;
  statusCodesBlob: string;
};

function schoolStatusBadge(active: boolean) {
  return active ? (
    <Badge variant="default" className="bg-green-100 text-green-800">
      <CheckCircle className="mr-1 h-3 w-3" />
      Active
    </Badge>
  ) : (
    <Badge variant="secondary" className="bg-red-100 text-red-800">
      <AlertCircle className="mr-1 h-3 w-3" />
      Inactive
    </Badge>
  );
}

export const SCHOOL_MANAGEMENT_COLUMNS: ManagementTableColumn<SchoolManagementRow>[] = [
  {
    id: "school",
    header: "School",
    headerClassName: "min-w-[220px]",
    cellClassName: "align-top",
    sortable: true,
    sortValue: (r) => r.name,
    searchValue: (r) => r.searchBlob,
    filterable: true,
    filterValue: (r) => r.searchBlob,
    render: (row) => (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">{row.name}</span>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {row.contact_email ? (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3 shrink-0" />
              {row.contact_email}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <Mail className="h-3 w-3 shrink-0" />
              No school email on file
            </div>
          )}
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 shrink-0" />
            {row.contact_phone || "—"}
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{row.addressLine || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 shrink-0" />
            Established {row.established_year ?? "N/A"}
          </div>
          {row.grades_offered && row.grades_offered.length > 0 && (
            <div className="flex items-center gap-2">
              <BookOpen className="h-3 w-3 shrink-0" />
              {row.grades_offered.length} grades
            </div>
          )}
        </div>
      </div>
    ),
  },
  {
    id: "admin",
    header: "School admin",
    headerClassName: "min-w-[160px]",
    cellClassName: "align-top",
    sortable: true,
    sortValue: (r) => r.school_admin_name ?? "",
    searchValue: (r) => r.adminBlob,
    filterable: true,
    filterValue: (r) => r.adminBlob,
    render: (row) =>
      row.school_admin_email || row.school_admin_name ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
            {row.school_admin_name || "—"}
          </div>
          {row.school_admin_email ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              {row.school_admin_email}
            </div>
          ) : null}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">No school admin</span>
      ),
  },
  {
    id: "people",
    header: "People",
    cellClassName: "align-top",
    sortable: true,
    sortValue: (r) => r.teachersCount,
    searchValue: (r) => r.peopleLine,
    filterable: true,
    filterValue: (r) => r.peopleLine,
    render: (row) => (
      <div className="space-y-1 text-sm text-muted-foreground">
        <div>
          Teachers:{" "}
          <span className="font-medium tabular-nums text-foreground">{row.teachersCount}</span>
        </div>
        <div>
          Students:{" "}
          <span className="font-medium tabular-nums text-foreground">{row.studentsCount}</span>
        </div>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status & codes",
    headerClassName: "min-w-[140px]",
    cellClassName: "align-top",
    sortable: true,
    sortValue: (r) => (r.is_active ? 1 : 0),
    searchValue: (r) => r.statusCodesBlob,
    filters: [
      { id: "statusLabel", placeholder: "Status", filterValue: (r) => r.statusLabel },
      {
        id: "joinCodeCount",
        placeholder: "Codes #",
        filterValue: (r) => String(r.joinCodeCount),
      },
    ],
    render: (row) => (
      <div className="space-y-2">
        {schoolStatusBadge(row.is_active)}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Key className="h-3 w-3 shrink-0" />
          {row.joinCodeCount} joining code{row.joinCodeCount === 1 ? "" : "s"}
        </div>
      </div>
    ),
  },
];

// ——— Students ———

export type StudentManagementRow = {
  id: string;
  full_name: string;
  email: string;
  parent_name?: string | null;
  parent_phone?: string | null;
  schoolDisplay: string;
  gradeDisplay: string;
  sectionDisplay: string;
  coursesDisplay: string;
  progress?: number;
};

function studentInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const STUDENT_AVATAR_COLORS = [
  "bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-rose-500",
  "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
];

function studentAvatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return STUDENT_AVATAR_COLORS[Math.abs(h) % STUDENT_AVATAR_COLORS.length];
}

export const STUDENT_MANAGEMENT_COLUMNS: ManagementTableColumn<StudentManagementRow>[] = [
  {
    id: "full_name",
    header: "Student",
    sortable: true,
    sortValue: (r) => r.full_name,
    searchValue: (r) => `${r.full_name} ${r.email}`,
    filterable: true,
    filterValue: (r) => r.full_name,
    render: (r) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`flex-shrink-0 h-8 w-8 rounded-full ${studentAvatarColor(r.id)} flex items-center justify-center`}>
          <span className="text-white text-[11px] font-semibold">{studentInitials(r.full_name)}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate max-w-[140px]" title={r.full_name}>{r.full_name}</p>
          <p className="text-[11px] text-gray-400 truncate max-w-[140px]" title={r.email}>{r.email}</p>
        </div>
      </div>
    ),
  },
  {
    id: "parent",
    header: "Parent / Phone",
    sortable: true,
    sortValue: (r) => r.parent_name ?? "",
    searchValue: (r) => `${r.parent_name ?? ""} ${r.parent_phone ?? ""}`,
    filterable: true,
    filterValue: (r) => String(r.parent_name ?? ""),
    render: (r) => (
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate max-w-[140px]" title={r.parent_name ?? ""}>{r.parent_name ?? "—"}</p>
        <p className="text-[11px] text-gray-400">{r.parent_phone ?? "—"}</p>
      </div>
    ),
  },
  {
    id: "school_grade",
    header: "School & Class",
    sortable: true,
    sortValue: (r) => r.schoolDisplay,
    searchValue: (r) => `${r.schoolDisplay} ${r.gradeDisplay} ${r.sectionDisplay}`,
    filterable: true,
    filterValue: (r) => `${r.schoolDisplay} ${r.gradeDisplay}`,
    render: (r) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate max-w-[160px]" title={r.schoolDisplay}>{r.schoolDisplay}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
            {r.gradeDisplay}
          </span>
          {r.sectionDisplay && r.sectionDisplay !== "—" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
              Sec {r.sectionDisplay}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    id: "coursesDisplay",
    header: "Courses",
    sortable: false,
    searchValue: (r) => r.coursesDisplay,
    filterable: true,
    filterValue: (r) => r.coursesDisplay,
    render: (r) => {
      if (!r.coursesDisplay || r.coursesDisplay === "—") {
        return <span className="text-xs text-gray-400 italic">No courses</span>;
      }
      const courses = r.coursesDisplay.split(/,\s*/);
      return (
        <div className="space-y-0.5 max-w-[180px]">
          {courses.map((c, i) => (
            <p key={i} className="text-xs text-gray-700 truncate" title={c}>{c}</p>
          ))}
        </div>
      );
    },
  },
  {
    id: "progress",
    header: "Progress",
    align: "right",
    sortable: true,
    sortValue: (r) => r.progress ?? 0,
    filterable: true,
    filterValue: (r) => String(r.progress ?? 0),
    render: (r) => {
      const pct = Math.min(100, Math.max(0, Number(r.progress ?? 0)));
      const color = pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-blue-500" : "bg-gray-300";
      return (
        <div className="flex items-center justify-end gap-2">
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs tabular-nums text-gray-600 w-8 text-right">{pct}%</span>
        </div>
      );
    },
  },
];

// ——— Teachers ———

export type TeacherManagementRow = {
  id: string;
  nameDisplay: string;
  email: string;
  phoneDisplay: string;
  qualificationDisplay: string;
  experienceDisplay: string;
  status: string;
  roleDisplay: string;
  schoolsSearchText: string;
};

function teacherStatusBadgeClass(status: string) {
  const s = status?.toLowerCase() ?? "";
  if (s === "active") return "bg-green-100 text-green-800 border border-green-200 hover:bg-green-100";
  if (s === "on leave") return "bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100";
  return "bg-red-100 text-red-800 border border-red-200 hover:bg-red-100";
}

function teacherStatusDot(status: string) {
  const s = status?.toLowerCase() ?? "";
  if (s === "active") return "bg-green-500";
  if (s === "on leave") return "bg-amber-500";
  return "bg-red-500";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500",
  "bg-teal-500", "bg-orange-500", "bg-cyan-500", "bg-rose-500",
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function createTeacherManagementColumns<T extends TeacherManagementRow>(
  renderSchoolsCell: (row: T) => ReactNode,
): ManagementTableColumn<T>[] {
  return [
    {
      id: "nameDisplay",
      header: "Teacher",
      sortable: true,
      sortValue: (r) => r.nameDisplay,
      searchValue: (r) => `${r.nameDisplay} ${r.email} ${r.phoneDisplay}`,
      filterable: true,
      filterValue: (r) => r.nameDisplay,
      render: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex-shrink-0 h-9 w-9 rounded-full ${avatarColor(r.id)} flex items-center justify-center`}>
            <span className="text-white text-xs font-semibold">{getInitials(r.nameDisplay)}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{r.nameDisplay}</p>
            <p className="text-xs text-gray-500 truncate">{r.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      sortable: false,
      searchValue: (r) => `${r.phoneDisplay} ${r.email}`,
      filterable: false,
      filterValue: (r) => r.phoneDisplay,
      render: (r) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span>{r.phoneDisplay}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="capitalize">{r.roleDisplay}</span>
          </div>
        </div>
      ),
    },
    {
      id: "qualificationDisplay",
      header: "Qualification & Exp.",
      sortable: true,
      sortValue: (r) => r.qualificationDisplay,
      searchValue: (r) => `${r.qualificationDisplay} ${r.experienceDisplay}`,
      filterable: true,
      filterValue: (r) => r.qualificationDisplay,
      render: (r) => (
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-gray-800">{r.qualificationDisplay}</p>
          <p className="text-xs text-gray-500">{r.experienceDisplay} exp.</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      searchValue: (r) => r.status,
      filterable: true,
      filterValue: (r) => r.status,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${teacherStatusDot(r.status)}`} />
          <Badge className={`text-xs font-medium ${teacherStatusBadgeClass(r.status)}`}>
            {r.status}
          </Badge>
        </div>
      ),
    },
    {
      id: "schools",
      header: "Assigned Schools",
      searchValue: (r) => r.schoolsSearchText,
      filterable: true,
      filterValue: (r) => r.schoolsSearchText,
      render: (r) => <div className="min-w-[180px]">{renderSchoolsCell(r)}</div>,
    },
  ];
}

// ——— School admins ———

export type SchoolAdminManagementRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  schoolDisplay: string;
  statusLabel: string;
  createdDisplay: string;
  is_active: boolean;
};

export function createSchoolAdminManagementColumns<T extends SchoolAdminManagementRow>(
  onToggleActive: (row: T, checked: boolean) => void,
  actionLoadingId?: string | null,
): ManagementTableColumn<T>[] {
  return [
    {
      id: "full_name",
      header: "Name",
      sortable: true,
      sortValue: (r) => r.full_name,
      searchValue: (r) => r.full_name,
      filterable: true,
      filterValue: (r) => r.full_name,
      render: (r) => (
        <div className="flex items-center gap-2 font-medium">
          <Shield className="h-4 w-4 shrink-0 text-blue-600" />
          {r.full_name}
        </div>
      ),
    },
    {
      id: "email",
      header: "Email",
      sortable: true,
      sortValue: (r) => r.email,
      searchValue: (r) => r.email,
      filterable: true,
      filterValue: (r) => r.email,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          {r.email}
        </div>
      ),
    },
    {
      id: "phone",
      header: "Phone",
      sortable: true,
      sortValue: (r) => r.phone,
      searchValue: (r) => r.phone,
      filterable: true,
      filterValue: (r) => r.phone,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
          {r.phone}
        </div>
      ),
    },
    {
      id: "schoolDisplay",
      header: "School",
      sortable: true,
      sortValue: (r) => r.schoolDisplay,
      searchValue: (r) => r.schoolDisplay,
      filterable: true,
      filterValue: (r) => r.schoolDisplay,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
          {r.schoolDisplay}
        </div>
      ),
    },
    {
      id: "is_active",
      header: "Status",
      sortable: true,
      sortValue: (r) => (r.is_active ? 1 : 0),
      searchValue: (r) => r.statusLabel,
      filterable: true,
      filterValue: (r) => r.statusLabel,
      render: (r) => (
        <SchoolAdminStatusCell
          row={r}
          onToggleActive={onToggleActive}
          actionLoadingId={actionLoadingId}
        />
      ),
    },
    {
      id: "createdDisplay",
      header: "Created",
      sortable: true,
      sortValue: (r) => r.createdDisplay,
      searchValue: (r) => r.createdDisplay,
      filterable: true,
      filterValue: (r) => r.createdDisplay,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          {r.createdDisplay}
        </div>
      ),
    },
  ];
}

function SchoolAdminStatusCell<T extends SchoolAdminManagementRow>({
  row,
  onToggleActive,
  actionLoadingId,
}: {
  row: T;
  onToggleActive: (row: T, checked: boolean) => void;
  actionLoadingId?: string | null;
}) {
  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <Switch
        checked={row.is_active === true}
        onCheckedChange={(checked) => onToggleActive(row, checked)}
        disabled={actionLoadingId === row.id}
      />
      <Badge variant={row.is_active ? "default" : "secondary"}>{row.statusLabel}</Badge>
    </div>
  );
}

// ——— Column helper (copy-paste for new pages) ———

// ——— School admin dashboard: students ———

export type SchoolAdminStudentTableRow = {
  id: string;
  nameDisplay: string;
  emailDisplay: string;
  gradeDisplay: string;
  sectionDisplay: string;
  parentNameDisplay: string;
  parentPhoneDisplay: string;
  parentPhoneHref: string | null;
  hasJoinCode: boolean;
  enrolledDisplay: string;
  statusLabel: string;
  is_active: boolean;
  searchBlob: string;
};

function SelfRegisteredBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="6" fill="#16a34a" opacity="0.15" />
        <path
          d="M3.5 6l1.8 1.8 3.2-3.6"
          stroke="#16a34a"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Self-registered
    </span>
  );
}

export const SCHOOL_ADMIN_STUDENT_COLUMNS: ManagementTableColumn<SchoolAdminStudentTableRow>[] =
  [
    {
      id: "student",
      header: "Student",
      headerClassName: "min-w-[200px]",
      sortable: true,
      sortValue: (r) => r.nameDisplay,
      searchValue: (r) => r.searchBlob,
      filterable: true,
      filterValue: (r) => r.searchBlob,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <User className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="font-medium">{row.nameDisplay}</div>
            <div className="text-sm text-muted-foreground">{row.emailDisplay}</div>
          </div>
        </div>
      ),
    },
    {
      id: "grade",
      header: "Grade",
      sortable: true,
      sortValue: (r) => r.gradeDisplay,
      searchValue: (r) => r.gradeDisplay,
      filterable: true,
      filterValue: (r) => r.gradeDisplay,
      render: (r) => <Badge variant="outline">{r.gradeDisplay}</Badge>,
    },
    {
      id: "section",
      header: "Section",
      sortable: true,
      sortValue: (r) => r.sectionDisplay,
      filterable: true,
      filterValue: (r) => r.sectionDisplay,
      render: (r) =>
        r.sectionDisplay ? (
          <Badge variant="outline">Section {r.sectionDisplay}</Badge>
        ) : (
          <span className="text-sm italic text-muted-foreground">—</span>
        ),
    },
    {
      id: "parentName",
      header: "Parent Name",
      sortable: true,
      sortValue: (r) => r.parentNameDisplay,
      filterable: true,
      filterValue: (r) => r.parentNameDisplay,
      render: (r) =>
        r.parentNameDisplay ? (
          <span className="text-sm">{r.parentNameDisplay}</span>
        ) : (
          <span className="text-sm italic text-muted-foreground">Not provided</span>
        ),
    },
    {
      id: "parentPhone",
      header: "Parent Number",
      sortable: true,
      sortValue: (r) => r.parentPhoneDisplay,
      filterable: true,
      filterValue: (r) => r.parentPhoneDisplay,
      render: (r) =>
        r.parentPhoneHref ? (
          <a
            href={r.parentPhoneHref}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {r.parentPhoneDisplay}
          </a>
        ) : (
          <span className="text-sm italic text-muted-foreground">Not provided</span>
        ),
    },
    {
      id: "enrollment",
      header: "Enrollment Source",
      sortable: true,
      sortValue: (r) => (r.hasJoinCode ? 1 : 0),
      filterable: true,
      filterValue: (r) => (r.hasJoinCode ? "self-registered" : ""),
      render: (r) => (r.hasJoinCode ? <SelfRegisteredBadge /> : <span className="text-sm text-muted-foreground">—</span>),
    },
    {
      id: "enrolled",
      header: "Enrolled",
      sortable: true,
      sortValue: (r) => r.enrolledDisplay,
      filterable: true,
      filterValue: (r) => r.enrolledDisplay,
      render: (r) => (
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="mr-1 h-4 w-4 shrink-0" />
          {r.enrolledDisplay}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => (r.is_active ? 1 : 0),
      filterable: true,
      filterValue: (r) => r.statusLabel,
      render: (r) => (
        <Badge variant={r.is_active ? "default" : "secondary"}>{r.statusLabel}</Badge>
      ),
    },
  ];

// ——— School admin dashboard: teachers ———

export type SchoolAdminTeacherTableRow = {
  id: string;
  nameDisplay: string;
  emailDisplay: string;
  qualificationDisplay: string;
  specializationDisplay: string;
  leavesDisplay: string;
  leavesCount: number;
  statusLabel: string;
  searchBlob: string;
};

function schoolAdminTeacherStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" {
  const s = status?.toLowerCase() ?? "";
  if (s === "active") return "default";
  if (s === "on leave") return "secondary";
  return "destructive";
}

export const SCHOOL_ADMIN_TEACHER_COLUMNS: ManagementTableColumn<SchoolAdminTeacherTableRow>[] =
  [
    {
      id: "teacher",
      header: "Teacher",
      headerClassName: "min-w-[200px]",
      sortable: true,
      sortValue: (r) => r.nameDisplay,
      searchValue: (r) => r.searchBlob,
      filterable: true,
      filterValue: (r) => r.searchBlob,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
            <User className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <div className="font-medium">{row.nameDisplay}</div>
            <div className="text-sm text-muted-foreground">{row.emailDisplay}</div>
          </div>
        </div>
      ),
    },
    {
      id: "qualification",
      header: "Qualification",
      sortable: true,
      sortValue: (r) => r.qualificationDisplay,
      searchValue: (r) => `${r.qualificationDisplay} ${r.specializationDisplay}`,
      filterable: true,
      filterValue: (r) => `${r.qualificationDisplay} ${r.specializationDisplay}`,
      render: (r) => (
        <div>
          <div className="text-sm">{r.qualificationDisplay}</div>
          {r.specializationDisplay ? (
            <div className="text-xs text-muted-foreground">{r.specializationDisplay}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "leaves",
      header: "Leaves Taken",
      sortable: true,
      sortValue: (r) => r.leavesCount,
      filterable: true,
      filterValue: (r) => r.leavesDisplay,
      render: (r) => <span className="text-sm">{r.leavesDisplay}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.statusLabel,
      filterable: true,
      filterValue: (r) => r.statusLabel,
      render: (r) => (
        <Badge variant={schoolAdminTeacherStatusVariant(r.statusLabel)}>{r.statusLabel}</Badge>
      ),
    },
  ];

export function textColumn<T extends { id: string }>(opts: {
  id: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  filterable?: boolean;
  includeInSearch?: boolean;
  align?: "left" | "right" | "center";
  cellClassName?: string;
  headerClassName?: string;
  render?: (row: T, text: string) => ReactNode;
}): ManagementTableColumn<T> {
  const text = (row: T) => {
    const v = opts.accessor(row);
    return v == null ? "" : String(v);
  };
  return {
    id: opts.id,
    header: opts.header,
    align: opts.align,
    cellClassName: opts.cellClassName,
    headerClassName: opts.headerClassName,
    sortable: opts.sortable,
    sortValue: opts.sortable ? (row) => opts.accessor(row) : undefined,
    searchValue: opts.includeInSearch !== false ? (row) => text(row) : undefined,
    filterable: opts.filterable,
    filterValue: opts.filterable ? text : undefined,
    render: (row) => (opts.render ? opts.render(row, text(row)) : text(row) || "—"),
  };
}
