"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  ManagementTable,
  type ManagementTableRowAction,
} from "@/components/ui/management-table";
import {
  createTeacherManagementColumns,
  type TeacherManagementRow,
} from "@/components/ui/management-table-presets";

export type { TeacherManagementRow };

export type TeacherManagementTableProps<T extends TeacherManagementRow = TeacherManagementRow> =
  {
    rows: T[];
    loading?: boolean;
    onView: (row: T) => void;
    onEdit: (row: T) => void;
    onDelete: (row: T) => void;
    onBulkDeleteSelected?: (rows: T[]) => void;
    resetSelectionKey?: number;
    renderSchoolsCell: (row: T) => ReactNode;
    searchPlaceholder?: string;
    itemsPerPage?: number;
    emptyMessage?: string;
    className?: string;
  };

export function TeacherManagementTable<T extends TeacherManagementRow>({
  rows,
  loading,
  onView,
  onEdit,
  onDelete,
  onBulkDeleteSelected,
  resetSelectionKey,
  renderSchoolsCell,
  searchPlaceholder = "Search teachers by name, email, school, qualification…",
  itemsPerPage = 15,
  emptyMessage = "No teachers match your filters or search.",
  className,
}: TeacherManagementTableProps<T>) {
  const columns = useMemo(
    () => createTeacherManagementColumns(renderSchoolsCell),
    [renderSchoolsCell],
  );

  const rowActions = useMemo<ManagementTableRowAction<T>[]>(
    () => [
      { id: "view", label: "View", onClick: onView },
      { id: "edit", label: "Edit", onClick: onEdit },
      {
        id: "delete",
        label: "Delete",
        destructive: true,
        onClick: onDelete,
      },
    ],
    [onView, onEdit, onDelete],
  );

  return (
    <ManagementTable<T>
      rows={rows}
      columns={columns}
      rowActions={rowActions}
      loading={loading}
      onBulkDeleteSelected={onBulkDeleteSelected}
      resetSelectionKey={resetSelectionKey}
      searchPlaceholder={searchPlaceholder}
      itemsPerPage={itemsPerPage}
      emptyMessage={emptyMessage}
      entityName="teacher"
      className={className}
      getRowLabel={(row) => row.nameDisplay}
    />
  );
}

export default TeacherManagementTable;
