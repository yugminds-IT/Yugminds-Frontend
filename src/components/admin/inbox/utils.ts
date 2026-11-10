export { plural } from "../students/utils";

export type Status = "new" | "read" | "replied" | "archived";
export type View = Status | "deleted";

export interface Message {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  area_code: string;
  phone_number: string | null;
  purpose: string;
  message: string;
  status: Status;
  admin_notes: string | null;
  source: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Counts = Record<View, number>;
export const NO_COUNTS: Counts = { new: 0, read: 0, replied: 0, archived: 0, deleted: 0 };

/** The life of a message: it arrives, someone reads it, someone answers it, it is filed away. */
export const FLOW: Status[] = ["new", "read", "replied", "archived"];
export const STATUS_LABEL: Record<View, string> = { new: "New", read: "Read", replied: "Replied", archived: "Archived", deleted: "Deleted" };

const PURPOSES: Record<string, string> = {
  general: "General inquiry",
  school: "School partnership",
  parent: "Parent inquiry",
  student: "Student enrollment",
  support: "Technical support",
  other: "Other",
};
/** The form sends a few fixed keys and also free text such as "Call back: School robotics lab". */
export const purposeOf = (p: string) => PURPOSES[p] ?? p;

export const nameOf = (m: Message) => `${m.first_name} ${m.last_name}`.trim() || m.email;
export const phoneOf = (m: Message) => (m.phone_number ? `${m.area_code} ${m.phone_number}`.trim() : "");

export const mailtoReply = (m: Message) =>
  `mailto:${m.email}?subject=${encodeURIComponent("Re: Your inquiry – Robocoders")}&body=${encodeURIComponent(`Hi ${m.first_name},\n\n`)}`;

export const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
