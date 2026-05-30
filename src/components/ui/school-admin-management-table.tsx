"use client";

import { useMemo } from "react";

import {
  ManagementTable,
  type ManagementTableRowAction,
} from "@/components/ui/management-table";
import {
  createSchoolAdminManagementColumns,
  type SchoolAdminManagementRow,
} from "@/components/ui/management-table-presets";

export type { SchoolAdminManagementRow };

export type SchoolAdminManagementTableProps<
  T extends SchoolAdminManagementRow = SchoolAdminManagementRow,
> = {
  rows: T[];
  loading?: boolean;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  onToggleActive: (row: T, checked: boolean) => void;
  actionLoadingId?: string | null;
  onBulkDeleteSelected?: (rows: T[]) => void;
  resetSelectionKey?: number;
  searchPlaceholder?: string;
  itemsPerPage?: number;
  emptyMessage?: string;
  className?: string;
};

export function SchoolAdminManagementTable<T extends SchoolAdminManagementRow>({
  rows,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
  actionLoadingId,
  onBulkDeleteSelected,
  resetSelectionKey,
  searchPlaceholder = "Search by name, email, phone, school…",
  itemsPerPage = 15,
  emptyMessage = "No school administrators match your filters or search.",
  className,
}: SchoolAdminManagementTableProps<T>) {
  const columns = useMemo(
    () => createSchoolAdminManagementColumns(onToggleActive, actionLoadingId),
    [onToggleActive, actionLoadingId],
  );

  const rowActions = useMemo<ManagementTableRowAction<T>[]>(
    () => [
      { id: "edit", label: "Edit", onClick: onEdit },
      {
        id: "delete",
        label: "Delete",
        destructive: true,
        onClick: onDelete,
      },
    ],
    [onEdit, onDelete],
  );

  return (
    <ManagementTable<T>
      rows={rows}
      columns={columns}
      rowActions={rowActions}
      loading={loading}
      onBulkDeleteSelected={onBulkDeleteSelected}
      resetSelectionKey={resetSelectionKey}
      actionLoadingId={actionLoadingId}
      searchPlaceholder={searchPlaceholder}
      itemsPerPage={itemsPerPage}
      emptyMessage={emptyMessage}
      entityName="administrator"
      className={className}
      getRowLabel={(row) => row.full_name}
    />
  );
}

export default SchoolAdminManagementTable;
