import type {
  Candidate,
  GmailCategory,
  GmailVerificationEmailContext,
} from "./gmail.ts";

type AiVerifierCategory = GmailCategory | "none";

export type AiVerifierDecision = {
  should_surface: boolean;
  category: AiVerifierCategory;
  merchant: string | null;
  title: string | null;
  due_date: string | null;
  amount: number | null;
  currency: string | null;
  confidence: number;
  reason: string;
  evidence: string | null;
};

export type CandidateVerifierConfig = {
  enabled: boolean;
  apiKey?: string;
  endpoint: string;
  model: string;
  minConfidence: number;
  timeoutMs: number;
};

export type CandidateVerificationInput = {
  candidate: Candidate;
  email: GmailVerificationEmailContext;
};

export type CandidateVerifierResult = {
  enabled: boolean;
  approved: boolean;
  candidate?: Candidate;
  decision?: AiVerifierDecision;
  rejectionCode?: string;
  category?: AiVerifierCategory;
  confidence?: number;
};

type EnvGetter = (name: string) => string | undefined;
type AiVerifierCaller = (
  input: CandidateVerificationInput,
  config: CandidateVerifierConfig,
) => Promise<AiVerifierDecision>;

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MIN_CONFIDENCE = 0.82;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_SUBJECT_CHARS = 240;
const MAX_FROM_CHARS = 180;
const MAX_SNIPPET_CHARS = 500;
const MAX_BODY_CHARS = 2_400;

const CATEGORY_VALUES = new Set<AiVerifierCategory>([
  "trial",
  "renewal",
  "return",
  "bill",
  "none",
]);

const RETURN_WINDOW_EVIDENCE = [
  /\breturn window\b/,
  /\breturn by\b/,
  /\blast day to return\b/,
  /\breturn deadline\b/,
  /\beligible for return\b/,
  /\breturn label\b/,
  /\bdrop off\b/,
  /\bsend (?:it|this|them) back\b/,
  /\bexchange by\b/,
];

const UNPAID_BILL_EVIDENCE = [
  /\binvoice\b.{0,120}\bdue\b/,
  /\bbill\b.{0,120}\bdue\b/,
  /\bstatement\b.{0,120}\bdue\b/,
  /\bpayment\s+(?:is\s+)?due\b/,
  /\bbalance\s+due\b/,
  /\bamount\s+due\b/,
  /\bminimum\s+payment\s+due\b/,
  /\btotal\s+due\b/,
  /\bdue\s+(?:on|by|date)\b/,
  /\bpay\s+by\b/,
  /\boverdue\b/,
  /\bpast\s+due\b/,
  /\blate\s+fee\b/,
];

