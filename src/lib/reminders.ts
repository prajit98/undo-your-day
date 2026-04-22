import { Category } from "./undo-data";

export type ReminderState = "coming" | "today" | "critical";

/**
 * Shared reminder behavior by category.
 * One source of truth keeps feed urgency and reminder language aligned.
 */
export interface ReminderSchedule {
  cadence: string;
  offsetsHrs: number[];
}

export interface ReminderPolicy {
  noun: string;
  principle: string;
  free: ReminderSchedule;
  premium: ReminderSchedule;
  lastChance: string;
  defaultTone: string;
  windowsHrs: {
    critical: number;
    today: number;
  };
  labels: Record<ReminderState, string>;
  preview: Record<ReminderState, string>;
}

export interface ReminderPreview {
  state: ReminderState;
  schedule: ReminderSchedule;
  detail: string;
  support: string | null;
}

const HOUR = 36e5;

export const reminderPolicy: Record<Category, ReminderPolicy> = {
  trial: {
    noun: "trial reminder",
    principle: "Catch trials before they convert.",
    free: { cadence: "Tomorrow morning", offsetsHrs: [24] },
    premium: { cadence: "2 days before, tomorrow morning, 2 hours before", offsetsHrs: [48, 24, 2] },
    lastChance: "Last chance. This trial converts soon.",
    defaultTone: "Your trial converts tomorrow. Cancel while the option is still open.",
    windowsHrs: { critical: 12, today: 48 },
    labels: {
      coming: "Trial ending soon",
      today: "Cancel today",
      critical: "Converts today",
    },
    preview: {
      coming: "Still time to cancel before it converts.",
      today: "Worth cancelling today if you are not keeping it.",
      critical: "Conversion is close. Best to decide now.",
    },
  },
  renewal: {
    noun: "renewal reminder",
    principle: "Catch renewals before the charge lands.",
    free: { cadence: "2 days before", offsetsHrs: [48] },
    premium: { cadence: "3 days before, the day before, morning of charge", offsetsHrs: [72, 24, 6] },
    lastChance: "Charging soon. Last chance to pause or cancel.",
    defaultTone: "Renewal in two days. Still enough time to stop the charge.",
    windowsHrs: { critical: 18, today: 72 },
    labels: {
      coming: "Renews soon",
      today: "Decide today",
      critical: "Charges soon",
    },
    preview: {
      coming: "Still time to stop the renewal before the charge lands.",
      today: "Worth deciding today if you do not want this renewed.",
      critical: "The charge is close. Better to act now.",
    },
  },
  return: {
    noun: "return reminder",
    principle: "Catch returns while the window is still open.",
    free: { cadence: "3 days before the cutoff", offsetsHrs: [72] },
    premium: { cadence: "5 days before, 2 days before, last morning", offsetsHrs: [120, 48, 8] },
    lastChance: "Last day to return. Drop it off before the refund window closes.",
    defaultTone: "Three days left to return this. Still refundable.",
    windowsHrs: { critical: 12, today: 72 },
    labels: {
      coming: "Return window open",
      today: "Return today",
      critical: "Last day to return",
    },
    preview: {
      coming: "Still refundable if you decide now.",
      today: "Worth returning today while the refund window is still open.",
      critical: "The return window is almost gone.",
    },
  },
  bill: {
    noun: "bill reminder",
    principle: "Catch bills before late fees stack.",
    free: { cadence: "2 days before due", offsetsHrs: [48] },
    premium: { cadence: "4 days before, the day before, morning of due date", offsetsHrs: [96, 24, 8] },
    lastChance: "Due today. Better to pay before the late fee kicks in.",
    defaultTone: "Bill due in two days. Pay now and skip the fee.",
    windowsHrs: { critical: 18, today: 72 },
    labels: {
      coming: "Bill upcoming",
      today: "Pay today",
      critical: "Avoid the late fee",
    },
    preview: {
      coming: "Still time to pay before fees start stacking.",
      today: "Worth paying today before it turns into a fee.",
      critical: "The deadline is close. Better not let this slip.",
    },
  },
  followup: {
    noun: "follow-up reminder",
    principle: "Catch the message you said you would send.",
    free: { cadence: "Morning of the day you planned to reply", offsetsHrs: [24] },
    premium: { cadence: "Morning of, later today, last quiet nudge", offsetsHrs: [12, 4, 1] },
    lastChance: "Reply now before this gets awkward.",
    defaultTone: "You said you would get back to them. Still a good time.",
    windowsHrs: { critical: 4, today: 36 },
    labels: {
      coming: "Reply soon",
      today: "Reply today",
      critical: "Before it gets awkward",
    },
    preview: {
      coming: "Still time to reply while it feels easy.",
      today: "Worth replying today before it lingers.",
      critical: "This is close to becoming awkward.",
    },
  },
};

export function policyFor(category: Category): ReminderPolicy {
  return reminderPolicy[category];
}

export function reminderStateFor(category: Category, dueAtIso: string): ReminderState {
  const hoursLeft = (new Date(dueAtIso).getTime() - Date.now()) / HOUR;
  const policy = policyFor(category);

  if (hoursLeft <= policy.windowsHrs.critical) return "critical";
  if (hoursLeft <= policy.windowsHrs.today) return "today";
  return "coming";
}

export function reminderPreviewFor(
  category: Category,
  dueAtIso: string,
  isPremium: boolean,
): ReminderPreview {
  const policy = policyFor(category);
  const state = reminderStateFor(category, dueAtIso);
  const schedule = isPremium ? policy.premium : policy.free;

  return {
    state,
    schedule,
    detail: state === "critical" ? policy.lastChance : policy.preview[state],
    support: isPremium
      ? state === "critical"
        ? "Last-chance protection is on for this one."
        : null
      : "Premium adds an earlier in-app nudge and a last-chance reminder when timing gets tight.",
  };
}
