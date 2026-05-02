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

export interface GmailCandidateTrace {
  sourceMessageId: string;
  hint: GmailCategory;
  candidateCreated: boolean;
  candidateCategory?: GmailCategory;
  candidateDueAt?: string;
  candidateAmount?: string;
  candidateCurrency?: string;
  searchableTextLength: number;
  flags: {
    containsBrightNet: boolean;
    containsInvoice: boolean;
    containsDueOn: boolean;
    containsPoundAmount: boolean;
    containsBillKeyword: boolean;
  };
}

const AUTO_CATEGORIES: GmailCategory[] = ["trial", "renewal", "return", "bill"];
const MAX_MIME_PART_DEPTH = 12;
const MAX_MIME_PARTS_TO_SCAN = 80;
const MAX_BODY_DATA_CHARS = 120_000;
const MAX_BODY_TEXT_CHARS = 12_000;
const ROLL_FORWARD_PAST_DATE_MS = 30 * 86400000;
const GENERIC_MERCHANT_WORDS = new Set([
  "account",
  "accounts",
  "automated",
  "bill",
  "billing",
  "customer",
  "donotreply",
  "email",
  "free",
  "hello",
  "help",
  "hi",
  "info",
  "invoice",
  "mail",
  "membership",
  "notification",
  "notifications",
  "noreply",
  "no reply",
  "order",
  "payment",
  "receipt",
  "reminder",
  "return",
  "returns",
  "statement",
  "subscription",
  "support",
  "team",
  "trial",
  "update",
  "your",
]);
const CONSUMER_EMAIL_DOMAINS = new Set([
  "aol",
  "gmail",
  "googlemail",
  "hotmail",
  "icloud",
  "live",
  "me",
  "msn",
  "outlook",
  "proton",
  "protonmail",
  "yahoo",
]);