function envBoolean(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function envNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCandidateVerifierConfig(getEnv: EnvGetter): CandidateVerifierConfig {
  const apiKey = getEnv("GMAIL_AI_VERIFIER_API_KEY")?.trim()
    || getEnv("OPENAI_API_KEY")?.trim();
  const enabledOverride = envBoolean(getEnv("GMAIL_AI_VERIFIER_ENABLED"));

  return {
    enabled: enabledOverride === true && Boolean(apiKey),
    apiKey,
    endpoint: getEnv("GMAIL_AI_VERIFIER_ENDPOINT")?.trim() || DEFAULT_ENDPOINT,
    model: getEnv("GMAIL_AI_VERIFIER_MODEL")?.trim() || DEFAULT_MODEL,
    minConfidence: envNumber(getEnv("GMAIL_AI_VERIFIER_MIN_CONFIDENCE"), DEFAULT_MIN_CONFIDENCE),
    timeoutMs: envNumber(getEnv("GMAIL_AI_VERIFIER_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS),
  };
}

function truncate(value: string | undefined, maxChars: number) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars)}...` : normalized;
}

function buildVerifierPrompt(input: CandidateVerificationInput) {
  return {
    candidate: {
      title: input.candidate.title,
      category: input.candidate.category,
      merchant: input.candidate.merchant ?? null,
      due_date: input.candidate.dueAt,
      amount: input.candidate.amountValue ?? null,
      currency: input.candidate.currency ?? null,
    },
    email: {
      subject: truncate(input.email.subject, MAX_SUBJECT_CHARS),
      from: truncate(input.email.from, MAX_FROM_CHARS),
      snippet: truncate(input.email.snippet, MAX_SNIPPET_CHARS),
      body_excerpt: truncate(input.email.bodyExcerpt, MAX_BODY_CHARS),
      internal_date: input.email.internalDate ?? null,
    },
    instructions: [
      "Decide whether this shortlisted Gmail email is truly an actionable Undo item.",
      "Valid categories are trial, renewal, return, bill, or none.",
      "Reject receipts, booking confirmations, ride receipts, refunds, transfer returns, payment confirmations, and generic keyword matches without a real user action.",
      "For return, require a retail return window or deadline.",
      "For bill, require unpaid bill, invoice due, payment due, overdue, balance due, or late fee evidence.",
      "If the date is uncertain, set should_surface false.",
      "Return structured JSON only.",
    ],
    response_shape: {
      should_surface: "boolean",
      category: "trial | renewal | return | bill | none",
      merchant: "string | null",
      title: "string | null",
      due_date: "ISO date string | null",
      amount: "number | null",
      currency: "string | null",
      confidence: "number from 0 to 1",
      reason: "short internal reason",
      evidence: "short phrase from the email | null",
    },
  };
}

function extractModelText(payload: unknown) {
  const data = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };

  const chatContent = data.choices?.[0]?.message?.content;
  if (typeof chatContent === "string") return chatContent;

  if (typeof data.output_text === "string") return data.output_text;

  const responseText = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .find((value): value is string => typeof value === "string");

  return responseText ?? "";
}

function parseJsonObject(text: string) {
  const trimmed = text.trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI verifier returned no JSON object.");
  }

  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDecision(value: unknown): AiVerifierDecision {
  const record = value as Record<string, unknown>;
  const category = typeof record.category === "string" && CATEGORY_VALUES.has(record.category as AiVerifierCategory)
    ? record.category as AiVerifierCategory
    : "none";
  const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence)
    ? Math.max(0, Math.min(1, record.confidence))
    : 0;
  const amount = typeof record.amount === "number" && Number.isFinite(record.amount)
    ? record.amount
    : null;

  return {
    should_surface: record.should_surface === true,
    category,
    merchant: nullableString(record.merchant),
    title: nullableString(record.title),
    due_date: nullableString(record.due_date),
    amount,
    currency: nullableString(record.currency)?.toUpperCase() ?? null,
    confidence,
    reason: nullableString(record.reason) ?? "No reason provided.",
    evidence: nullableString(record.evidence),
  };
}

async function callOpenAiCompatibleVerifier(
  input: CandidateVerificationInput,
  config: CandidateVerifierConfig,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 320,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are Undo's cautious Gmail candidate verifier. Return JSON only. Suppress weak or ambiguous suggestions.",
          },
          {
            role: "user",
            content: JSON.stringify(buildVerifierPrompt(input)),
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`AI verifier request failed with ${response.status}.`);
    }

    return normalizeDecision(parseJsonObject(extractModelText(payload)));
  } finally {
    clearTimeout(timeoutId);
  }
}

function isValidDueDate(value: string | null) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function hasEvidence(value: string | null, patterns: RegExp[]) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return patterns.some((pattern) => pattern.test(lower));
}

function formatVerifiedAmount(value: number | null, currency: string | null) {
  if (typeof value !== "number") return undefined;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return undefined;
  }
}

function buildVerifiedDetail(category: GmailCategory, amount?: string) {
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
      ? `Review before the return window closes for ${amount}.`
      : "Review before the return window closes.";
  }

  return amount
    ? `Review before the ${amount} payment is missed.`
    : "Review before a payment is missed.";
}

function safeTitle(value: string | null, fallback: string) {
  const title = value?.replace(/\s+/g, " ").trim();
  if (!title) return fallback;
  return title.length > 96 ? `${title.slice(0, 96).trim()}...` : title;
}

export function applyVerifierDecision(
  candidate: Candidate,
  decision: AiVerifierDecision,
  minConfidence = DEFAULT_MIN_CONFIDENCE,
): CandidateVerifierResult {
  if (!decision.should_surface) {
    return { enabled: true, approved: false, decision, rejectionCode: "not_actionable", category: decision.category, confidence: decision.confidence };
  }

  if (decision.category === "none" || !CATEGORY_VALUES.has(decision.category)) {
    return { enabled: true, approved: false, decision, rejectionCode: "category_none", category: decision.category, confidence: decision.confidence };
  }

  if (decision.confidence < minConfidence) {
    return { enabled: true, approved: false, decision, rejectionCode: "low_confidence", category: decision.category, confidence: decision.confidence };
  }

  if (!isValidDueDate(decision.due_date)) {
    return { enabled: true, approved: false, decision, rejectionCode: "missing_reliable_date", category: decision.category, confidence: decision.confidence };
  }

  if (decision.category === "return" && !hasEvidence(decision.evidence, RETURN_WINDOW_EVIDENCE)) {
    return { enabled: true, approved: false, decision, rejectionCode: "weak_return_evidence", category: decision.category, confidence: decision.confidence };
  }

  if (decision.category === "bill" && !hasEvidence(decision.evidence, UNPAID_BILL_EVIDENCE)) {
    return { enabled: true, approved: false, decision, rejectionCode: "weak_bill_evidence", category: decision.category, confidence: decision.confidence };
  }

  const category = decision.category;
  const dueAt = new Date(decision.due_date!).toISOString();
  const amountValue = decision.amount ?? undefined;
  const currency = decision.currency ?? candidate.currency;
  const amount = formatVerifiedAmount(amountValue ?? null, currency ?? null);

  return {
    enabled: true,
    approved: true,
    decision,
    category,
    confidence: decision.confidence,
    candidate: {
      ...candidate,
      category,
      title: safeTitle(decision.title, candidate.title),
      dueAt,
      amountValue,
      amount,
      merchant: decision.merchant ?? candidate.merchant,
      currency,
      detail: buildVerifiedDetail(category, amount),
      urgent: Math.round((new Date(dueAt).getTime() - Date.now()) / 86400000) <= 2,
    },
  };
}

export async function verifyCandidateWithAi(
  input: CandidateVerificationInput,
  config: CandidateVerifierConfig,
  callVerifier: AiVerifierCaller = callOpenAiCompatibleVerifier,
): Promise<CandidateVerifierResult> {
  if (!config.enabled || !config.apiKey) {
    return {
      enabled: false,
      approved: true,
      candidate: input.candidate,
      rejectionCode: "verifier_disabled",
      category: input.candidate.category,
    };
  }

  try {
    const decision = await callVerifier(input, config);
    return applyVerifierDecision(input.candidate, decision, config.minConfidence);
  } catch {
    return {
      enabled: true,
      approved: false,
      rejectionCode: "verifier_failed",
      category: input.candidate.category,
    };
  }
}
