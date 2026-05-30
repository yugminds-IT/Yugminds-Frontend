"use client";

import {
  ManagementTable,
} from "@/components/ui/management-table";
import {
  SCHOOL_ADMIN_TEACHER_COLUMNS,
  type SchoolAdminTeacherTableRow,
} from "@/components/ui/management-table-presets";

export type { SchoolAdminTeacherTableRow };

export type SchoolAdminTeacherManagementTableProps<
  T extends SchoolAdminTeacherTableRow = SchoolAdminTeacherTableRow,
> = {
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  itemsPerPage?: number;
};

/** View-only teachers list for school admins (no row actions or bulk delete). */
export function SchoolAdminTeacherManagementTable<
  T extends SchoolAdminTeacherTableRow,
>({
  rows,
  loading,
  emptyMessage = "No teachers match your filters or search.",
  className,
  itemsPerPage = 15,
}: SchoolAdminTeacherManagementTableProps<T>) {
  return (
    <ManagementTable<T>
      rows={rows}
      columns={SCHOOL_ADMIN_TEACHER_COLUMNS}
      loading={loading}
      enableSelection={false}
      hideToolbarSearch
      emptyMessage={emptyMessage}
      entityName="teacher"
      itemsPerPage={itemsPerPage}
      className={className}
      getRowLabel={(row) => row.nameDisplay}
    />
  );
}

export default SchoolAdminTeacherManagementTable;
