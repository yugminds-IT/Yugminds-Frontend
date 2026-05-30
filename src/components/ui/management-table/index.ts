/**
 * Unified admin management table — one component, column-driven config.
 *
 * @example New page (minimal)
 * ```tsx
 * import {
 *   ManagementTable,
 *   textColumn,
 *   type ManagementTableRow,
 *   type ManagementTableRowAction,
 * } from "@/components/ui/management-table";
 *
 * type MyRow = ManagementTableRow & { name: string; email: string };
 *
 * const columns = [
 *   textColumn<MyRow>({ id: "name", header: "Name", accessor: (r) => r.name, sortable: true, filterable: true }),
 *   textColumn<MyRow>({ id: "email", header: "Email", accessor: (r) => r.email, sortable: true, filterable: true }),
 * ];
 *
 * <ManagementTable
 *   rows={rows}
 *   columns={columns}
 *   rowActions={[{ id: "edit", label: "Edit", onClick: handleEdit }]}
 *   entityName="item"
 *   onBulkDeleteSelected={handleBulkDelete}
 * />
 * ```
 */

export {
  ManagementTable,
  type ManagementTableRow,
  type ManagementTableColumn,
  type ManagementTableColumnFilter,
  type ManagementTableRowAction,
  type ManagementTableProps,
  type ManagementTableServerPagination,
} from "../management-table";

export {
  textColumn,
  SCHOOL_MANAGEMENT_COLUMNS,
  STUDENT_MANAGEMENT_COLUMNS,
  createTeacherManagementColumns,
  createSchoolAdminManagementColumns,
  type SchoolManagementRow,
  type StudentManagementRow,
  type TeacherManagementRow,
  type SchoolAdminManagementRow,
  SCHOOL_ADMIN_STUDENT_COLUMNS,
  type SchoolAdminStudentTableRow,
  SCHOOL_ADMIN_TEACHER_COLUMNS,
  type SchoolAdminTeacherTableRow,
} from "../management-table-presets";

export { default } from "../management-table";
