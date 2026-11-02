// Office hours in India Standard Time. Minutes since midnight.
export const HOURS: { label: string; short: string; days: number[]; open?: number; close?: number; time: string }[] = [
  { label: "Monday to Friday", short: "Mon to Fri", days: [1, 2, 3, 4, 5], open: 9 * 60, close: 18 * 60, time: "9 am to 6 pm" },
  { label: "Saturday", short: "Sat", days: [6], open: 10 * 60, close: 16 * 60, time: "10 am to 4 pm" },
  { label: "Sunday", short: "Sun", days: [0], time: "Closed" },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function istNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: SHORT.indexOf(get("weekday")), mins: Number(get("hour")) * 60 + Number(get("minute")) };
}

const rowFor = (day: number) => HOURS.find((h) => h.days.includes(day))!;
const clock = (mins: number) => {
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
};

export function officeStatus(date = new Date()): { open: boolean; text: string } {
  const { day, mins } = istNow(date);
  const today = rowFor(day);
  if (today.open !== undefined && today.close !== undefined) {
    if (mins >= today.open && mins < today.close) return { open: true, text: `Open now. Calls answered until ${clock(today.close)}.` };
    if (mins < today.open) return { open: false, text: `Closed now. We open today at ${clock(today.open)}.` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const row = rowFor(d);
    if (row.open !== undefined) {
      const when = i === 1 ? "tomorrow" : DAY_NAMES[d];
      return { open: false, text: `Closed now. We open ${when} at ${clock(row.open)}.` };
    }
  }
  return { open: false, text: "Closed now." };
}
