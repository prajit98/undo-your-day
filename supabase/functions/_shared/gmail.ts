export type GmailCategory = "trial" | "renewal" | "return" | "bill";

export interface Candidate {
  id: string;
  source: "gmail";
  sourceMessageId: string;
  title: string;
  detail?: string;
  category: GmailCategory;
  dueAt: string;
  amountValue?: number;
  amount?: string;
  merchant?: string;
  currency?: string;
  status?: "pending" | "kept" | "dismissed";
  urgent?: boolean;
}

interface GmailMessageHeader {
  name?: string;
  value?: string;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: {
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
}

const AUTO_CATEGORIES: GmailCategory[] = ["trial", "renewal", "return", "bill"];
const MAX_MIME_PART_DEPTH = 12;
const MAX_MIME_PARTS_TO_SCAN = 80;
const MAX_BODY_DATA_CHARS = 120_000;
const MAX_BODY_TEXT_CHARS = 12_000;
const ROLL_FORWARD_PAST_DATE_MS = 30 * 86400000;

// TODO: Replace these general keyword rules with merchant-specific parsing once
// we have real inbox samples from early testers.
const SEARCH_TERMS: Record<GmailCategory, { query: string; newerThanDays: number }[]> = {
  trial: [
    {
      query: `{"free trial" "trial ends" "trial ending" "trial expires" "trial period" "cancel before" "before you are charged" "before you're charged"}`,
      newerThanDays: 180,
    },
  ],
  renewal: [
    {
      query: `{"renews" "renewal" "auto-renew" "auto renew" "subscription renews" "subscription renewal" "membership renews" "next payment"}`,
      newerThanDays: 365,
    },
  ],
  return: [
    {
      query: `{"return window" "return by" "eligible for return" "refund" "exchange" "drop off" "return label" "returns accepted"}`,
      newerThanDays: 120,
    },
  ],
  bill: [
    {
      query: `{"invoice" "invoice due" "bill due" "payment due" "statement ready" "amount due" "due date" "balance due" "due on" "past due"}`,
      newerThanDays: 120,
    },
  ],
};

const CATEGORY_KEYWORDS: Record<GmailCategory, string[]> = {
  trial: [
    "trial",
    "free trial",
    "trial ends",
    "trial ending",
    "trial expires",
    "trial period",
    "convert",
    "before you are charged",
    "before you're charged",
    "charged after",
    "cancel before",
  ],
  renewal: [
    "renew",
    "renews",
    "renewal",
    "auto-renew",
    "auto renew",
    "subscription",
    "subscription renews",
    "subscription renewal",
    "membership",
    "membership renews",
    "next payment",
    "billing date",
    "recurring",
  ],
  return: [
    "return",
    "return window",
    "refund",
    "exchange",
    "drop off",
    "eligible for return",
    "return by",
    "return label",
    "return deadline",
    "returns accepted",
    "send it back",
  ],
  bill: [
    "bill",
    "statement",
    "statement ready",
    "payment due",
    "due date",
    "late fee",
    "invoice",
    "invoice due",
    "amount due",
    "balance due",
    "past due",
    "minimum payment",
    "pay by",
    "due on",
    "autopay",
    "auto-pay",
  ],
};

const MONTH_LOOKUP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const WEEKDAY_LOOKUP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, "\"");
}

function decodeBase64Url(value: string) {
  const safeValue = value.slice(0, MAX_BODY_DATA_CHARS);
  const normalized = safeValue.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return atob(padded);
}

function normalizeDecodedBody(mimeType: string, data: string) {
  const decoded = decodeBase64Url(data).slice(0, MAX_BODY_TEXT_CHARS);

  if (mimeType === "text/plain") {
    return normalizeWhitespace(decoded);
  }

  if (mimeType === "text/html") {
    return normalizeWhitespace(stripHtml(decoded));
  }

  return "";
}

