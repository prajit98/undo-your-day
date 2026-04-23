import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { buildSearchQueries, messageToCandidate, type Candidate, type GmailCategory, type GmailMessage } from "../_shared/gmail.ts";
import { corsHeaders, withCorsHeaders } from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/google.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";

const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const AUTO_CATEGORIES = new Set(["trial", "renewal", "return", "bill"]);
const GMAIL_FETCH_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_IDS_TO_SCAN = 18;
const MAX_CANDIDATES_TO_RETURN = 6;
const DEFAULT_ENABLED_CATEGORIES = ["trial", "renewal", "return", "bill", "followup"] as const;

type StoredTokenRow = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
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

function normalizeError(error: unknown) {
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
      throw new Error("Gmail took too long to respond.");
    }

    throw error;
  }

  clearTimeout(timeoutId);

  const text = await response.text();
  if (!response.ok) {
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

async function listMessageIds(accessToken: string, q: string, maxResults = 8) {
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

async function ensureAccessToken(userId: string, tokenRow: StoredTokenRow, admin = createAdminClient()) {
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  const stillValid = tokenRow.access_token && expiresAt > Date.now() + 60_000;

  if (stillValid) {
    logSyncEvent("log", "using_stored_access_token", { userId, expiresAt: tokenRow.expires_at });
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) {
    throw new SyncError({
      message: "Reconnect Gmail to keep importing real matches.",
      stage: "token_refresh",
      code: "gmail_refresh_token_missing",
      status: 409,
      details: { userId },
    });
  }

  logSyncEvent("log", "refreshing_access_token", { userId });

  let refreshed;
  try {
    refreshed = await refreshAccessToken(tokenRow.refresh_token);
  } catch (error) {
    throw new SyncError({
      message: error instanceof Error ? error.message : "Could not refresh Gmail access.",
      stage: "token_refresh",
      code: "gmail_refresh_failed",
      status: 502,
      details: { userId },
    });
  }

  if (!refreshed.access_token) {
    throw new SyncError({
      message: "Could not refresh Gmail access.",
      stage: "token_refresh",
      code: "gmail_refresh_missing_access_token",
      status: 502,
      details: { userId },
    });
  }

  const nextExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;

  const { error } = await admin.from("gmail_tokens").update({
    access_token: refreshed.access_token,
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
      details: { userId },
    });
  }

  return refreshed.access_token;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    const admin = createAdminClient();

    const [{ data: connection, error: connectionError }, { data: tokenRow, error: tokenError }] = await Promise.all([
      admin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle(),
      admin.from("gmail_tokens").select("access_token, refresh_token, expires_at").eq("user_id", user.id).maybeSingle(),
    ]);

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

    const preferences = await ensurePreferencesRow(user.id, admin);
    const allowedCategories = (Array.isArray(preferences.enabled_categories) ? preferences.enabled_categories : [])
      .filter((category): category is GmailCategory => AUTO_CATEGORIES.has(String(category)));
    const categories = allowedCategories.length > 0 ? allowedCategories : ["trial", "renewal", "return", "bill"];
    const accessToken = await ensureAccessToken(user.id, tokenRow as StoredTokenRow, admin);
    const searchQueries = buildSearchQueries(categories);

    logSyncEvent("log", "starting_sync", {
      userId: user.id,
      gmailEmail: connection.gmail_email,
      categories,
      searchQueryCount: searchQueries.length,
    });

    const listedMessages = await Promise.allSettled(
      searchQueries.map(async ({ category, q }) => ({
        category,
        q,
        ids: await listMessageIds(accessToken, q),
      })),
    );

    const messageIdsByHint = new Map<string, GmailCategory>();
    const listFailures: Array<Record<string, unknown>> = [];

    for (const result of listedMessages) {
      if (result.status === "rejected") {
        const failure = normalizeError(result.reason);
        const details = {
          stage: failure.stage,
          code: failure.code,
          message: failure.message,
          ...(failure.details ?? {}),
        };
        listFailures.push(details);
        logSyncEvent("warn", "list_query_failed", details);
        continue;
      }

      const { category, q, ids } = result.value;
      logSyncEvent("log", "list_query_succeeded", { category, query: q, count: ids.length });
      ids.forEach((id) => {
        if (!messageIdsByHint.has(id) && messageIdsByHint.size < MAX_MESSAGE_IDS_TO_SCAN) {
          messageIdsByHint.set(id, category);
        }
      });

      if (messageIdsByHint.size >= MAX_MESSAGE_IDS_TO_SCAN) {
        break;
      }
    }

    if (messageIdsByHint.size === 0 && listFailures.length === listedMessages.length && listedMessages.length > 0) {
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

    const candidateSettled = await Promise.allSettled(
      Array.from(messageIdsByHint.entries()).map(async ([messageId, hint]) => {
        const message = await getMessage(accessToken, messageId);
        return {
          messageId,
          hint,
          candidate: messageToCandidate(message, hint, categories),
        };
      }),
    );

    const messageFailures: Array<Record<string, unknown>> = [];
    const candidateResults: Candidate[] = [];

    for (const result of candidateSettled) {
      if (result.status === "rejected") {
        const failure = normalizeError(result.reason);
        const details = {
          stage: failure.stage,
          code: failure.code,
          message: failure.message,
          ...(failure.details ?? {}),
        };
        messageFailures.push(details);
        logSyncEvent("warn", "message_processing_failed", details);
        continue;
      }

      if (result.value.candidate) {
        candidateResults.push(result.value.candidate);
      }
    }

    if (candidateResults.length === 0 && messageFailures.length === candidateSettled.length && candidateSettled.length > 0) {
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
      new Map(candidateResults.map((candidate) => [candidate.id, candidate])).values(),
    ).sort((left, right) => +new Date(left.dueAt) - +new Date(right.dueAt))
      .slice(0, MAX_CANDIDATES_TO_RETURN);

    const { error: updateError } = await admin.from("gmail_connections").update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "synced",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    if (updateError) {
      logSyncEvent("error", "connection_sync_state_update_failed", {
        userId: user.id,
        message: updateError.message,
      });
    }

    logSyncEvent("log", "sync_completed", {
      userId: user.id,
      fetchedMessageCount: messageIdsByHint.size,
      candidateCount: deduped.length,
      listFailureCount: listFailures.length,
      messageFailureCount: messageFailures.length,
    });

    return jsonResponse({ candidates: deduped });
  } catch (error) {
    const failure = normalizeError(error);
    logSyncEvent("error", "sync_failed", {
      stage: failure.stage,
      code: failure.code,
      status: failure.status,
      message: failure.message,
      ...(failure.details ?? {}),
    });

    try {
      const user = await requireUser(req);
      const admin = createAdminClient();
      const { error: updateError } = await admin.from("gmail_connections").update({
        last_sync_status: "error",
        last_sync_error: failure.message,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      if (updateError) {
        logSyncEvent("error", "connection_error_state_update_failed", {
          userId: user.id,
          message: updateError.message,
        });
      }
    } catch {
      // Keep the original sync error as the primary response.
    }

    return jsonResponse({
      error: failure.message,
      code: failure.code,
      stage: failure.stage,
      details: failure.details,
    }, failure.status);
  }
});
