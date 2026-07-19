"use client";

import { useMemo } from "react";
import { Key, Eye } from "lucide-react";

import {
  ManagementTable,
  type ManagementTableRowAction,
} from "@/components/ui/management-table";
import {
  SCHOOL_MANAGEMENT_COLUMNS,
  type SchoolManagementRow,
} from "@/components/ui/management-table-presets";

export type { SchoolManagementRow };

export type SchoolManagementTableProps<T extends SchoolManagementRow = SchoolManagementRow> =
  {
    rows: T[];
    loading?: boolean;
    /** optional — adds a "View details" row action linking to a school drill-down page */
    onView?: (row: T) => void;
    onManageJoinCodes: (row: T) => void;
    onEdit: (row: T) => void;
    onToggleActive: (row: T) => void;
    onDelete: (row: T) => void;
    onBulkDeleteSelected?: (rows: T[]) => void;
    resetSelectionKey?: number;
    actionLoadingId?: string | null;
    searchPlaceholder?: string;
    itemsPerPage?: number;
    emptyMessage?: string;
    className?: string;
  };

export function SchoolManagementTable<T extends SchoolManagementRow>({
  rows,
  loading,
  onView,
  onManageJoinCodes,
  onEdit,
  onToggleActive,
  onDelete,
  onBulkDeleteSelected,
  resetSelectionKey,
  actionLoadingId,
  searchPlaceholder = "Search schools by name, email, admin, city, or state…",
  itemsPerPage = 15,
  emptyMessage = "No schools match your filters or search.",
  className,
}: SchoolManagementTableProps<T>) {
  const rowActions = useMemo<ManagementTableRowAction<T>[]>(
    () => [
      ...(onView
        ? [
            {
              id: "view",
              label: "View details",
              icon: <Eye className="h-4 w-4" />,
              onClick: onView,
            } satisfies ManagementTableRowAction<T>,
          ]
        : []),
      {
        id: "join-codes",
        label: "Manage joining codes",
        icon: <Key className="h-4 w-4" />,
        onClick: onManageJoinCodes,
      },
      { id: "edit", label: "Edit school", onClick: onEdit },
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
    [onView, onManageJoinCodes, onEdit, onToggleActive, onDelete],
  );

  return (
    <ManagementTable<T>
      rows={rows}
      columns={SCHOOL_MANAGEMENT_COLUMNS}
      rowActions={rowActions}
      loading={loading}
      onBulkDeleteSelected={onBulkDeleteSelected}
      resetSelectionKey={resetSelectionKey}
      actionLoadingId={actionLoadingId}
      searchPlaceholder={searchPlaceholder}
      itemsPerPage={itemsPerPage}
      emptyMessage={emptyMessage}
      entityName="school"
      className={className}
      getRowLabel={(row) => row.name}
    />
  );
}

export default SchoolManagementTable;