function extractBodyText(rootPart?: GmailMessagePart): string {
  if (!rootPart) {
    return "";
  }

  const stack: Array<{ part: GmailMessagePart; depth: number }> = [{ part: rootPart, depth: 0 }];
  const seen = new Set<GmailMessagePart>();
  let scannedParts = 0;

  while (stack.length > 0 && scannedParts < MAX_MIME_PARTS_TO_SCAN) {
    const next = stack.pop();
    if (!next || seen.has(next.part) || next.depth > MAX_MIME_PART_DEPTH) {
      continue;
    }

    seen.add(next.part);
    scannedParts += 1;

    const mimeType = next.part.mimeType?.toLowerCase() ?? "";
    const data = next.part.body?.data;

    if (data && (mimeType === "text/plain" || mimeType === "text/html")) {
      try {
        const normalized = normalizeDecodedBody(mimeType, data);
        if (normalized) {
          return normalized;
        }
      } catch {
        // Keep scanning other MIME parts if this body is malformed or too large.
      }
    }

    const nestedParts = Array.isArray(next.part.parts) ? next.part.parts : [];
    for (let index = nestedParts.length - 1; index >= 0; index -= 1) {
      const nestedPart = nestedParts[index];
      if (nestedPart) {
        stack.push({ part: nestedPart, depth: next.depth + 1 });
      }
    }
  }

  return "";
}

function getHeader(part: GmailMessagePart | undefined, name: string) {
  const headers = part?.headers ?? [];
  const match = headers.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return match?.value?.trim() ?? "";
}

function getSenderLabel(rawFrom: string) {
  if (!rawFrom) return "";

  const quotedMatch = rawFrom.match(/^"?([^"<]+)"?\s*</);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const emailMatch = rawFrom.match(/<?([^<>\s]+@[^<>\s]+)>?/);
  if (emailMatch?.[1]) {
    return emailMatch[1].split("@")[0];
  }

  return rawFrom;
}

