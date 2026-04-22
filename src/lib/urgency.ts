import { Category } from "./undo-data";
import { policyFor, reminderStateFor, ReminderState } from "./reminders";

export interface UrgencyInfo {
  label: string;
  level: ReminderState;
  hoursLeft: number;
}

const hoursTo = (iso: string) => (new Date(iso).getTime() - Date.now()) / 36e5;

export function urgencyFor(category: Category, dueAtIso: string): UrgencyInfo {
  const hoursLeft = hoursTo(dueAtIso);
  const level = reminderStateFor(category, dueAtIso);
  const policy = policyFor(category);

  return {
    label: policy.labels[level],
    level,
    hoursLeft,
  };
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
