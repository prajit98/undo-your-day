import type { Category } from "./undo-data";
import { feedTimingFor, shortDue } from "./urgency";

interface DueCopyInput {
  title: string;
  category: Category;
  dueAt: string;
  amount?: string;
  merchant?: string;
  source?: string;
  detail?: string;
}

function duePhraseForTitle(dueAt: string) {
  const due = shortDue(dueAt);
  if (due === "Past due") return "now";
  if (due === "in <1h") return "in less than an hour";
  return due;
}

function dueClauseForBill(dueAt: string) {
  const timing = feedTimingFor(dueAt);
  const due = shortDue(dueAt);

  if (timing.level === "overdue") return "may already be overdue";
  if (timing.level === "today") return "may be due today";
  if (due === "in <1h") return "may be due soon";
  return `may be due ${due}`;
}

function cleanSubject(value?: string) {
  if (!value) return undefined;

  const trimmed = value
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!trimmed || /^(gmail|email|unknown|notification)$/i.test(trimmed)) return undefined;

  const atMatch = trimmed.match(/^[A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*)?\s+at\s+(.+)$/);
  return (atMatch?.[1] ?? trimmed).replace(/\.+$/u, "").trim() || undefined;
}

function billTitle(subject: string | undefined, dueAt: string, neutral = false) {
  const timing = feedTimingFor(dueAt);
  const due = shortDue(dueAt);

  if (subject && neutral) {
    if (timing.level === "overdue") return `${subject} may have an overdue payment`;
    if (timing.level === "today") return `${subject} may have a payment due today`;
    return `${subject} may have a payment due`;
  }

  const base = subject ?? "A payment";
  if (timing.level === "overdue") return `${base} may already be overdue`;
  if (timing.level === "today") return `${base} may be due today`;
  if (due === "in <1h") return `${base} may be due soon`;
  return `${base} may be due ${due}`;
}

export function titleWithCurrentTiming(title: string, dueAt: string) {
  const trimmed = title.trim();
  const dueMatch = trimmed.match(
    /^(.*?)\s+may be due\s+(?:today|tomorrow|now|in less than an hour|in <1h|in \d+h|in \d+ days|on [A-Z][a-z]{2,8}\.? \d{1,2})\.?$/i,
  );

  if (dueMatch?.[1]) {
    return `${dueMatch[1].trim()} ${dueClauseForBill(dueAt)}`;
  }

  const timing = duePhraseForTitle(dueAt);
  return trimmed.replace(
    /\b(?:today|tomorrow|now|in less than an hour|in <1h|in \d+h|in \d+ days|on [A-Z][a-z]{2,8}\.? \d{1,2})\.?$/i,
    timing,
  );
}

export function titleForDisplay(input: DueCopyInput) {
  const title = input.title.trim();

  if (input.category === "bill") {
    const personAtMatch = title.match(
      /^[A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*)?\s+at\s+(.+?)\s+may be due\b/i,
    );

    if (personAtMatch?.[1]) {
      return billTitle(cleanSubject(personAtMatch[1]), input.dueAt, true);
    }

    if (/^A bill may be due\b/i.test(title)) {
      return billTitle(cleanSubject(input.merchant ?? input.source), input.dueAt);
    }
  }

  return titleWithCurrentTiming(title, input.dueAt).replace(/^A bill\b/i, "A payment");
}

export function detailForDisplay(input: DueCopyInput) {
  if (!input.detail) return undefined;

  if (input.category !== "bill") {
    return input.detail.replace(/\s+and protect\s+[^.]+/i, "");
  }

  const timing = feedTimingFor(input.dueAt);
  const amount = input.amount ? `${input.amount} ` : "";

  if (timing.level === "overdue") {
    return `This ${amount}payment may already be overdue.`;
  }

  if (timing.level === "today") {
    return `This ${amount}payment may be due today.`;
  }

  return amount
    ? `Review the ${input.amount} payment before it is due.`
    : "Review before the payment is due.";
}
