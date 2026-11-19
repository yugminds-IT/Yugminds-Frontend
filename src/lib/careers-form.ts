export type QType = "text" | "textarea" | "number" | "date" | "url" | "choice" | "multi" | "yesno" | "scale";
export type Question = { id: string; key?: string; type: QType; label: string; help?: string; required: boolean; options?: string[] };
export type FormStep = { id: string; title: string; questions: Question[] };
export type Mode = "required" | "optional" | "off";
export type CoreKey = "fullName" | "email" | "phone" | "city";
/** Admin overrides for the fixed steps. Missing = defaults. Name and email are always asked. */
export type CoreCfg = Partial<Record<CoreKey, { label?: string; mode?: Mode }>> & { consent?: string };
export type FormConfig = { resume: Mode; steps: FormStep[]; core?: CoreCfg };

export const CORE_KEYS: CoreKey[] = ["fullName", "email", "phone", "city"];
export const CORE_DEFAULT: Record<CoreKey, { label: string; hint?: string }> = {
  fullName: { label: "Full name" },
  email: { label: "Email" },
  phone: { label: "Mobile number", hint: "10 digits. We will call this number." },
  city: { label: "City / area" },
};
export const LOCKED: CoreKey[] = ["fullName", "email"];
export const coreField = (f: FormConfig, k: CoreKey) => ({
  label: f.core?.[k]?.label?.trim() || CORE_DEFAULT[k].label,
  mode: (LOCKED.includes(k) ? "required" : f.core?.[k]?.mode ?? "required") as Mode,
});
export const consentText = (f: FormConfig) =>
  f.core?.consent?.trim() ||
  `I agree that YugMinds may store my details${f.resume !== "off" ? " and resume" : ""} to review my application and contact me about this and future roles. I can ask for them to be deleted by emailing info@yugminds.org.`;
export type Value = string | number | boolean | string[];
export type Answers = Record<string, Value>;

export const TYPE_LABEL: Record<QType, string> = {
  text: "Short text", textarea: "Long text", number: "Number", date: "Date", url: "Link",
  choice: "Single choice", multi: "Multiple choice", yesno: "Yes / No", scale: "Scale 1-5",
};

/** Starting value for a question, so yes/no and multi never start undefined. */
export const initial = (q: Question): Value => (q.type === "yesno" ? q.key === "willTravel" && !q.required : q.type === "multi" ? [] : "");

/** Returns an error message for the step, or "" when it can continue. Mirrors the server's checks. */
export function checkStep(qs: Question[], a: Answers): string {
  for (const q of qs) {
    const v = a[q.id];
    if (q.type === "yesno") { if (q.required && v !== true) return `Tick "${q.label}" to continue.`; continue; }
    const empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) return `${q.label} is required.`;
      continue;
    }
    if (q.type === "url" && !/^https?:\/\//i.test(String(v))) return `${q.label} must start with https://`;
  }
  return "";
}
