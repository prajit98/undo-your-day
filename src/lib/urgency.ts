import { Category } from "./undo-data";
import { policyFor, reminderStateFor, ReminderState } from "./reminders";

export interface UrgencyInfo {
  label: string;
  level: ReminderState;
  hoursLeft: number;
}

export type FeedTimingLevel = "overdue" | "today" | "soon" | "later";

export interface FeedTimingInfo {
  chipLabel: string;
  level: FeedTimingLevel;
}

const hoursTo = (iso: string) => (new Date(iso).getTime() - Date.now()) / 36e5;

function calendarDaysTo(iso: string) {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return Number.POSITIVE_INFINITY;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.round((due.getTime() - today.getTime()) / 864e5);
}

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

export function feedTimingFor(iso: string): FeedTimingInfo {
  const h = hoursTo(iso);
  const calendarDays = calendarDaysTo(iso);

  if (h < 0) {
    return { chipLabel: "Past due", level: "overdue" };
  }

  if (calendarDays <= 0) {
    return { chipLabel: "Due today", level: "today" };
  }

  if (calendarDays <= 3) {
    return { chipLabel: "Due soon", level: "soon" };
  }

  return { chipLabel: "Coming up", level: "later" };
}