// TODO: Replace these general keyword rules with merchant-specific parsing once
// we have real inbox samples from early testers.
const SEARCH_TERMS: Record<GmailCategory, { query: string; newerThanDays: number; maxResults?: number }[]> = {
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
      query: "invoice",
      newerThanDays: 120,
      maxResults: 4,
    },
    {
      query: `{"bill due" "payment due" "statement ready" "amount due" "due date" "balance due" "due on" "past due"}`,
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

function getSenderDomainLabel(rawFrom: string) {
  const emailMatch = rawFrom.match(/<?([^<>\s]+@[^<>\s]+)>?/);
  const domain = emailMatch?.[1]?.split("@")[1]?.toLowerCase();
  if (!domain) return "";

  const domainParts = domain.split(".").filter(Boolean);
  const domainLabel = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : domainParts[0];
  if (!domainLabel || CONSUMER_EMAIL_DOMAINS.has(domainLabel)) return "";

  return domainLabel;
}

function toDisplayLabel(value: string) {
  const normalized = value
    .replace(/[_-]+/g, " ")
    .replace(/\s+(?:via|from)\s+.+$/i, "")
    .replace(/\b(?:inc|llc|ltd|limited|corp|corporation|co)\.?$/i, "")
    .replace(/[^\p{L}\p{N}&+'. ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  const words = lower.split(/\s+/);
  if (GENERIC_MERCHANT_WORDS.has(lower) || words.some((word) => GENERIC_MERCHANT_WORDS.has(word))) {
    return "";
  }

  if (/^[a-z0-9 ]+$/.test(normalized) || /^[A-Z0-9 ]+$/.test(normalized)) {
    return normalized
      .split(" ")
      .map((word) => (word.length <= 2 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`))
      .join(" ");
  }

  return normalized;
}

function extractMerchantFromText(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return "";

  const merchantPattern = String.raw`([A-Z][\p{L}\p{N}&+'.+-]*(?:\s+[A-Z][\p{L}\p{N}&+'.+-]*){0,2})`;
  const patterns = [
    new RegExp(String.raw`\b(?:[Yy]our\s+)?${merchantPattern}\s+(?:free\s+trial|trial|subscription|membership|renewal|invoice|bill|statement|return)\b`, "u"),
    new RegExp(String.raw`\b(?:invoice|bill|statement|payment|amount)\s+(?:from|for)\s+${merchantPattern}\b`, "u"),
    new RegExp(String.raw`\b(?:return|refund)\s+(?:from|for|to)\s+${merchantPattern}\b`, "u"),
    new RegExp(String.raw`\b${merchantPattern}\s+(?:renews|will\s+renew|auto-renews|trial\s+ends|trial\s+converts|is\s+due|payment\s+is\s+due)\b`, "u"),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const label = toDisplayLabel(match?.[1] ?? "");
    if (label) return label;
  }

  return "";
}

function chooseMerchantLabel(input: {
  bodyText: string;
  rawFrom: string;
  senderLabel: string;
  snippet: string;
  subject: string;
}) {
  const fromSubject = extractMerchantFromText(input.subject);
  if (fromSubject) return fromSubject;

  const fromSnippet = extractMerchantFromText(input.snippet);
  if (fromSnippet) return fromSnippet;

  const fromDomain = toDisplayLabel(getSenderDomainLabel(input.rawFrom));
  const fromSender = fromDomain ? toDisplayLabel(input.senderLabel) : "";
  if (fromSender) return fromSender;

  if (fromDomain) return fromDomain;

  return extractMerchantFromText(input.bodyText);
}

function extractAmount(text: string) {
  const matches = [...text.matchAll(/([$£€]) ?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g)];
  if (matches.length === 0) return undefined;

  const value = Number(matches[0][2].replace(/,/g, ""));
  if (!Number.isFinite(value)) return undefined;

  const currency = matches[0][1] === "£"
    ? "GBP"
    : matches[0][1] === "€"
      ? "EUR"
      : "USD";

  return { value, currency };
}

function formatAmount(value?: number, currency = "USD") {
  if (typeof value !== "number") return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
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

function duePhrase(dateIso: string) {
  const dueText = shortDue(dateIso);
  return /^(today|tomorrow|in )/.test(dueText) ? dueText : `on ${dueText}`;
}

function buildTitle(category: GmailCategory, merchant: string, dueAt: string) {
  const timing = duePhrase(dueAt);

  if (category === "trial") {
    return merchant
      ? `${merchant} trial may convert ${timing}`
      : `A trial may convert ${timing}`;
  }

  if (category === "renewal") {
    return merchant
      ? `${merchant} may renew ${timing}`
      : `A renewal may be due ${timing}`;
  }

  if (category === "return") {
    return merchant
      ? `${merchant} return window may close ${timing}`
      : `A return window may close ${timing}`;
  }

  return merchant
    ? `${merchant} may be due ${timing}`
    : `A bill may be due ${timing}`;
}

function buildDetail(category: GmailCategory, amount?: string) {
  if (category === "trial") {
    return amount
      ? `Review before it turns into a ${amount} charge.`
      : "Review before it turns into a charge.";
  }

  if (category === "renewal") {
    return amount
      ? `Review before another ${amount} payment goes through.`
      : "Review before another payment goes through.";
  }

  if (category === "return") {
    return amount
      ? `Keep this if you still have time to send it back and protect ${amount}.`
      : "Keep this if you still have time to send it back.";
  }

  return amount
    ? `Review before the ${amount} payment is missed.`
    : "Review before a payment is missed.";
}

function buildMessageContext(message: GmailMessage) {
  const subject = getHeader(message.payload, "Subject");
  const from = getHeader(message.payload, "From");
  const senderLabel = getSenderLabel(from);
  const snippet = normalizeWhitespace(message.snippet ?? "");
  const bodyText = normalizeWhitespace(extractBodyText(message.payload));
  const domainLabel = toDisplayLabel(getSenderDomainLabel(from));
  const safeSenderLabel = (domainLabel ? toDisplayLabel(senderLabel) : "") || domainLabel;
  const merchant = chooseMerchantLabel({
    bodyText,
    rawFrom: from,
    senderLabel,
    snippet,
    subject,
  });
  const rawText = `${subject} ${snippet} ${bodyText}`;
  const searchableText = normalizeWhitespace(rawText.toLowerCase());

  return {
    subject,
    merchant,
    source: merchant || safeSenderLabel || "Gmail",
    snippet,
    bodyText,
    rawText,
    searchableText,
  };
}

export function buildSearchQueries(categories: GmailCategory[]) {
  const allowed = categories.filter((category): category is GmailCategory => AUTO_CATEGORIES.includes(category));
  const queries: { category: GmailCategory; q: string; maxResults?: number }[] = [];

  for (const category of allowed) {
    SEARCH_TERMS[category].forEach((rule) => {
      queries.push({
        category,
        q: `${rule.query} newer_than:${rule.newerThanDays}d`,
        maxResults: rule.maxResults,
      });
    });
  }

  return queries;
}

export function messageToCandidateWithTrace(message: GmailMessage, hint: GmailCategory, allowed: GmailCategory[]) {
  const {
    merchant,
    source,
    rawText,
    searchableText,
  } = buildMessageContext(message);
  let candidate: Candidate | null = null;

  if (searchableText) {
    const category = chooseCategory(searchableText, hint, allowed);

    if (category) {
      const dueAt = extractDueDate(rawText, message.internalDate, category);
      const parsedAmount = extractAmount(rawText);
      const amountValue = parsedAmount?.value;
      const amountCurrency = parsedAmount?.currency;
      const amount = formatAmount(amountValue, amountCurrency);
      const title = buildTitle(category, merchant, dueAt);
      const detail = buildDetail(category, amount);
      const daysUntilDue = Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000);

      candidate = {
        id: `gmail:${message.id}`,
        source: "gmail",
        sourceMessageId: message.id,
        title,
        detail,
        category,
        dueAt,
        amountValue,
        amount,
        merchant: merchant || source,
        currency: amountCurrency,
        urgent: daysUntilDue <= 2,
      } satisfies Candidate;
    }
  }

  const trace: GmailCandidateTrace = {
    sourceMessageId: message.id,
    hint,
    candidateCreated: Boolean(candidate),
    candidateCategory: candidate?.category,
    candidateDueAt: candidate?.dueAt,
    candidateAmount: candidate?.amount,
    candidateCurrency: candidate?.currency,
    searchableTextLength: searchableText.length,
    flags: {
      containsBrightNet: searchableText.includes("brightnet"),
      containsInvoice: searchableText.includes("invoice"),
      containsDueOn: searchableText.includes("due on"),
      containsPoundAmount: /£\s?\d/.test(rawText),
      containsBillKeyword: CATEGORY_KEYWORDS.bill.some((keyword) => searchableText.includes(keyword)),
    },
  };

  return { candidate, trace };
}

export function messageToCandidate(message: GmailMessage, hint: GmailCategory, allowed: GmailCategory[]) {
  return messageToCandidateWithTrace(message, hint, allowed).candidate;
}
