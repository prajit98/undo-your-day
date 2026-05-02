import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  buildSearchQueries,
  messageToCandidate,
  messageToCandidateWithTrace,
  type Candidate,
  type GmailCandidateTrace,
  type GmailCategory,
  type GmailMessage,
} from "../_shared/gmail.ts";
import { corsHeaders, withCorsHeaders } from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/google.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import {
  decryptGmailRefreshToken,
  encryptGmailRefreshToken,
  isEncryptedGmailRefreshToken,
} from "../_shared/token-crypto.ts";

const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const AUTO_CATEGORIES = new Set(["trial", "renewal", "return", "bill"]);
const GMAIL_FETCH_TIMEOUT_MS = 10_000;
const MAX_LIST_QUERIES_PER_RUN = 5;
const MAX_RESULTS_PER_QUERY = 2;
const MAX_MESSAGE_IDS_TO_SCAN = 6;
const MAX_CANDIDATES_TO_RETURN = 4;
const DEFAULT_ENABLED_CATEGORIES = ["trial", "renewal", "return", "bill", "followup"] as const;
const DIAGNOSTIC_QUERY = "newer_than:30d";
const DIAGNOSTIC_MAX_RESULTS = 2;
const DIAGNOSTIC_MAX_FETCHES = 1;
const DIAGNOSTIC_CATEGORIES: GmailCategory[] = ["trial", "renewal", "return", "bill"];
const BILL_TRACE_VERSION = "bill-trace-2026-05-02-v2";

type StoredTokenRow = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
};

type CandidateStatus = "pending" | "kept" | "dismissed";

type CandidateItemRow = {
  id: string;
  user_id: string;
  source: string;
  source_message_id: string;
  category: GmailCategory;
  title: string;
  description?: string | null;
  merchant?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  due_at: string;
  status: CandidateStatus;
};

class SyncError extends Error {
  stage: string;
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(input: {
    message: string;
    stage: string;
    code: string;
    status?: number;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "SyncError";
    this.stage = input.stage;
    this.code = input.code;
    this.status = input.status ?? 500;
    this.details = input.details;
  }
}

type FailurePayload = {
  requestId: string;
  stage: string;
  code: string;
  message: string;
  status: number;
  stack?: string;
  details?: Record<string, unknown>;
  userId?: string;
  gmailEmail?: string;
  timestamp: string;
};

type AccessTokenResult = {
  accessToken: string;
  tokenRefreshAttempted: boolean;
  tokenRefreshSucceeded: boolean;
  accessTokenWasFresh: boolean;
};

type GmailDiagnosticResult = {
  diagnostic: true;
  success: boolean;
  stage: string;
  code: string;
  message: string;
  requestId: string;
  requestCountUsed: number;
  tokenRefreshSucceeded: boolean;
  gmailListSucceeded: boolean;
  gmailMessageFetchSucceeded: boolean;
  parsingSucceeded: boolean;
  checks: {
    connected: boolean;
    tokenLookupSucceeded: boolean;
    accessTokenResolved: boolean;
    tokenRefreshAttempted: boolean;
    tokenRefreshSucceeded: boolean;
    gmailListSucceeded: boolean;
    gmailMessageFetchSucceeded: boolean;
    parsingSucceeded: boolean;
  };
  details: Record<string, unknown>;
  stack?: string;
  timestamp: string;
};

type DiagnosticPhase = "list" | "message";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: withCorsHeaders({
      "Content-Type": "application/json",
    }),
  });
}

function logSyncEvent(level: "log" | "warn" | "error", event: string, details?: Record<string, unknown>) {
  console[level](`[Undo Gmail Sync] ${event}`, details ?? {});
}

function logBillTraceMarker(marker: "BILL_TRACE_START" | "BILL_TRACE_END", details: Record<string, unknown>) {
  console.log(marker, {
    traceVersion: BILL_TRACE_VERSION,
    ...details,
  });
}

function shouldTraceInvoiceMessage(trace: GmailCandidateTrace) {
  return trace.hint === "bill"
    || trace.candidateCategory === "bill"
    || trace.flags.containsBrightNet
    || trace.flags.containsInvoice;
}

