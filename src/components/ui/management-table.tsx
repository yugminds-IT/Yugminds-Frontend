"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Filter,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Minimum row shape — every table row must have a stable `id`. */
export type ManagementTableRow = { id: string };

export type ManagementTableColumnFilter<T extends ManagementTableRow> = {
  id: string;
  placeholder?: string;
  filterValue: (row: T) => string;
};

export type ManagementTableColumn<T extends ManagementTableRow> = {
  id: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | boolean | null | undefined;
  searchValue?: (row: T) => string | number | null | undefined;
  filterable?: boolean;
  filterValue?: (row: T) => string;
  filterPlaceholder?: string;
  filters?: ManagementTableColumnFilter<T>[];
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
};

export type ManagementTableRowAction<T extends ManagementTableRow> = {
  id: string;
  label: string;
  /** When set, overrides `label` per row (e.g. Activate vs Deactivate). */
  getLabel?: (row: T) => string;
  onClick: (row: T) => void;
  icon?: ReactNode;
  destructive?: boolean;
  separatorBefore?: boolean;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
};

export type ManagementTableServerPagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

export type ManagementTableProps<T extends ManagementTableRow> = {
  rows: T[];
  columns: ManagementTableColumn<T>[];
  rowActions?: ManagementTableRowAction<T>[];
  loading?: boolean;
  onBulkDeleteSelected?: (rows: T[]) => void;
  resetSelectionKey?: number;
  actionLoadingId?: string | null;
  searchPlaceholder?: string;
  itemsPerPage?: number;
  emptyMessage?: string;
  entityName?: string;
  className?: string;
  getRowLabel?: (row: T) => string;
  toolbarExtra?: ReactNode;
  globalSearch?: (row: T, query: string) => boolean;
  /** Hide built-in search (use external filters that call the API). */
  hideToolbarSearch?: boolean;
  /** Server-driven paging; rows are already one page from the API. */
  serverPagination?: ManagementTableServerPagination;
  /** Row checkboxes and selection footer (default true). */
  enableSelection?: boolean;
};

