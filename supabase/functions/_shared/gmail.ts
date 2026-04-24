export type GmailCategory = "trial" | "renewal" | "return" | "bill";

export interface Candidate {
  id: string;
  title: string;
  detail?: string;
  category: GmailCategory;
  dueAt: string;
  amountValue?: number;
  amount?: string;
  source?: string;
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

// TODO: Replace these general keyword rules with merchant-specific parsing once
// we have real inbox samples from early testers.
const SEARCH_TERMS: Record<GmailCategory, { query: string; newerThanDays: number }[]> = {
  trial: [
    { query: "\"trial\"", newerThanDays: 180 },
    { query: "\"free trial\"", newerThanDays: 180 },
    { query: "\"trial ends\"", newerThanDays: 180 },
    { query: "\"trial ending\"", newerThanDays: 180 },
  ],
  renewal: [
    { query: "\"renews\"", newerThanDays: 365 },
    { query: "\"renewal\"", newerThanDays: 365 },
    { query: "\"auto-renew\"", newerThanDays: 365 },
    { query: "\"subscription\"", newerThanDays: 365 },
  ],
  return: [
    { query: "\"return\"", newerThanDays: 120 },
    { query: "\"return window\"", newerThanDays: 120 },
    { query: "\"refund\"", newerThanDays: 120 },
    { query: "\"drop off\"", newerThanDays: 120 },
  ],
  bill: [
    { query: "\"bill due\"", newerThanDays: 120 },
    { query: "\"payment due\"", newerThanDays: 120 },
    { query: "\"invoice\"", newerThanDays: 120 },
    { query: "\"statement\"", newerThanDays: 120 },
  ],
};

const CATEGORY_KEYWORDS: Record<GmailCategory, string[]> = {
  trial: [
    "trial",
    "free trial",
    "trial ends",
    "trial ending",
    "convert",
    "before you are charged",
    "cancel before",
  ],
  renewal: [
    "renew",
    "renews",
    "renewal",
    "auto-renew",
    "auto renew",
    "subscription",
    "membership",
    "next payment",
  ],
  return: [
    "return",
    "return window",
    "refund",
    "exchange",
    "drop off",
    "eligible for return",
    "return by",
  ],
  bill: [
    "bill",
    "statement",
    "payment due",
    "due date",
    "late fee",
    "invoice",
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
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return atob(padded);
}

function extractBodyText(part?: GmailMessagePart, depth = 0): string {
  if (!part || depth > MAX_MIME_PART_DEPTH) {
    return "";
  }

  const mimeType = part.mimeType?.toLowerCase() ?? "";
  const data = part.body?.data;

  if (data && (mimeType === "text/plain" || mimeType === "text/html")) {
    try {
      const decoded = decodeBase64Url(data);

      if (mimeType === "text/plain") {
        const normalized = normalizeWhitespace(decoded);
        if (normalized) {
          return normalized;
        }
      }

      if (mimeType === "text/html") {
        const normalized = normalizeWhitespace(stripHtml(decoded));
        if (normalized) {
          return normalized;
        }
      }
    } catch {
      return "";
    }
  }

  for (const nestedPart of part.parts ?? []) {
    const nested = extractBodyText(nestedPart, depth + 1);
    if (nested) {
      return nested;
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
  if (!match[3] && date.getTime() < Date.now() - 36e5) {
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
  if (!match[3] && date.getTime() < Date.now() - 36e5) {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
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

  const monthMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/);
  if (monthMatch) {
    const date = parseMonthDate(monthMatch);
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

  const base = internalDate ? new Date(Number(internalDate)) : new Date();
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
    title,
    detail,
    category,
    dueAt,
    amountValue,
    amount,
    source,
    urgent: daysUntilDue <= 2,
  } satisfies Candidate;
}
