import { Category } from "./undo-data";

/**
 * Reminder policy per category.
 *
 * Principles:
 * - Calm, useful, not noisy. Free always gets one well-timed reminder.
 * - Premium adds a "last-chance" nudge sized to the category's emotional weight.
 * - Copy is consequence-led, never task-managery.
 */

export interface ReminderSchedule {
  /** human-friendly cadence label, e.g. "2 days before · the day of" */
  cadence: string;
  /** when each ping fires, expressed as "hours before due" — for preview only */
  offsetsHrs: number[];
}

export interface ReminderPolicy {
  /** noun shown in the card, e.g. "trial reminder" */
  noun: string;
  /** one-line product principle, used in Settings */
  principle: string;
  free: ReminderSchedule;
  /** premium adds the last-chance ping(s) */
  premium: ReminderSchedule;
  /** copy used by the last-chance reminder (Premium) */
  lastChance: string;
  /** default tone for the standard reminder (Free) */
  defaultTone: string;
}

export const reminderPolicy: Record<Category, ReminderPolicy> = {
  trial: {
    noun: "trial reminder",
    principle: "Catch trials before they convert.",
    free:    { cadence: "The day before",                        offsetsHrs: [24] },
    premium: { cadence: "2 days before · morning of conversion · 2 hours before",
               offsetsHrs: [48, 8, 2] },
    lastChance:  "Last chance — your trial converts in a few hours.",
    defaultTone: "Your trial converts tomorrow. Cancel now and keep the option.",
  },
  renewal: {
    noun: "renewal reminder",
    principle: "Catch renewals before the charge lands.",
    free:    { cadence: "2 days before",                          offsetsHrs: [48] },
    premium: { cadence: "3 days before · the day before · morning of charge",
               offsetsHrs: [72, 24, 6] },
    lastChance:  "Charging today — pause or cancel before it hits.",
    defaultTone: "Renewal in two days. A small window to opt out.",
  },
  return: {
    noun: "return reminder",
    principle: "Catch returns while the window is still open.",
    free:    { cadence: "3 days before the window closes",        offsetsHrs: [72] },
    premium: { cadence: "5 days before · 2 days before · last morning",
               offsetsHrs: [120, 48, 8] },
    lastChance:  "Last day to return — drop it off before the cutoff.",
    defaultTone: "Three days left to return — still refundable.",
  },
  bill: {
    noun: "bill reminder",
    principle: "Catch bills before late fees stack.",
    free:    { cadence: "2 days before due",                      offsetsHrs: [48] },
    premium: { cadence: "4 days before · 1 day before · morning of due date",
               offsetsHrs: [96, 24, 8] },
    lastChance:  "Due today — pay before the late fee kicks in.",
    defaultTone: "Bill due in two days. Pay now, avoid the fee.",
  },
  followup: {
    noun: "follow-up reminder",
    principle: "Catch the message you said you'd send.",
    free:    { cadence: "The day you planned to reply",           offsetsHrs: [24] },
    premium: { cadence: "Morning of · gentle nudge later · last quiet ping",
               offsetsHrs: [12, 4, 1] },
    lastChance:  "Reply now — before it gets awkward.",
    defaultTone: "You said you'd get back to them. Still a good time.",
  },
};

export function policyFor(category: Category): ReminderPolicy {
  return reminderPolicy[category];
}
