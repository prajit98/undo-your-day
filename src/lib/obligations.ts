import { CreateUndoItemInput, UndoItem, isActiveUndoItem } from "./undo-data";

type ObligationShape = Pick<
  CreateUndoItemInput,
  "amount" | "amountValue" | "category" | "dueAt" | "merchantName" | "source" | "title"
> & { merchant?: string };

function normalizeText(value?: string) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dueDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currencyMarker(display?: string) {
  if (!display) return "unknown";

  const normalized = display.toUpperCase();
  if (display.includes("\u00a3") || display.includes("\u00c2\u00a3") || normalized.includes("GBP")) return "GBP";
  if (display.includes("\u20ac") || display.includes("\u00e2\u201a\u00ac") || normalized.includes("EUR")) return "EUR";
  if (display.includes("$") || normalized.includes("USD")) return "USD";
  return "unknown";
}

function amountKey(value?: number, display?: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${currencyMarker(display)}:${value.toFixed(2)}`;
  }

  const normalizedDisplay = normalizeText(display);
  return normalizedDisplay ? `display:${normalizedDisplay}` : "no-amount";
}

export function obligationKeyFor(input: ObligationShape) {
  const identity = normalizeText(input.merchantName ?? input.merchant ?? input.source) || normalizeText(input.title);

  return [
    input.category,
    dueDayKey(input.dueAt),
    identity,
    amountKey(input.amountValue, input.amount),
  ].join("|");
}

export function sameRealWorldObligation(left: ObligationShape, right: ObligationShape) {
  return obligationKeyFor(left) === obligationKeyFor(right);
}

export function dedupeObligations<T extends ObligationShape>(items: T[]) {
  const seen = new Set<string>();
  const next: T[] = [];

  items.forEach((item) => {
    const key = obligationKeyFor(item);
    if (seen.has(key)) return;

    seen.add(key);
    next.push(item);
  });

  return next;
}

export function dedupeActiveObligations<T extends UndoItem>(items: T[]) {
  return dedupeObligations(items.filter(isActiveUndoItem));
}