function extractAmountValue(text: string) {
  const matches = [...text.matchAll(/\$ ?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g)];
  if (matches.length === 0) return undefined;

  const value = Number(matches[0][1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function formatAmount(value?: number) {
  if (typeof value !== "number") return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function withTime(date: Date, hour = 17) {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function nextWeekday(weekday: number) {
  const now = new Date();
  const next = new Date(now);
  const distance = (weekday + 7 - now.getDay()) % 7 || 7;
  next.setDate(now.getDate() + distance);
  return withTime(next);
}

function parseMonthDate(match: RegExpMatchArray) {
  const monthIndex = MONTH_LOOKUP[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (monthIndex === undefined || !day) return undefined;

  const date = withTime(new Date(year, monthIndex, day));
  if (!match[3] && date.getTime() < Date.now() - ROLL_FORWARD_PAST_DATE_MS) {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
}

function parseNumericDate(match: RegExpMatchArray) {
  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (month < 0 || day <= 0) return undefined;

  const normalizedYear = year < 100 ? 2000 + year : year;
  const date = withTime(new Date(normalizedYear, month, day));
  if (!match[3] && date.getTime() < Date.now() - ROLL_FORWARD_PAST_DATE_MS) {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
}

function parseIsoDate(match: RegExpMatchArray) {
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!year || month < 0 || day <= 0) return undefined;

  const date = withTime(new Date(year, month, day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function baseEmailDate(internalDate: string | undefined) {
  const date = internalDate ? new Date(Number(internalDate)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function dateFromBaseDays(internalDate: string | undefined, days: number) {
  const date = baseEmailDate(internalDate);
  date.setDate(date.getDate() + days);
  return withTime(date);
}

function extractDueDate(text: string, internalDate: string | undefined, category: GmailCategory) {
  const lower = text.toLowerCase();

  if (/\btonight\b/.test(lower)) {
    return withTime(new Date(), 18).toISOString();
  }

  if (/\btoday\b/.test(lower)) {
    return withTime(new Date()).toISOString();
  }

  if (/\btomorrow\b/.test(lower)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return withTime(tomorrow).toISOString();
  }

  const inDaysMatch = lower.match(/\bin (\d{1,2}) days?\b/);
  if (inDaysMatch) {
    const next = new Date();
    next.setDate(next.getDate() + Number(inDaysMatch[1]));
    return withTime(next).toISOString();
  }

  const daysLeftMatch = lower.match(/\b(\d{1,3})\s+days?\s+(?:left|remaining)\b/);
  if (daysLeftMatch) {
    return dateFromBaseDays(internalDate, Number(daysLeftMatch[1])).toISOString();
  }

  const withinDaysMatch = lower.match(/\bwithin\s+(\d{1,3})\s+days?\b/);
  if (withinDaysMatch && category === "return") {
    return dateFromBaseDays(internalDate, Number(withinDaysMatch[1])).toISOString();
  }

  const monthMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/);
  if (monthMatch) {
    const date = parseMonthDate(monthMatch);
    if (date) return date.toISOString();
  }

  const isoMatch = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const date = parseIsoDate(isoMatch);
    if (date) return date.toISOString();
  }

  const numericMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numericMatch) {
    const date = parseNumericDate(numericMatch);
    if (date) return date.toISOString();
  }

  const weekdayMatch = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekdayMatch) {
    const date = nextWeekday(WEEKDAY_LOOKUP[weekdayMatch[1]]);
    return date.toISOString();
  }

  const base = baseEmailDate(internalDate);
  const fallback = new Date(base);
  fallback.setHours(17, 0, 0, 0);

  if (category === "trial") fallback.setDate(fallback.getDate() + 3);
  if (category === "renewal") fallback.setDate(fallback.getDate() + 7);
  if (category === "return") fallback.setDate(fallback.getDate() + 10);
  if (category === "bill") fallback.setDate(fallback.getDate() + 5);

  return fallback.toISOString();
}

function scoreCategory(text: string, category: GmailCategory) {
  return CATEGORY_KEYWORDS[category].reduce((score, keyword) => (
    text.includes(keyword) ? score + (keyword.includes(" ") ? 2 : 1) : score
  ), 0);
}

function chooseCategory(text: string, hint: GmailCategory, allowed: GmailCategory[]) {
  let bestCategory = hint;
  let bestScore = scoreCategory(text, hint) + 2;

  for (const category of allowed) {
    const score = scoreCategory(text, category) + (category === hint ? 2 : 0);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  if (bestScore < 2) {
    return null;
  }

  return bestCategory;
}

function shortDue(dateIso: string) {
  const due = new Date(dateIso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return `in ${diffDays} days`;

  return due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function buildTitle(category: GmailCategory, source: string, dueAt: string, amount?: string) {
  const dueText = shortDue(dueAt);

  if (category === "trial") {
    return amount
      ? `Cancel ${dueText} to avoid ${amount}`
      : `A trial may convert ${dueText}`;
  }

  if (category === "renewal") {
    return source
      ? `${source} may renew ${dueText}`
      : `A renewal may be close ${dueText}`;
  }

  if (category === "return") {
    return amount
      ? `A return window may close ${dueText} for ${amount}`
      : `A return window may close ${dueText}`;
  }

  return amount
    ? `A bill may be due ${dueText} for ${amount}`
    : `A bill may be due ${dueText}`;
}

function buildDetail(subject: string, snippet: string, source: string) {
  const parts = [subject, snippet]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);

  const joined = parts.join(" · ");
  if (joined) {
    return joined.length > 140 ? `${joined.slice(0, 137)}...` : joined;
  }

  return source ? `From ${source}` : undefined;
}

export function buildSearchQueries(categories: GmailCategory[]) {
  const allowed = categories.filter((category): category is GmailCategory => AUTO_CATEGORIES.includes(category));
  const queries: { category: GmailCategory; q: string }[] = [];

  for (const category of allowed) {
    const primaryRule = SEARCH_TERMS[category][0];
    if (!primaryRule) continue;

    queries.push({
      category,
      q: `${primaryRule.query} newer_than:${primaryRule.newerThanDays}d`,
    });
  }

  return queries;
}

export function messageToCandidate(message: GmailMessage, hint: GmailCategory, allowed: GmailCategory[]) {
  const subject = getHeader(message.payload, "Subject");
  const from = getHeader(message.payload, "From");
  const source = getSenderLabel(from);
  const snippet = normalizeWhitespace(message.snippet ?? "");
  const bodyText = normalizeWhitespace(extractBodyText(message.payload));
  const searchableText = normalizeWhitespace(`${subject} ${snippet} ${bodyText}`.toLowerCase());

  if (!searchableText) {
    return null;
  }

  const category = chooseCategory(searchableText, hint, allowed);
  if (!category) {
    return null;
  }

  const dueAt = extractDueDate(`${subject} ${snippet} ${bodyText}`, message.internalDate, category);
  const amountValue = extractAmountValue(`${subject} ${snippet} ${bodyText}`);
  const amount = formatAmount(amountValue);
  const title = buildTitle(category, source, dueAt, amount);
  const detail = buildDetail(subject, snippet || bodyText.slice(0, 120), source);
  const daysUntilDue = Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000);

  return {
    id: `gmail:${message.id}`,
    source: "gmail",
    sourceMessageId: message.id,
    title,
    detail,
    category,
    dueAt,
    amountValue,
    amount,
    merchant: source,
    currency: amountValue ? "USD" : undefined,
    urgent: daysUntilDue <= 2,
  } satisfies Candidate;
}