function FilterInput({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Filter className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
      <input
        type="text"
        placeholder={placeholder ?? "Filter..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-[4rem] rounded-md border border-input bg-background py-1.5 pl-7 pr-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

function getColumnFilterDefs<T extends ManagementTableRow>(
  col: ManagementTableColumn<T>,
): ManagementTableColumnFilter<T>[] {
  if (col.filters?.length) return col.filters;
  if (col.filterable && col.filterValue) {
    return [{ id: col.id, placeholder: col.filterPlaceholder, filterValue: col.filterValue }];
  }
  return [];
}

export function ManagementTable<T extends ManagementTableRow>({
  rows,
  columns,
  rowActions = [],
  loading = false,
  onBulkDeleteSelected,
  resetSelectionKey,
  actionLoadingId = null,
  searchPlaceholder = "Search…",
  itemsPerPage = 15,
  emptyMessage = "No rows match your filters or search.",
  entityName = "row",
  className,
  getRowLabel,
  toolbarExtra,
  globalSearch,
  hideToolbarSearch = false,
  serverPagination,
  enableSelection = true,
}: ManagementTableProps<T>) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const resetKeyPrev = useRef<number | undefined>(undefined);
  const [sortColumnId, setSortColumnId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const hasActions = rowActions.length > 0;
  const colSpan =
    columns.length + (enableSelection ? 1 : 0) + (hasActions ? 1 : 0);

  const searchColumns = useMemo(
    () => columns.filter((c) => c.searchValue),
    [columns],
  );

  useEffect(() => {
    if (resetSelectionKey === undefined) return;
    if (resetKeyPrev.current === undefined) {
      resetKeyPrev.current = resetSelectionKey;
      return;
    }
    if (resetKeyPrev.current !== resetSelectionKey) {
      resetKeyPrev.current = resetSelectionKey;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected([]);
    }
  }, [resetSelectionKey]);

  const isServerPaged = !!serverPagination;
  const showToolbar =
    !hideToolbarSearch || !!toolbarExtra || !!onBulkDeleteSelected;

  const filtered = useMemo(() => {
    let list = [...rows];

    if (!hideToolbarSearch && search.trim()) {
      const q = search.toLowerCase();
      if (globalSearch) {
        list = list.filter((row) => globalSearch(row, q));
      } else if (searchColumns.length > 0) {
        list = list.filter((row) =>
          searchColumns.some((col) => {
            const v = col.searchValue!(row);
            return v != null && String(v).toLowerCase().includes(q);
          }),
        );
      } else {
        list = list.filter((row) =>
          columns.some((col) => {
            const v = col.sortValue?.(row) ?? col.filterValue?.(row);
            return v != null && String(v).toLowerCase().includes(q);
          }),
        );
      }
    }

    for (const col of columns) {
      for (const f of getColumnFilterDefs(col)) {
        const raw = columnFilters[f.id]?.trim();
        if (!raw) continue;
        const q = raw.toLowerCase();
        list = list.filter((row) =>
          f.filterValue(row).toLowerCase().includes(q),
        );
      }
    }

    return list;
  }, [rows, search, columnFilters, columns, globalSearch, searchColumns, hideToolbarSearch]);

  const sortColumn = useMemo(
    () => columns.find((c) => c.id === sortColumnId),
    [columns, sortColumnId],
  );

  const sorted = useMemo(() => {
    if (!sortColumn?.sortValue) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = sortColumn.sortValue;
    return [...filtered].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      if (typeof av === "boolean" && typeof bv === "boolean") {
        return (Number(av) - Number(bv)) * dir;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1 * dir;
      if (bv == null) return -1 * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sortColumn, sortDir]);

  const clientPageSize = isServerPaged ? serverPagination.pageSize : itemsPerPage;
  const totalCount = isServerPaged ? serverPagination.total : sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / clientPageSize));
  const currentPage = isServerPaged
    ? Math.min(serverPagination.page, totalPages)
    : Math.min(page, totalPages);
  const start = (currentPage - 1) * clientPageSize;
  const pageRows = isServerPaged
    ? sorted
    : sorted.slice(start, start + clientPageSize);
  const pageIds = pageRows.map((r) => r.id);
  const pageSizeOptions = serverPagination?.pageSizeOptions ?? [25, 50, 100];

  const toggleSort = (col: ManagementTableColumn<T>) => {
    if (!col.sortable || !col.sortValue) return;
    if (sortColumnId === col.id) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumnId(col.id);
      setSortDir("asc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAllPage = (checked: boolean) => {
    if (checked) {
      setSelected((prev) => [...new Set([...prev, ...pageIds])]);
    } else {
      setSelected((prev) => prev.filter((id) => !pageIds.includes(id)));
    }
  };

  const selectedRowsForBulk = useMemo(
    () => rows.filter((r) => selected.includes(r.id)),
    [rows, selected],
  );

  const headerSortIcon = (columnId: string) => (
    <span className="inline-flex flex-col leading-none">
      <ChevronUp
        className={cn(
          "h-3 w-3",
          sortColumnId === columnId && sortDir === "asc"
            ? "text-primary"
            : "text-muted-foreground/40",
        )}
      />
      <ChevronDown
        className={cn(
          "h-3 w-3 -mt-1",
          sortColumnId === columnId && sortDir === "desc"
            ? "text-primary"
            : "text-muted-foreground/40",
        )}
      />
    </span>
  );

  const alignClass = (align?: "left" | "right" | "center") => {
    if (align === "right") return "text-right";
    if (align === "center") return "text-center";
    return "text-left";
  };

  if (loading) {
    return (
      <div
        className={cn(
          "w-full overflow-hidden rounded-md border border-border bg-background shadow-sm",
          className,
        )}
      >
        <div className="animate-pulse space-y-0 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-10 max-w-md flex-1 rounded-md bg-muted" />
            <div className="hidden h-9 w-36 shrink-0 rounded-md bg-muted sm:block" />
          </div>
          <div className="h-12 rounded-t-md bg-muted/80" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 border-t border-border bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-md border border-border bg-background shadow-sm",
        className,
      )}
    >
      {showToolbar && (
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {!hideToolbarSearch ? (
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        ) : null}
        <div
          className={cn(
            "flex shrink-0 items-center justify-end gap-2 sm:min-h-10",
            hideToolbarSearch && "w-full",
          )}
        >
          {toolbarExtra}
          {selected.length > 0 && onBulkDeleteSelected && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9 gap-1.5 self-end sm:self-auto"
              onClick={() => onBulkDeleteSelected(selectedRowsForBulk)}
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </Button>
          )}
        </div>
      </div>
      )}

      <div className="max-h-[min(560px,70vh)] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
            <TableRow className="border-b border-border hover:bg-transparent">
              {enableSelection && (
                <TableHead className="w-10 bg-background">
                  <Checkbox
                    checked={
                      pageIds.length > 0 && pageIds.every((id) => selected.includes(id))
                    }
                    onCheckedChange={(c) => toggleSelectAllPage(Boolean(c))}
                    aria-label="Select all on this page"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    "bg-background font-medium text-muted-foreground",
                    col.sortable && col.sortValue && "cursor-pointer",
                    alignClass(col.align),
                    col.headerClassName,
                  )}
                  onClick={() => toggleSort(col)}
                >
                  <span
                    className={cn(
                      "flex items-center gap-2",
                      col.align === "right" && "justify-end",
                      col.align === "center" && "justify-center",
                    )}
                  >
                    {col.header}
                    {col.sortable && col.sortValue && headerSortIcon(col.id)}
                  </span>
                </TableHead>
              ))}
              {hasActions && (
                <TableHead className="w-12 bg-background p-2 text-right font-medium text-muted-foreground" />
              )}
            </TableRow>
            <TableRow className="border-b border-border hover:bg-muted/30">
              {enableSelection && <TableHead className="bg-muted/40 p-2" />}
              {columns.map((col) => {
                const filterDefs = getColumnFilterDefs(col);
                return (
                  <TableHead key={`filter-${col.id}`} className="bg-muted/40 p-2 align-top">
                    {filterDefs.length === 0 ? null : filterDefs.length === 1 ? (
                      <FilterInput
                        value={columnFilters[filterDefs[0].id] ?? ""}
                        placeholder={filterDefs[0].placeholder}
                        onChange={(v) => {
                          setColumnFilters((prev) => ({ ...prev, [filterDefs[0].id]: v }));
                          setPage(1);
                        }}
                      />
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {filterDefs.map((f) => (
                          <FilterInput
                            key={f.id}
                            value={columnFilters[f.id] ?? ""}
                            placeholder={f.placeholder}
                            onChange={(v) => {
                              setColumnFilters((prev) => ({ ...prev, [f.id]: v }));
                              setPage(1);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </TableHead>
                );
              })}
              {hasActions && <TableHead className="bg-muted/40 p-2" />}
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-16 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => {
                const label = getRowLabel?.(row) ?? row.id;
                return (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    {enableSelection && (
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selected.includes(row.id)}
                          onCheckedChange={() => toggleSelect(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${label}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(alignClass(col.align), col.cellClassName)}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={actionLoadingId === row.id}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {rowActions.map((action) => {
                              if (action.hidden?.(row)) return null;
                              const item = (
                                <DropdownMenuItem
                                  key={action.id}
                                  className={
                                    action.destructive
                                      ? "text-destructive focus:text-destructive"
                                      : undefined
                                  }
                                  disabled={
                                    action.disabled?.(row) || actionLoadingId === row.id
                                  }
                                  onClick={() => action.onClick(row)}
                                >
                                  {action.icon ? (
                                    <span className="mr-2 inline-flex [&_svg]:h-4 [&_svg]:w-4">
                                      {action.icon}
                                    </span>
                                  ) : null}
                                  {action.getLabel?.(row) ?? action.label}
                                </DropdownMenuItem>
                              );
                              if (action.separatorBefore) {
                                return (
                                  <span key={action.id}>
                                    <DropdownMenuSeparator />
                                    {item}
                                  </span>
                                );
                              }
                              return item;
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>

          <TableFooter className="sticky bottom-0 z-10 border-t border-border bg-background">
            <TableRow className="hover:bg-transparent">
              {enableSelection ? (
                <>
                  <TableCell
                    colSpan={Math.max(1, Math.floor(colSpan / 2))}
                    className="py-3 text-sm text-muted-foreground"
                  >
                    {selected.length > 0 ? `${selected.length} selected` : "No rows selected"}
                  </TableCell>
                  <TableCell
                    colSpan={Math.max(1, colSpan - Math.floor(colSpan / 2))}
                    className="py-3 text-right text-sm text-muted-foreground"
                  >
                    {totalCount} {entityName}
                    {totalCount !== 1 ? "s" : ""} total
                  </TableCell>
                </>
              ) : (
                <TableCell colSpan={colSpan} className="py-3 text-right text-sm text-muted-foreground">
                  {totalCount} {entityName}
                  {totalCount !== 1 ? "s" : ""} total
                </TableCell>
              )}
            </TableRow>
          </TableFooter>
        </table>
      </div>

      {(isServerPaged || totalPages > 1) && (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border bg-background p-4 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            {isServerPaged
              ? `Showing ${totalCount === 0 ? 0 : start + 1} to ${Math.min(start + clientPageSize, totalCount)} of ${totalCount}`
              : `Showing ${sorted.length === 0 ? 0 : start + 1} to ${Math.min(start + clientPageSize, sorted.length)} of ${sorted.length}`}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isServerPaged && serverPagination.onPageSizeChange && (
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={String(clientPageSize)}
                onChange={(e) => serverPagination.onPageSizeChange?.(parseInt(e.target.value, 10) || clientPageSize)}
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() =>
                isServerPaged
                  ? serverPagination.onPageChange(Math.max(1, currentPage - 1))
                  : setPage((p) => Math.max(1, p - 1))
              }
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() =>
                isServerPaged
                  ? serverPagination.onPageChange(Math.min(totalPages, currentPage + 1))
                  : setPage((p) => Math.min(totalPages, p + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagementTable;
