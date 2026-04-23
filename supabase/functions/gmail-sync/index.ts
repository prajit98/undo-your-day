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

type StoredTokenRow = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: withCorsHeaders({
      "Content-Type": "application/json",
    }),
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
    throw new Error(text || "Gmail request failed.");
  }

  return JSON.parse(text) as T;
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
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) {
    throw new Error("Reconnect Gmail to keep importing real matches.");
  }

  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  if (!refreshed.access_token) {
    throw new Error("Could not refresh Gmail access.");
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
    throw new Error(error.message);
  }

  return refreshed.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    const admin = createAdminClient();

    const [{ data: connection, error: connectionError }, { data: tokenRow, error: tokenError }, { data: preferences, error: preferenceError }] = await Promise.all([
      admin.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle(),
      admin.from("gmail_tokens").select("access_token, refresh_token, expires_at").eq("user_id", user.id).maybeSingle(),
      admin.from("preferences").select("enabled_categories").eq("user_id", user.id).single(),
    ]);

    if (connectionError) throw new Error(connectionError.message);
    if (tokenError) throw new Error(tokenError.message);
    if (preferenceError) throw new Error(preferenceError.message);

    if (!connection || !tokenRow) {
      return jsonResponse({ error: "Connect Gmail first." }, 409);
    }

    const allowedCategories = (Array.isArray(preferences.enabled_categories) ? preferences.enabled_categories : [])
      .filter((category): category is GmailCategory => AUTO_CATEGORIES.has(String(category)));
    const categories = allowedCategories.length > 0 ? allowedCategories : ["trial", "renewal", "return", "bill"];
    const accessToken = await ensureAccessToken(user.id, tokenRow as StoredTokenRow, admin);
    const searchQueries = buildSearchQueries(categories);

    const listedMessages = await Promise.all(
      searchQueries.map(async ({ category, q }) => ({
        category,
        ids: await listMessageIds(accessToken, q),
      })),
    );

    const messageIdsByHint = new Map<string, GmailCategory>();
    for (const { category, ids } of listedMessages) {
      ids.forEach((id) => {
        if (!messageIdsByHint.has(id) && messageIdsByHint.size < MAX_MESSAGE_IDS_TO_SCAN) {
          messageIdsByHint.set(id, category);
        }
      });

      if (messageIdsByHint.size >= MAX_MESSAGE_IDS_TO_SCAN) {
        break;
      }
    }

    const candidateResults = (await Promise.all(
      Array.from(messageIdsByHint.entries()).map(async ([messageId, hint]) => {
        const message = await getMessage(accessToken, messageId);
        return messageToCandidate(message, hint, categories);
      }),
    )).filter((candidate): candidate is Candidate => Boolean(candidate));

    const deduped = Array.from(
      new Map(candidateResults.map((candidate) => [candidate.id, candidate])).values(),
    ).sort((left, right) => +new Date(left.dueAt) - +new Date(right.dueAt))
      .slice(0, MAX_CANDIDATES_TO_RETURN);

    await admin.from("gmail_connections").update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "synced",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    return jsonResponse({ candidates: deduped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not scan Gmail right now.";
    const status = message === "Unauthorized" ? 401 : 500;

    try {
      const user = await requireUser(req);
      const admin = createAdminClient();
      await admin.from("gmail_connections").update({
        last_sync_status: "error",
        last_sync_error: message,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    } catch {
      // Keep the original sync error as the primary response.
    }

    return jsonResponse({ error: message }, status);
  }
});