function selectMessageIdsForFirstPass(
  listedMessages: Array<{ id: string; category: GmailCategory }>,
  queryCategories: GmailCategory[],
) {
  const selected = new Map<string, GmailCategory>();
  const uniqueCategories = Array.from(new Set(queryCategories));
  const addMessage = (message: { id: string; category: GmailCategory }) => {
    if (selected.size >= MAX_MESSAGE_IDS_TO_SCAN || selected.has(message.id)) {
      return;
    }
    selected.set(message.id, message.category);
  };

  for (const category of uniqueCategories) {
    const firstForCategory = listedMessages.find((message) => message.category === category);
    if (firstForCategory) {
      addMessage(firstForCategory);
    }
  }

  listedMessages
    .filter((message) => message.category === "bill")
    .forEach(addMessage);

  for (const message of listedMessages) {
    if (selected.size >= MAX_MESSAGE_IDS_TO_SCAN) {
      break;
    }
    addMessage(message);
  }

  return selected;
}

function normalizeError(error: unknown): SyncError {
  if (error instanceof SyncError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Could not scan Gmail right now.";
  return new SyncError({
    message,
    stage: "unexpected",
    code: "unexpected_error",
    status: message === "Unauthorized" ? 401 : 500,
  });
}

function buildFailurePayload(
  error: unknown,
  context: {
    requestId: string;
    userId?: string;
    gmailEmail?: string;
    details?: Record<string, unknown>;
  },
): FailurePayload {
  const failure = normalizeError(error);
  return {
    requestId: context.requestId,
    stage: failure.stage,
    code: failure.code,
    message: failure.message,
    status: failure.status,
    stack: failure.stack,
    details: {
      ...(context.details ?? {}),
      ...(failure.details ?? {}),
    },
    userId: context.userId,
    gmailEmail: context.gmailEmail,
    timestamp: new Date().toISOString(),
  };
}

async function gmailFetchJson<T>(accessToken: string, url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GMAIL_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new SyncError({
        message: "Gmail took too long to respond.",
        stage: "gmail_api",
        code: "gmail_request_timeout",
        status: 504,
        details: { url },
      });
    }

    throw error;
  }

  clearTimeout(timeoutId);

  const text = await response.text();
  if (!response.ok) {
    let parsedBody: Record<string, unknown> | null = null;
    try {
      parsedBody = text ? JSON.parse(text) as Record<string, unknown> : null;
    } catch {
      parsedBody = null;
    }

    const gmailReason = Array.isArray(parsedBody?.error && typeof parsedBody.error === "object"
      ? (parsedBody.error as { errors?: Array<{ reason?: string }> }).errors
      : undefined)
      ? ((parsedBody?.error as { errors?: Array<{ reason?: string }> }).errors ?? [])
          .find((entry) => typeof entry?.reason === "string")?.reason
      : undefined;

    if (
      response.status === 403
      && (gmailReason === "rateLimitExceeded" || gmailReason === "userRateLimitExceeded" || text.includes("rateLimitExceeded"))
    ) {
      throw new SyncError({
        message: "Gmail is busy right now. Please wait a minute and try again.",
        stage: "gmail_api",
        code: "gmail_rate_limited",
        status: 429,
        details: {
          url,
          responseStatus: response.status,
          gmailReason,
          responseBody: text.slice(0, 500),
        },
      });
    }

    throw new SyncError({
      message: "Gmail request failed.",
      stage: "gmail_api",
      code: "gmail_request_failed",
      status: 502,
      details: {
        url,
        responseStatus: response.status,
        responseBody: text.slice(0, 500),
      },
    });
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SyncError({
      message: "Gmail returned an unreadable response.",
      stage: "gmail_api",
      code: "gmail_invalid_json",
      status: 502,
      details: {
        url,
        responseBody: text.slice(0, 500),
      },
    });
  }
}

