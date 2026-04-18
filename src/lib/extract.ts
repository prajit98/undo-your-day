import { Category } from "./undo-data";

export interface ExtractionResult {
  title: string;
  detail?: string;
  category: Category;
  dueAt: string;          // ISO
  amountValue?: number;
  amount?: string;
  source?: string;
  confidence: number;     // 0–1
  signals: string[];      // short list of what we noticed
}

const KEYWORDS: { cat: Category; words: string[]; weight: number }[] = [
  { cat: "trial",    words: ["trial", "free trial", "converts", "trial ends", "trial period"], weight: 1 },
  { cat: "renewal",  words: ["renew", "renews", "subscription", "auto-renew", "annual", "membership"], weight: 1 },
  { cat: "return",   words: ["return", "refund", "return by", "return window", "send back"], weight: 1 },
  { cat: "bill",     words: ["bill", "invoice", "due", "payment due", "amount due", "balance"], weight: 1 },
  { cat: "followup", words: ["reply", "follow up", "respond", "get back", "thank", "i'll", "i will"], weight: 1 },
];

const VERBS = {
  trial:    "converts",
  renewal:  "renews",
  return:   "return window closes",
  bill:     "due",
  followup: "owe a reply",
};

const detectAmount = (text: string): { value?: number; display?: string } => {
  const m = text.match(/\$\s?(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return {};
  const value = parseFloat(m[1].replace(",", "."));
  return { value, display: `$${m[1]}` };
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const detectDate = (text: string): Date => {
  const lower = text.toLowerCase();
  const now = new Date();

  // "tomorrow"
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d;
  }
  if (/\btoday\b/.test(lower)) { const d = new Date(now); d.setHours(18, 0, 0, 0); return d; }
  if (/\bnext week\b/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; }
  if (/\bthis week\b/.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + 3); d.setHours(9, 0, 0, 0); return d; }

  // weekday
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(lower)) {
      const d = new Date(now);
      const delta = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + delta); d.setHours(9, 0, 0, 0); return d;
    }
  }

  // "May 2", "May 18", "the 18th"
  const monthDay = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/);
  if (monthDay) {
    const month = MONTHS[monthDay[1]];
    const day = parseInt(monthDay[2], 10);
    const d = new Date(now.getFullYear(), month, day, 9, 0, 0, 0);
    if (d.getTime() < now.getTime()) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  const ordinal = lower.match(/\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/);
  if (ordinal) {
    const day = parseInt(ordinal[1], 10);
    const d = new Date(now.getFullYear(), now.getMonth(), day, 9, 0, 0, 0);
    if (d.getTime() < now.getTime()) d.setMonth(d.getMonth() + 1);
    return d;
  }

  // default: 3 days out
  const d = new Date(now); d.setDate(d.getDate() + 3); d.setHours(9, 0, 0, 0); return d;
};

const detectCategory = (text: string): { cat: Category; confidence: number } => {
  const lower = text.toLowerCase();
  let best: Category = "followup";
  let bestScore = 0;
  for (const k of KEYWORDS) {
    let score = 0;
    for (const w of k.words) if (lower.includes(w)) score += k.weight;
    if (score > bestScore) { bestScore = score; best = k.cat; }
  }
  return { cat: best, confidence: Math.min(1, 0.5 + bestScore * 0.2) };
};

const detectBrand = (text: string): string | undefined => {
  const m = text.match(/\b(Notion|Spotify|Netflix|Headspace|Audible|Equinox|Adidas|Aesop|Uniqlo|Verizon|ConEd|NYT|Apple|Google|Amazon|Stripe)\b/);
  return m?.[1];
};

export function extractFromText(text: string): ExtractionResult {
  const trimmed = text.trim();
  const { cat, confidence } = detectCategory(trimmed);
  const due = detectDate(trimmed);
  const { value, display } = detectAmount(trimmed);
  const brand = detectBrand(trimmed);

  const signals: string[] = [];
  if (brand) signals.push(`Found mention of ${brand}`);
  if (display) signals.push(`Detected amount ${display}`);
  if (/(tomorrow|today|next week|this week)/i.test(trimmed)) signals.push("Detected relative date");
  else if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(trimmed)) signals.push("Detected calendar date");
  signals.push(`Likely a ${cat} item`);

  // Headline = consequence-led
  const verb = VERBS[cat];
  const subject = brand ?? trimmed.split(/[.!?\n]/)[0].slice(0, 40);
  const dueShort = due.toLocaleDateString(undefined, { weekday: "long" });
  const headline = brand
    ? `${brand} ${verb} ${dueShort}${display ? ` — ${display}` : ""}`
    : trimmed.length < 80 ? trimmed : `${subject}…`;

  return {
    title: headline,
    detail: trimmed.length > 80 ? trimmed.slice(0, 140) + (trimmed.length > 140 ? "…" : "") : undefined,
    category: cat,
    dueAt: due.toISOString(),
    amountValue: value,
    amount: display,
    source: brand,
    confidence,
    signals,
  };
}

// Mock screenshot extraction — pretends to read a receipt / order email
export function extractFromScreenshot(): ExtractionResult {
  const samples = [
    "Your Apple TV+ free trial converts on May 2 — you'll be charged $9.99.",
    "Order #A12 — return by Friday for full refund of $84.20.",
    "Your Verizon bill of $59.99 is due on the 18th.",
  ];
  return extractFromText(samples[Math.floor(Math.random() * samples.length)]);
}
