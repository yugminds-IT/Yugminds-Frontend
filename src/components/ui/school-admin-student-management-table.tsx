"use client";

import { useMemo } from "react";

import {
  ManagementTable,
  type ManagementTableRowAction,
  type ManagementTableServerPagination,
} from "@/components/ui/management-table";
import {
  SCHOOL_ADMIN_STUDENT_COLUMNS,
  type SchoolAdminStudentTableRow,
} from "@/components/ui/management-table-presets";

export type { SchoolAdminStudentTableRow };

export type SchoolAdminStudentManagementTableProps<
  T extends SchoolAdminStudentTableRow = SchoolAdminStudentTableRow,
> = {
  rows: T[];
  loading?: boolean;
  onView: (row: T) => void;
  onEdit: (row: T) => void;
  onToggleActive: (row: T) => void;
  onDelete: (row: T) => void;
  onBulkDeleteSelected?: (rows: T[]) => void;
  resetSelectionKey?: number;
  actionLoadingId?: string | null;
  emptyMessage?: string;
  className?: string;
  serverPagination: ManagementTableServerPagination;
};

export function SchoolAdminStudentManagementTable<
  T extends SchoolAdminStudentTableRow,
>({
  rows,
  loading,
  onView,
  onEdit,
  onToggleActive,
  onDelete,
  onBulkDeleteSelected,
  resetSelectionKey,
  actionLoadingId,
  emptyMessage = "No students match your filters or search.",
  className,
  serverPagination,
}: SchoolAdminStudentManagementTableProps<T>) {
  const rowActions = useMemo<ManagementTableRowAction<T>[]>(
    () => [
      { id: "view", label: "View details", onClick: onView },
      { id: "edit", label: "Edit", onClick: onEdit },
      {
        id: "toggle",
        label: "Toggle status",
        getLabel: (row) => (row.is_active ? "Deactivate" : "Activate"),
        onClick: onToggleActive,
      },
      {
        id: "delete",
        label: "Delete",
        destructive: true,
        separatorBefore: true,
        onClick: onDelete,
      },
    ],
    [onView, onEdit, onToggleActive, onDelete],
  );

  return (
    <ManagementTable<T>
      rows={rows}
      columns={SCHOOL_ADMIN_STUDENT_COLUMNS}
      rowActions={rowActions}
      loading={loading}
      onBulkDeleteSelected={onBulkDeleteSelected}
      resetSelectionKey={resetSelectionKey}
      actionLoadingId={actionLoadingId}
      hideToolbarSearch
      serverPagination={serverPagination}
      emptyMessage={emptyMessage}
      entityName="student"
      className={className}
      getRowLabel={(row) => row.nameDisplay}
    />
  );
}

export default SchoolAdminStudentManagementTable;
