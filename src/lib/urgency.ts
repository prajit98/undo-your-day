import { Category } from "./undo-data";

export interface UrgencyInfo {
  label: string;          // e.g. "Last day to return"
  level: "critical" | "soon" | "later";
  hoursLeft: number;
}

const hoursTo = (iso: string) => (new Date(iso).getTime() - Date.now()) / 36e5;

const labelMap: Record<Category, { critical: string; soon: string; later: string }> = {
  trial:    { critical: "Converts today",       soon: "Converts soon",       later: "Trial ending" },
  renewal:  { critical: "Renews tomorrow",      soon: "Renews this week",    later: "Renews soon" },
  return:   { critical: "Last day to return",   soon: "Return window closing", later: "Still returnable" },
  bill:     { critical: "Avoid the late fee",   soon: "Pay before due date", later: "Bill upcoming" },
  followup: { critical: "Reply before it gets awkward", soon: "Still time to reply", later: "Don't let it slip" },
};

export function urgencyFor(category: Category, dueAtIso: string): UrgencyInfo {
  const h = hoursTo(dueAtIso);
  const map = labelMap[category];
  if (h < 36) return { label: map.critical, level: "critical", hoursLeft: h };
  if (h < 24 * 5) return { label: map.soon, level: "soon", hoursLeft: h };
  return { label: map.later, level: "later", hoursLeft: h };
}

export function shortDue(iso: string): string {
  const h = hoursTo(iso);
  if (h < 0) return "Past due";
  if (h < 1) return "in <1h";
  if (h < 24) return `in ${Math.round(h)}h`;
  const d = Math.round(h / 24);
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}