async function listMessageIds(accessToken: string, q: string, maxResults = MAX_RESULTS_PER_QUERY) {
  const url = new URL(GMAIL_API_BASE_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", String(maxResults));

  const data = await gmailFetchJson<{ messages?: Array<{ id: string }> }>(accessToken, url.toString());
  return (data.messages ?? []).map((message) => message.id);
}

async function getMessage(accessToken: string, messageId: string) {
  const url = new URL(`${GMAIL_API_BASE_URL}/${encodeURIComponent(messageId)}`);
  url.searchParams.set("format", "full");
  return gmailFetchJson<GmailMessage>(accessToken, url.toString());
}

async function resolveAccessToken(userId: string, tokenRow: StoredTokenRow, admin = createAdminClient()): Promise<AccessTokenResult> {
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;

  if (tokenRow.refresh_token && !isEncryptedGmailRefreshToken(tokenRow.refresh_token)) {
    const { error } = await admin.from("gmail_tokens").update({
      refresh_token: await encryptGmailRefreshToken(tokenRow.refresh_token),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    if (error) {
      throw new SyncError({
        message: error.message,
        stage: "token_security",
        code: "gmail_refresh_token_encrypt_failed",
        status: 500,
        details: { userId },
      });
    }
  }

  if (tokenRow.access_token && expiresAt > Date.now() + 60_000) {
    logSyncEvent("log", "using_stored_access_token", { userId, expiresAt: tokenRow.expires_at });
    return {
      accessToken: tokenRow.access_token,
      tokenRefreshAttempted: false,
      tokenRefreshSucceeded: false,
      accessTokenWasFresh: true,
    };
  }

  const refreshToken = await decryptGmailRefreshToken(tokenRow.refresh_token);

  if (!refreshToken) {
    throw new SyncError({
      message: "Reconnect Gmail to keep importing real matches.",
      stage: "token_refresh",
      code: "gmail_refresh_token_missing",
      status: 409,
      details: { userId, tokenRefreshAttempted: false, tokenRefreshSucceeded: false },
    });
  }

  logSyncEvent("log", "refreshing_access_token", { userId });

  let refreshed;
  try {
    refreshed = await refreshAccessToken(refreshToken);
  } catch (error) {
    throw new SyncError({
      message: error instanceof Error ? error.message : "Could not refresh Gmail access.",
      stage: "token_refresh",
      code: "gmail_refresh_failed",
      status: 502,
      details: { userId, tokenRefreshAttempted: true, tokenRefreshSucceeded: false },
    });
  }

  if (!refreshed.access_token) {
    throw new SyncError({
      message: "Could not refresh Gmail access.",
      stage: "token_refresh",
      code: "gmail_refresh_missing_access_token",
      status: 502,
      details: { userId, tokenRefreshAttempted: true, tokenRefreshSucceeded: false },
    });
  }

  const nextExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;

  const { error } = await admin.from("gmail_tokens").update({
    access_token: refreshed.access_token,
    refresh_token: await encryptGmailRefreshToken(refreshToken),
    token_type: refreshed.token_type ?? "Bearer",
    scope: refreshed.scope?.split(/\s+/).filter(Boolean) ?? [],
    expires_at: nextExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  if (error) {
    throw new SyncError({
      message: error.message,
      stage: "token_refresh",
      code: "gmail_token_update_failed",
      status: 500,
      details: { userId, tokenRefreshAttempted: true, tokenRefreshSucceeded: true },
    });
  }

  return {
    accessToken: refreshed.access_token,
    tokenRefreshAttempted: true,
    tokenRefreshSucceeded: true,
    accessTokenWasFresh: false,
  };
}

async function ensureAccessToken(userId: string, tokenRow: StoredTokenRow, admin = createAdminClient()) {
  const result = await resolveAccessToken(userId, tokenRow, admin);
  return result.accessToken;
}

function safeMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

async function runGmailDiagnostic(input: {
  requestId: string;
  userId: string;
  phase: DiagnosticPhase;
  connection: Record<string, unknown> | null;
  connectionError: unknown;
  tokenRow: StoredTokenRow | null;
  tokenError: unknown;
  admin: ReturnType<typeof createAdminClient>;
}): Promise<GmailDiagnosticResult> {
  let requestCountUsed = 0;
  const gmailEmail = typeof input.connection?.gmail_email === "string" ? input.connection.gmail_email : undefined;
  const checks: GmailDiagnosticResult["checks"] = {
    connected: false,
    tokenLookupSucceeded: false,
    accessTokenResolved: false,
    tokenRefreshAttempted: false,
    tokenRefreshSucceeded: false,
    gmailListSucceeded: false,
    gmailMessageFetchSucceeded: false,
    parsingSucceeded: false,
  };

  const finish = (result: {
    success: boolean;
    stage: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  }): GmailDiagnosticResult => ({
    diagnostic: true,
    success: result.success,
    stage: result.stage,
    code: result.code,
    message: result.message,
    requestId: input.requestId,
    requestCountUsed,
    tokenRefreshSucceeded: checks.tokenRefreshSucceeded,
    gmailListSucceeded: checks.gmailListSucceeded,
    gmailMessageFetchSucceeded: checks.gmailMessageFetchSucceeded,
    parsingSucceeded: checks.parsingSucceeded,
    checks: { ...checks },
    details: {
      userId: input.userId,
      gmailEmail,
      diagnosticPhase: input.phase,
      diagnosticQuery: DIAGNOSTIC_QUERY,
      maxListResults: DIAGNOSTIC_MAX_RESULTS,
      maxMessageFetches: DIAGNOSTIC_MAX_FETCHES,
      ...(result.details ?? {}),
    },
    stack: result.stack,
    timestamp: new Date().toISOString(),
  });

  logSyncEvent("log", "diagnostic_started", {
    requestId: input.requestId,
    userId: input.userId,
    gmailEmail,
    phase: input.phase,
  });

  try {
    if (input.connectionError) {
      return finish({
        success: false,
        stage: "connection_lookup",
        code: "gmail_connection_lookup_failed",
        message: safeMessage(input.connectionError, "Could not read the Gmail connection."),
        details: { hasConnection: false },
      });
    }

    if (input.tokenError) {
      return finish({
        success: false,
        stage: "token_lookup",
        code: "gmail_token_lookup_failed",
        message: safeMessage(input.tokenError, "Could not read the Gmail token."),
        details: { hasTokenRow: false },
      });
    }

    checks.tokenLookupSucceeded = true;
    checks.connected = Boolean(input.connection && input.tokenRow);

    if (!input.connection || !input.tokenRow) {
      return finish({
        success: false,
        stage: "connection_lookup",
        code: "gmail_not_connected",
        message: "Connect Gmail first.",
        details: {
          hasConnection: Boolean(input.connection),
          hasTokenRow: Boolean(input.tokenRow),
        },
      });
    }

    const tokenResult = await resolveAccessToken(input.userId, input.tokenRow, input.admin);
    checks.accessTokenResolved = true;
    checks.tokenRefreshAttempted = tokenResult.tokenRefreshAttempted;
    checks.tokenRefreshSucceeded = tokenResult.tokenRefreshSucceeded;

    requestCountUsed += 1;
    const messageIds = await listMessageIds(tokenResult.accessToken, DIAGNOSTIC_QUERY, DIAGNOSTIC_MAX_RESULTS);
    checks.gmailListSucceeded = true;

    if (input.phase === "list") {
      const result = finish({
        success: true,
        stage: "gmail_list",
        code: "diagnostic_list_completed",
        message: "Diagnostic completed connection, token, and Gmail list only.",
        details: {
          accessTokenWasFresh: tokenResult.accessTokenWasFresh,
          listedMessageCount: messageIds.length,
          fetchedMessageCount: 0,
          messageFetchSkipped: true,
          parsingSkipped: true,
          nextPhase: "message",
        },
      });
      logSyncEvent("log", "diagnostic_completed", result);
      return result;
    }

    if (messageIds.length === 0) {
      const result = finish({
        success: true,
        stage: "gmail_list",
        code: "diagnostic_no_messages",
        message: "Diagnostic reached Gmail. No recent messages were returned.",
        details: {
          accessTokenWasFresh: tokenResult.accessTokenWasFresh,
          listedMessageCount: 0,
          fetchedMessageCount: 0,
          parsingSkipped: true,
        },
      });
      logSyncEvent("log", "diagnostic_completed", result);
      return result;
    }

    const messageId = messageIds.slice(0, DIAGNOSTIC_MAX_FETCHES)[0];
    if (!messageId) {
      return finish({
        success: true,
        stage: "gmail_list",
        code: "diagnostic_no_fetchable_message",
        message: "Diagnostic reached Gmail. No fetchable message was returned.",
        details: {
          accessTokenWasFresh: tokenResult.accessTokenWasFresh,
          listedMessageCount: messageIds.length,
          fetchedMessageCount: 0,
        },
      });
    }

    requestCountUsed += 1;
    const message = await getMessage(tokenResult.accessToken, messageId);
    checks.gmailMessageFetchSucceeded = true;

    const parsedCandidate = messageToCandidate(message, "trial", DIAGNOSTIC_CATEGORIES);
    checks.parsingSucceeded = true;

    const result = finish({
      success: true,
      stage: "parse",
      code: parsedCandidate ? "diagnostic_candidate_parsed" : "diagnostic_message_parsed",
      message: parsedCandidate
        ? "Diagnostic reached Gmail, fetched one message, and parsed an Undo candidate."
        : "Diagnostic reached Gmail and parsed one message. It was not an Undo candidate.",
      details: {
        accessTokenWasFresh: tokenResult.accessTokenWasFresh,
        listedMessageCount: messageIds.length,
        fetchedMessageCount: 1,
        firstMessageHasPayload: Boolean(message.payload),
        firstMessageLabelCount: Array.isArray(message.labelIds) ? message.labelIds.length : 0,
        firstMessageSnippetLength: typeof message.snippet === "string" ? message.snippet.length : 0,
        parsedCandidateFound: Boolean(parsedCandidate),
        parsedCandidateCategory: parsedCandidate?.category,
        parsedCandidateDueAt: parsedCandidate?.dueAt,
      },
    });
    logSyncEvent("log", "diagnostic_completed", result);
    return result;
  } catch (error) {
    const failure = buildFailurePayload(error, {
      requestId: input.requestId,
      userId: input.userId,
      gmailEmail,
      details: { diagnostic: true },
    });

    if (typeof failure.details?.tokenRefreshAttempted === "boolean") {
      checks.tokenRefreshAttempted = failure.details.tokenRefreshAttempted;
    }
    if (typeof failure.details?.tokenRefreshSucceeded === "boolean") {
      checks.tokenRefreshSucceeded = failure.details.tokenRefreshSucceeded;
    }

    const result = finish({
      success: false,
      stage: failure.stage,
      code: failure.code,
      message: failure.message,
      stack: failure.stack,
      details: {
        status: failure.status,
        failureDetails: failure.details,
      },
    });
    logSyncEvent("error", "diagnostic_failed", result);
    return result;
  }
}

async function ensurePreferencesRow(userId: string, admin = createAdminClient()) {
  const { data: preferences, error } = await admin
    .from("preferences")
    .select("enabled_categories")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new SyncError({
      message: error.message,
      stage: "preferences_lookup",
      code: "gmail_preferences_lookup_failed",
      status: 500,
      details: { userId },
    });
  }

  if (preferences) {
    return preferences;
  }

  logSyncEvent("warn", "preferences_missing_backfill", { userId });

  const { data: insertedPreferences, error: insertError } = await admin
    .from("preferences")
    .upsert({
      user_id: userId,
      enabled_categories: [...DEFAULT_ENABLED_CATEGORIES],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    })
    .select("enabled_categories")
    .single();

  if (insertError) {
    throw new SyncError({
      message: insertError.message,
      stage: "preferences_lookup",
      code: "gmail_preferences_backfill_failed",
      status: 500,
      details: { userId },
    });
  }

  return insertedPreferences;
}

function amountNumber(value: CandidateItemRow["amount"]) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function formatAmount(value?: number, currency = "USD") {
  if (typeof value !== "number") return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function candidateItemToCandidate(row: CandidateItemRow): Candidate {
  const amountValue = amountNumber(row.amount);
  const currency = row.currency ?? "USD";
  const daysUntilDue = Math.round((new Date(row.due_at).getTime() - Date.now()) / 86400000);

  return {
    id: row.id,
    source: "gmail",
    sourceMessageId: row.source_message_id,
    title: row.title,
    detail: row.description ?? undefined,
    category: row.category,
    dueAt: row.due_at,
    amountValue,
    amount: formatAmount(amountValue, currency),
    merchant: row.merchant ?? undefined,
    currency,
    status: row.status,
    urgent: daysUntilDue <= 2,
  };
}

async function fetchPendingCandidateItems(userId: string, admin = createAdminClient()) {
  const { data, error } = await admin
    .from("candidate_items")
    .select("id, user_id, source, source_message_id, category, title, description, merchant, amount, currency, due_at, status")
    .eq("user_id", userId)
    .eq("source", "gmail")
    .eq("status", "pending")
    .order("due_at", { ascending: true })
    .limit(20);

  if (error) {
    throw new SyncError({
      message: error.message,
      stage: "candidate_store",
      code: "candidate_fetch_failed",
      status: 500,
      details: { userId },
    });
  }

  return (data ?? []).map((row) => candidateItemToCandidate(row as CandidateItemRow));
}

async function persistCandidateItems(
  userId: string,
  candidates: Candidate[],
  admin = createAdminClient(),
  traceContext?: { requestId: string },
) {
  const sourceMessageIds = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.sourceMessageId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (sourceMessageIds.length === 0) {
    return fetchPendingCandidateItems(userId, admin);
  }

  const { data: existingRows, error: existingError } = await admin
    .from("candidate_items")
    .select("id, source_message_id, status")
    .eq("user_id", userId)
    .eq("source", "gmail")
    .in("source_message_id", sourceMessageIds);

  if (existingError) {
    throw new SyncError({
      message: existingError.message,
      stage: "candidate_store",
      code: "candidate_existing_lookup_failed",
      status: 500,
      details: { userId, sourceMessageIds },
    });
  }

  const existingByMessage = new Map(
    (existingRows ?? []).map((row) => [
      String(row.source_message_id),
      {
        id: String(row.id),
        status: row.status as CandidateStatus,
      },
    ]),
  );
  const suppressedByStatus = candidates
    .filter((candidate) => {
      const sourceMessageId = candidate.sourceMessageId;
      if (!sourceMessageId) return false;
      const existing = existingByMessage.get(sourceMessageId);
      return Boolean(existing && existing.status !== "pending");
    })
    .map((candidate) => ({
      sourceMessageId: candidate.sourceMessageId,
      category: candidate.category,
      status: existingByMessage.get(candidate.sourceMessageId ?? "")?.status,
    }));

  const now = new Date().toISOString();
  const upsertRows = candidates
    .filter((candidate) => {
      const sourceMessageId = candidate.sourceMessageId;
      if (!sourceMessageId) return false;
      const existing = existingByMessage.get(sourceMessageId);
      return !existing || existing.status === "pending";
    })
    .map((candidate) => {
      const sourceMessageId = candidate.sourceMessageId!;
      const existing = existingByMessage.get(sourceMessageId);

      return {
        ...(existing ? { id: existing.id } : {}),
        user_id: userId,
        source: "gmail",
        source_message_id: sourceMessageId,
        category: candidate.category,
        title: candidate.title,
        description: candidate.detail ?? null,
        merchant: candidate.merchant ?? null,
        amount: candidate.amountValue ?? null,
        currency: candidate.currency ?? "USD",
        due_at: candidate.dueAt,
        status: "pending",
        updated_at: now,
      };
    });

  if (traceContext && candidates.some((candidate) => candidate.category === "bill")) {
    logSyncEvent("log", "bill_invoice_persistence_trace", {
      requestId: traceContext.requestId,
      detectedBillCandidateIds: candidates
        .filter((candidate) => candidate.category === "bill")
        .map((candidate) => candidate.sourceMessageId),
      existingStatuses: Array.from(existingByMessage.entries()).map(([sourceMessageId, existing]) => ({
        sourceMessageId,
        status: existing.status,
      })),
      upsertBillCandidateIds: upsertRows
        .filter((row) => row.category === "bill")
        .map((row) => row.source_message_id),
      suppressedByStatus,
    });
  }

  if (upsertRows.length > 0) {
    const { error } = await admin
      .from("candidate_items")
      .upsert(upsertRows, {
        onConflict: "user_id,source,source_message_id",
      });

    if (error) {
      throw new SyncError({
        message: error.message,
        stage: "candidate_store",
        code: "candidate_upsert_failed",
        status: 500,
        details: {
          userId,
          candidateCount: upsertRows.length,
        },
      });
    }
  }

  const pendingCandidates = await fetchPendingCandidateItems(userId, admin);

  if (traceContext && candidates.some((candidate) => candidate.category === "bill")) {
    logSyncEvent("log", "bill_invoice_pending_output_trace", {
      requestId: traceContext.requestId,
      pendingBillCandidateIds: pendingCandidates
        .filter((candidate) => candidate.category === "bill")
        .map((candidate) => candidate.sourceMessageId),
      returnedCandidateCount: pendingCandidates.length,
    });
  }

  return pendingCandidates;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  let userId: string | undefined;
  let gmailEmail: string | undefined;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const diagnosticMode = body.mode === "diagnostic" || body.diagnostic === true;
    const diagnosticPhase: DiagnosticPhase = body.phase === "message" || body.includeMessage === true
      ? "message"
      : "list";
    const user = await requireUser(req);
    userId = user.id;
    const admin = createAdminClient();

    const [{ data: connection, error: connectionError }, { data: tokenRow, error: tokenError }] = await Promise.all([
      admin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle(),
      admin.from("gmail_tokens").select("access_token, refresh_token, expires_at").eq("user_id", user.id).maybeSingle(),
    ]);

    if (diagnosticMode) {
      return jsonResponse(await runGmailDiagnostic({
        requestId,
        userId: user.id,
        phase: diagnosticPhase,
        connection: connection as Record<string, unknown> | null,
        connectionError,
        tokenRow: tokenRow as StoredTokenRow | null,
        tokenError,
        admin,
      }));
    }

    if (connectionError) {
      throw new SyncError({
        message: connectionError.message,
        stage: "connection_lookup",
        code: "gmail_connection_lookup_failed",
        status: 500,
        details: { userId: user.id },
      });
    }
    if (tokenError) {
      throw new SyncError({
        message: tokenError.message,
        stage: "token_lookup",
        code: "gmail_token_lookup_failed",
        status: 500,
        details: { userId: user.id },
      });
    }

    if (!connection || !tokenRow) {
      throw new SyncError({
        message: "Connect Gmail first.",
        stage: "connection_lookup",
        code: "gmail_not_connected",
        status: 409,
        details: {
          userId: user.id,
          hasConnection: Boolean(connection),
          hasTokenRow: Boolean(tokenRow),
        },
      });
    }

    gmailEmail = typeof connection.gmail_email === "string" ? connection.gmail_email : undefined;
    const preferences = await ensurePreferencesRow(user.id, admin);
    const allowedCategories = (Array.isArray(preferences.enabled_categories) ? preferences.enabled_categories : [])
      .filter((category): category is GmailCategory => AUTO_CATEGORIES.has(String(category)));
    const categories = allowedCategories.length > 0 ? allowedCategories : ["trial", "renewal", "return", "bill"];
    const accessToken = await ensureAccessToken(user.id, tokenRow as StoredTokenRow, admin);
    const searchQueries = buildSearchQueries(categories).slice(0, MAX_LIST_QUERIES_PER_RUN);

    logSyncEvent("log", "starting_sync", {
      requestId,
      userId: user.id,
      gmailEmail,
      categories,
      searchQueryCount: searchQueries.length,
    });

    const listedMessages: Array<{ id: string; category: GmailCategory }> = [];
    const listedMessageIds = new Set<string>();
    const listFailures: Array<Record<string, unknown>> = [];
    const invoiceTrace: Record<string, unknown> = {
      marker: "BILL_TRACE_RESPONSE",
      traceVersion: BILL_TRACE_VERSION,
      requestId,
      billQueries: [],
      selectedBillMessageIds: [],
      billMessageTraces: [],
    };
    logBillTraceMarker("BILL_TRACE_START", {
      requestId,
      userId: user.id,
      categories,
      billQueries: searchQueries
        .filter((query) => query.category === "bill")
        .map((query) => ({
          query: query.q,
          maxResults: query.maxResults ?? MAX_RESULTS_PER_QUERY,
        })),
    });

    for (const { category, q, maxResults } of searchQueries) {
      try {
        const ids = await listMessageIds(accessToken, q, maxResults);
        logSyncEvent("log", "list_query_succeeded", {
          requestId,
          category,
          query: q,
          maxResults: maxResults ?? MAX_RESULTS_PER_QUERY,
          count: ids.length,
        });

        if (category === "bill") {
          (invoiceTrace.billQueries as Array<Record<string, unknown>>).push({
            query: q,
            maxResults: maxResults ?? MAX_RESULTS_PER_QUERY,
            count: ids.length,
            messageIds: ids,
          });
        }

        ids.forEach((id) => {
          if (!listedMessageIds.has(id)) {
            listedMessageIds.add(id);
            listedMessages.push({ id, category });
          }
        });
      } catch (error) {
        const failure = normalizeError(error);
        const details = {
          requestId,
          stage: failure.stage,
          code: failure.code,
          message: failure.message,
          ...(failure.details ?? {}),
        };
        listFailures.push(details);
        logSyncEvent("warn", "list_query_failed", details);
      }
    }

    const messageIdsByHint = selectMessageIdsForFirstPass(
      listedMessages,
      searchQueries.map((query) => query.category),
    );
    invoiceTrace.selectedBillMessageIds = Array.from(messageIdsByHint.entries())
      .filter(([, category]) => category === "bill")
      .map(([messageId]) => messageId);
    logSyncEvent("log", "bill_invoice_selection_trace", invoiceTrace);

    if (messageIdsByHint.size === 0 && listFailures.some((failure) => failure.code === "gmail_rate_limited")) {
      throw new SyncError({
        message: "Gmail is busy right now. Please wait a minute and try again.",
        stage: "gmail_api",
        code: "gmail_rate_limited",
        status: 429,
        details: {
          userId: user.id,
          failedQueries: listFailures.length,
        },
      });
    }

    if (messageIdsByHint.size === 0 && listFailures.length === searchQueries.length && searchQueries.length > 0) {
      throw new SyncError({
        message: "Undo could not scan Gmail right now.",
        stage: "gmail_list",
        code: "gmail_all_queries_failed",
        status: 502,
        details: {
          userId: user.id,
          failedQueries: listFailures.length,
        },
      });
    }

    const messageFailures: Array<Record<string, unknown>> = [];
    const candidateResults: Candidate[] = [];

    for (const [messageId, hint] of messageIdsByHint.entries()) {
      try {
        const message = await getMessage(accessToken, messageId);
        const { candidate, trace } = messageToCandidateWithTrace(message, hint, categories);

        if (shouldTraceInvoiceMessage(trace)) {
          (invoiceTrace.billMessageTraces as GmailCandidateTrace[]).push(trace);
          logSyncEvent("log", "bill_invoice_message_trace", {
            requestId,
            ...trace,
          });
        }

        if (candidate) {
          candidateResults.push(candidate);
        }
      } catch (error) {
        const failure = normalizeError(error);
        const details = {
          requestId,
          stage: failure.stage,
          code: failure.code,
          message: failure.message,
          ...(failure.details ?? {}),
        };
        messageFailures.push(details);
        logSyncEvent("warn", "message_processing_failed", details);
      }
    }

    if (candidateResults.length === 0 && messageFailures.some((failure) => failure.code === "gmail_rate_limited")) {
      throw new SyncError({
        message: "Gmail is busy right now. Please wait a minute and try again.",
        stage: "gmail_api",
        code: "gmail_rate_limited",
        status: 429,
        details: {
          userId: user.id,
          failedMessages: messageFailures.length,
        },
      });
    }

    if (candidateResults.length === 0 && messageFailures.length === messageIdsByHint.size && messageIdsByHint.size > 0) {
      throw new SyncError({
        message: "Undo could not finish reading Gmail right now.",
        stage: "candidate_processing",
        code: "gmail_all_messages_failed",
        status: 502,
        details: {
          userId: user.id,
          failedMessages: messageFailures.length,
        },
      });
    }

    const deduped = Array.from(
      new Map(candidateResults.map((candidate) => [candidate.sourceMessageId, candidate])).values(),
    ).sort((left, right) => +new Date(left.dueAt) - +new Date(right.dueAt))
      .slice(0, MAX_CANDIDATES_TO_RETURN);
    invoiceTrace.detectedBillCandidateIds = candidateResults
      .filter((candidate) => candidate.category === "bill")
      .map((candidate) => candidate.sourceMessageId);
    invoiceTrace.returnedBillCandidateIds = deduped
      .filter((candidate) => candidate.category === "bill")
      .map((candidate) => candidate.sourceMessageId);
    invoiceTrace.detectedCandidateCount = candidateResults.length;
    invoiceTrace.returnedCandidateCount = deduped.length;
    logSyncEvent("log", "bill_invoice_candidate_trace", invoiceTrace);

    const pendingCandidates = await persistCandidateItems(user.id, deduped, admin, { requestId });
    invoiceTrace.pendingBillCandidateIds = pendingCandidates
      .filter((candidate) => candidate.category === "bill")
      .map((candidate) => candidate.sourceMessageId);

    const { error: updateError } = await admin.from("gmail_connections").update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "synced",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    if (updateError) {
      logSyncEvent("error", "connection_sync_state_update_failed", {
        requestId,
        userId: user.id,
        message: updateError.message,
      });
    }

    logSyncEvent("log", "sync_completed", {
      requestId,
      userId: user.id,
      fetchedMessageCount: messageIdsByHint.size,
      candidateCount: deduped.length,
      pendingCandidateCount: pendingCandidates.length,
      listFailureCount: listFailures.length,
      messageFailureCount: messageFailures.length,
    });
    logBillTraceMarker("BILL_TRACE_END", {
      requestId,
      billQueryCount: (invoiceTrace.billQueries as unknown[]).length,
      selectedBillMessageIds: invoiceTrace.selectedBillMessageIds,
      billMessageTraceCount: (invoiceTrace.billMessageTraces as unknown[]).length,
      detectedBillCandidateIds: invoiceTrace.detectedBillCandidateIds,
      returnedBillCandidateIds: invoiceTrace.returnedBillCandidateIds,
      pendingBillCandidateIds: invoiceTrace.pendingBillCandidateIds,
      responseCandidateCount: pendingCandidates.length,
    });

    return jsonResponse({ candidates: pendingCandidates, billTrace: invoiceTrace });
  } catch (error) {
    const failure = buildFailurePayload(error, { requestId, userId, gmailEmail });
    logSyncEvent("error", "sync_failed", failure);

    try {
      if (userId) {
        const admin = createAdminClient();
        const { error: updateError } = await admin.from("gmail_connections").update({
          last_sync_status: "error",
          last_sync_error: failure.message,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        if (updateError) {
          logSyncEvent("error", "connection_error_state_update_failed", {
            requestId,
            userId,
            message: updateError.message,
          });
        }
      }
    } catch {
      // Keep the original sync error as the primary response.
    }

    return jsonResponse({
      error: failure.message,
      code: failure.code,
      stage: failure.stage,
      status: failure.status,
      stack: failure.stack,
      details: failure.details,
      requestId: failure.requestId,
      userId: failure.userId,
      gmailEmail: failure.gmailEmail,
      timestamp: failure.timestamp,
    }, failure.status);
  }
});
