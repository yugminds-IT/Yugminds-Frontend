"use client";

import { useMemo } from "react";

import {
  ManagementTable,
  type ManagementTableRowAction,
  type ManagementTableBulkAction,
} from "@/components/ui/management-table";
import {
  STUDENT_MANAGEMENT_COLUMNS,
  type StudentManagementRow,
} from "@/components/ui/management-table-presets";

export type { StudentManagementRow };

export type StudentManagementTableProps<T extends StudentManagementRow = StudentManagementRow> =
  {
    rows: T[];
    loading?: boolean;
    onView: (row: T) => void;
    onEdit: (row: T) => void;
    onDelete: (row: T) => void;
    onEnroll?: (row: T) => void;
    onBulkDeleteSelected?: (rows: T[]) => void;
    bulkActions?: ManagementTableBulkAction<T>[];
    resetSelectionKey?: number;
    searchPlaceholder?: string;
    itemsPerPage?: number;
    emptyMessage?: string;
    className?: string;
  };

export function StudentManagementTable<T extends StudentManagementRow>({
  rows,
  loading,
  onView,
  onEdit,
  onDelete,
  onEnroll,
  onBulkDeleteSelected,
  bulkActions,
  resetSelectionKey,
  searchPlaceholder = "Search students by name, email, school, grade...",
  itemsPerPage = 15,
  emptyMessage = "No students match your filters or search.",
  className,
}: StudentManagementTableProps<T>) {
  const rowActions = useMemo<ManagementTableRowAction<T>[]>(
    () => [
      { id: "view", label: "View", onClick: onView },
      { id: "edit", label: "Edit", onClick: onEdit },
      ...(onEnroll
        ? [{ id: "enroll", label: "Enroll in Courses", onClick: onEnroll }]
        : []),
      {
        id: "delete",
        label: "Delete",
        destructive: true,
        onClick: onDelete,
      },
    ],
    [onView, onEdit, onDelete, onEnroll],
  );

  return (
    <ManagementTable<T>
      rows={rows}
      columns={STUDENT_MANAGEMENT_COLUMNS}
      rowActions={rowActions}
      loading={loading}
      onBulkDeleteSelected={onBulkDeleteSelected}
      bulkActions={bulkActions}
      resetSelectionKey={resetSelectionKey}
      searchPlaceholder={searchPlaceholder}
      itemsPerPage={itemsPerPage}
      emptyMessage={emptyMessage}
      entityName="student"
      className={className}
      getRowLabel={(row) => row.full_name}
    />
  );
}

export default StudentManagementTable;
