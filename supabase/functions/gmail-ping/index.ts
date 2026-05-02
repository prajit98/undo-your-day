import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, withCorsHeaders } from "../_shared/cors.ts";
import { refreshAccessToken } from "../_shared/google.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";

const GMAIL_LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_LIST_MAX_RESULTS = 2;
const GMAIL_LIST_QUERY = "newer_than:14d";

type PingPhase = "auth" | "token" | "refresh" | "list";
type TokenRow = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  scope?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: withCorsHeaders({
      "Content-Type": "application/json",
    }),
  });
}

function readPingPhase(body: Record<string, unknown>): PingPhase {
  if (body.phase === "list" || body.mode === "list" || body.includeList === true) {
    return "list";
  }

  if (body.phase === "refresh" || body.mode === "refresh" || body.includeRefresh === true) {
    return "refresh";
  }

  if (body.phase === "token" || body.mode === "token" || body.includeTokenLookup === true) {
    return "token";
  }

  return "auth";
}

function readRequestShape(body: Record<string, unknown>) {
  return {
    requestedPhase: typeof body.phase === "string" ? body.phase : null,
    requestedMode: typeof body.mode === "string" ? body.mode : null,
    includeTokenLookup: body.includeTokenLookup === true,
    includeRefresh: body.includeRefresh === true,
    includeList: body.includeList === true,
  };
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const phase = readPingPhase(body);
    const requestShape = readRequestShape(body);
    const user = await requireUser(req);
    const timestamp = new Date().toISOString();

    if (phase === "auth") {
      return jsonResponse({
        success: true,
        stage: "entered_function",
        code: "gmail_ping_authenticated",
        message: "Gmail ping reached the isolated function and authenticated the user.",
        userId: user.id,
        requestId,
        phase,
        requestShape,
        tokenLookupSkipped: true,
        timestamp,
      });
    }

    const admin = createAdminClient();
    const [
      { data: connectionRow, error: connectionError },
      { data: tokenRow, error: tokenError },
    ] = await Promise.all([
      admin
        .from("gmail_connections")
        .select("gmail_email, connected_at, last_sync_status")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("gmail_tokens")
        .select("user_id, access_token, refresh_token, expires_at, scope")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (connectionError) {
      return jsonResponse({
        success: false,
        stage: "connection_lookup",
        code: "gmail_ping_connection_lookup_failed",
        message: connectionError.message,
        userId: user.id,
        requestId,
        phase,
        requestShape,
        connectionLookupSucceeded: false,
        tokenLookupSucceeded: false,
        refreshAttempted: false,
        refreshSucceeded: false,
        timestamp,
      }, 500);
    }

    if (tokenError) {
      return jsonResponse({
        success: false,
        stage: "token_lookup",
        code: "gmail_ping_token_lookup_failed",
        message: tokenError.message,
        userId: user.id,
        requestId,
        phase,
        requestShape,
        connectionLookupSucceeded: true,
        tokenLookupSucceeded: false,
        hasConnectionRow: Boolean(connectionRow),
        refreshAttempted: false,
        refreshSucceeded: false,
        timestamp,
      }, 500);
    }

    const typedTokenRow = tokenRow as TokenRow | null;
    const expiresAtMs = typedTokenRow?.expires_at ? new Date(typedTokenRow.expires_at).getTime() : 0;
    const accessTokenStillFresh = Boolean(
      typedTokenRow?.access_token && expiresAtMs > Date.now() + 60_000,
    );
    const baseTokenPayload = {
      userId: user.id,
      requestId,
      phase,
      requestShape,
      tokenLookupSkipped: false,
      connectionLookupSucceeded: true,
      tokenLookupSucceeded: true,
      hasConnectionRow: Boolean(connectionRow),
      gmailEmailPresent: typeof connectionRow?.gmail_email === "string" && connectionRow.gmail_email.length > 0,
      connectedAtPresent: typeof connectionRow?.connected_at === "string",
      lastSyncStatus: typeof connectionRow?.last_sync_status === "string" ? connectionRow.last_sync_status : null,
      hasTokenRow: Boolean(typedTokenRow),
      accessTokenPresent: typeof typedTokenRow?.access_token === "string" && typedTokenRow.access_token.length > 0,
      refreshTokenPresent: typeof typedTokenRow?.refresh_token === "string" && typedTokenRow.refresh_token.length > 0,
      expiresAtPresent: typeof typedTokenRow?.expires_at === "string",
      accessTokenStillFresh,
      scopeCount: Array.isArray(typedTokenRow?.scope) ? typedTokenRow.scope.length : 0,
    };

    if (phase === "refresh") {
      if (!typedTokenRow) {
        return jsonResponse({
          success: false,
          stage: "token_lookup",
          code: "gmail_ping_token_missing",
          message: "Gmail token row was not found.",
          ...baseTokenPayload,
          refreshAttempted: false,
          refreshSucceeded: false,
          timestamp,
        }, 409);
      }

      if (accessTokenStillFresh) {
        return jsonResponse({
          success: true,
          stage: "token_refresh",
          code: "gmail_ping_refresh_not_needed",
          message: "Gmail access token is still fresh. Refresh was skipped.",
          ...baseTokenPayload,
          refreshAttempted: false,
          refreshSucceeded: false,
          tokenUpdateSucceeded: false,
          timestamp,
        });
      }

      if (!typedTokenRow.refresh_token) {
        return jsonResponse({
          success: false,
          stage: "token_refresh",
          code: "gmail_ping_refresh_token_missing",
          message: "Gmail refresh token is missing.",
          ...baseTokenPayload,
          refreshAttempted: false,
          refreshSucceeded: false,
          tokenUpdateSucceeded: false,
          timestamp,
        }, 409);
      }

      let refreshed;
      try {
        refreshed = await refreshAccessToken(typedTokenRow.refresh_token);
      } catch (error) {
        return jsonResponse({
          success: false,
          stage: "token_refresh",
          code: "gmail_ping_refresh_failed",
          message: error instanceof Error ? error.message : "Could not refresh Gmail access.",
          ...baseTokenPayload,
          refreshAttempted: true,
          refreshSucceeded: false,
          tokenUpdateSucceeded: false,
          timestamp,
        }, 502);
      }

      if (!refreshed.access_token) {
        return jsonResponse({
          success: false,
          stage: "token_refresh",
          code: "gmail_ping_refresh_missing_access_token",
          message: "Google did not return a refreshed access token.",
          ...baseTokenPayload,
          refreshAttempted: true,
          refreshSucceeded: false,
          tokenUpdateSucceeded: false,
          timestamp,
        }, 502);
      }

      const nextExpiresAt = refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : null;
      const { error: updateError } = await admin.from("gmail_tokens").update({
        access_token: refreshed.access_token,
        token_type: refreshed.token_type ?? "Bearer",
        scope: refreshed.scope?.split(/\s+/).filter(Boolean) ?? [],
        expires_at: nextExpiresAt,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      if (updateError) {
        return jsonResponse({
          success: false,
          stage: "token_refresh",
          code: "gmail_ping_token_update_failed",
          message: updateError.message,
          ...baseTokenPayload,
          refreshAttempted: true,
          refreshSucceeded: true,
          tokenUpdateSucceeded: false,
          refreshedExpiresAtPresent: Boolean(nextExpiresAt),
          timestamp,
        }, 500);
      }

      return jsonResponse({
        success: true,
        stage: "token_refresh",
        code: "gmail_ping_refresh_completed",
        message: "Gmail ping refreshed the access token and updated the token row.",
        ...baseTokenPayload,
        refreshAttempted: true,
        refreshSucceeded: true,
        tokenUpdateSucceeded: true,
        refreshedExpiresAtPresent: Boolean(nextExpiresAt),
        refreshedScopeCount: refreshed.scope?.split(/\s+/).filter(Boolean).length ?? 0,
        timestamp,
      });
    }

    if (phase === "list") {
      if (!typedTokenRow) {
        return jsonResponse({
          success: false,
          stage: "token_lookup",
          code: "gmail_ping_token_missing",
          message: "Gmail token row was not found.",
          ...baseTokenPayload,
          refreshAttempted: false,
          refreshSucceeded: false,
          gmailListSucceeded: false,
          listedMessageCount: 0,
          requestCountUsed: 0,
          timestamp,
        }, 409);
      }

      let accessToken = typedTokenRow.access_token ?? "";
      let refreshAttempted = false;
      let refreshSucceeded = false;
      let requestCountUsed = 0;
      let refreshedExpiresAtPresent = false;

      if (!accessTokenStillFresh) {
        if (!typedTokenRow.refresh_token) {
          return jsonResponse({
            success: false,
            stage: "token_refresh",
            code: "gmail_ping_refresh_token_missing",
            message: "Gmail refresh token is missing.",
            ...baseTokenPayload,
            refreshAttempted: false,
            refreshSucceeded: false,
            gmailListSucceeded: false,
            listedMessageCount: 0,
            requestCountUsed,
            timestamp,
          }, 409);
        }

        refreshAttempted = true;
        requestCountUsed += 1;

        let refreshed;
        try {
          refreshed = await refreshAccessToken(typedTokenRow.refresh_token);
        } catch (error) {
          return jsonResponse({
            success: false,
            stage: "token_refresh",
            code: "gmail_ping_refresh_failed",
            message: error instanceof Error ? error.message : "Could not refresh Gmail access.",
            ...baseTokenPayload,
            refreshAttempted,
            refreshSucceeded: false,
            gmailListSucceeded: false,
            listedMessageCount: 0,
            requestCountUsed,
            timestamp,
          }, 502);
        }

        if (!refreshed.access_token) {
          return jsonResponse({
            success: false,
            stage: "token_refresh",
            code: "gmail_ping_refresh_missing_access_token",
            message: "Google did not return a refreshed access token.",
            ...baseTokenPayload,
            refreshAttempted,
            refreshSucceeded: false,
            gmailListSucceeded: false,
            listedMessageCount: 0,
            requestCountUsed,
            timestamp,
          }, 502);
        }

        accessToken = refreshed.access_token;
        refreshSucceeded = true;

        const nextExpiresAt = refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : null;
        refreshedExpiresAtPresent = Boolean(nextExpiresAt);
        const { error: updateError } = await admin.from("gmail_tokens").update({
          access_token: refreshed.access_token,
          token_type: refreshed.token_type ?? "Bearer",
          scope: refreshed.scope?.split(/\s+/).filter(Boolean) ?? [],
          expires_at: nextExpiresAt,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);

        if (updateError) {
          return jsonResponse({
            success: false,
            stage: "token_refresh",
            code: "gmail_ping_token_update_failed",
            message: updateError.message,
            ...baseTokenPayload,
            refreshAttempted,
            refreshSucceeded,
            tokenUpdateSucceeded: false,
            gmailListSucceeded: false,
            listedMessageCount: 0,
            requestCountUsed,
            refreshedExpiresAtPresent,
            timestamp,
          }, 500);
        }
      }

      if (!accessToken) {
        return jsonResponse({
          success: false,
          stage: "token_lookup",
          code: "gmail_ping_access_token_missing",
          message: "Gmail access token was not available for the list check.",
          ...baseTokenPayload,
          refreshAttempted,
          refreshSucceeded,
          gmailListSucceeded: false,
          listedMessageCount: 0,
          requestCountUsed,
          timestamp,
        }, 409);
      }

      const listUrl = new URL(GMAIL_LIST_URL);
      listUrl.searchParams.set("maxResults", String(GMAIL_LIST_MAX_RESULTS));
      listUrl.searchParams.set("q", GMAIL_LIST_QUERY);
      listUrl.searchParams.set("includeSpamTrash", "false");
      requestCountUsed += 1;

      const listResponse = await fetch(listUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const responseText = await listResponse.text();
      let listPayload: Record<string, unknown> = {};

      if (responseText) {
        try {
          listPayload = JSON.parse(responseText) as Record<string, unknown>;
        } catch {
          listPayload = { rawText: responseText.slice(0, 280) };
        }
      }

      if (!listResponse.ok) {
        return jsonResponse({
          success: false,
          stage: "gmail_list",
          code: "gmail_ping_list_failed",
          message: typeof listPayload.error === "string"
            ? listPayload.error
            : "Gmail list request failed.",
          ...baseTokenPayload,
          refreshAttempted,
          refreshSucceeded,
          tokenUpdateSucceeded: refreshAttempted ? refreshSucceeded : false,
          gmailListSucceeded: false,
          listedMessageCount: 0,
          requestCountUsed,
          refreshedExpiresAtPresent,
          details: {
            status: listResponse.status,
            maxResults: GMAIL_LIST_MAX_RESULTS,
            query: GMAIL_LIST_QUERY,
            error: listPayload.error,
          },
          timestamp,
        }, listResponse.status >= 500 ? 502 : 409);
      }

      const messages = Array.isArray(listPayload.messages) ? listPayload.messages : [];
      return jsonResponse({
        success: true,
        stage: "gmail_list",
        code: "gmail_ping_list_completed",
        message: "Gmail ping completed one tiny list query without fetching message bodies.",
        ...baseTokenPayload,
        refreshAttempted,
        refreshSucceeded,
        tokenUpdateSucceeded: refreshAttempted ? refreshSucceeded : false,
        gmailListSucceeded: true,
        listedMessageCount: messages.length,
        requestCountUsed,
        refreshedExpiresAtPresent,
        details: {
          maxResults: GMAIL_LIST_MAX_RESULTS,
          query: GMAIL_LIST_QUERY,
          resultSizeEstimate: typeof listPayload.resultSizeEstimate === "number"
            ? listPayload.resultSizeEstimate
            : null,
          firstMessageIdPresent: messages.some((message) => (
            typeof message === "object" && message !== null && "id" in message
          )),
        },
        timestamp,
      });
    }

    return jsonResponse({
      success: true,
      stage: "token_lookup",
      code: "gmail_ping_token_lookup_completed",
      message: "Gmail ping authenticated the user and completed connection and token lookup.",
      ...baseTokenPayload,
      refreshAttempted: false,
      refreshSucceeded: false,
      timestamp,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail ping failed.";
    return jsonResponse({
      success: false,
      stage: message === "Unauthorized" ? "auth" : "unexpected",
      code: message === "Unauthorized" ? "gmail_ping_unauthorized" : "gmail_ping_failed",
      message,
      requestId,
      timestamp: new Date().toISOString(),
    }, message === "Unauthorized" ? 401 : 500);
  }
});
