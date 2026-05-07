import { UndoItem } from "./undo-data";

type CurrencyCode = "EUR" | "GBP" | "USD";
type AmountLike = Pick<UndoItem, "amount" | "amountValue">;

function currencyFromDisplay(display?: string): CurrencyCode | "unknown" {
  if (!display) return "unknown";

  const normalized = display.toUpperCase();
  if (display.includes("\u00a3") || display.includes("\u00c2\u00a3") || normalized.includes("GBP")) return "GBP";
  if (display.includes("\u20ac") || display.includes("\u00e2\u201a\u00ac") || normalized.includes("EUR")) return "EUR";
  if (display.includes("$") || normalized.includes("USD")) return "USD";
  return "unknown";
}

function formatCurrency(value: number, currency: CurrencyCode | "unknown") {
  if (currency === "unknown") {
    return value % 1 === 0 ? String(value) : value.toFixed(2);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function summarizeItemAmounts<T extends AmountLike>(items: T[], emptyValue = "--") {
  const buckets = new Map<CurrencyCode | "unknown", number>();

  items.forEach((item) => {
    if (typeof item.amountValue !== "number" || !Number.isFinite(item.amountValue)) return;
    const currency = currencyFromDisplay(item.amount);
    buckets.set(currency, (buckets.get(currency) ?? 0) + item.amountValue);
  });

  if (buckets.size === 0) {
    return { hasAmount: false, mixed: false, value: emptyValue };
  }

  if (buckets.size > 1) {
    return { hasAmount: true, mixed: true, value: "Mixed" };
  }

  const [[currency, total]] = Array.from(buckets.entries());
  return {
    hasAmount: true,
    mixed: false,
    value: formatCurrency(total, currency),
  };
}
