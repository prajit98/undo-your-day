import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, withCorsHeaders } from "../_shared/cors.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: withCorsHeaders({
      "Content-Type": "application/json",
    }),
  });
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const includeTokenLookup = body.includeTokenLookup === true || body.phase === "token";
    const user = await requireUser(req);
    const timestamp = new Date().toISOString();

    if (!includeTokenLookup) {
      return jsonResponse({
        success: true,
        stage: "entered_function",
        code: "gmail_ping_authenticated",
        message: "Gmail ping reached the isolated function and authenticated the user.",
        userId: user.id,
        requestId,
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
        .select("user_id, expires_at, scope")
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
        connectionLookupSucceeded: false,
        tokenLookupSucceeded: false,
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
        connectionLookupSucceeded: true,
        tokenLookupSucceeded: false,
        hasConnectionRow: Boolean(connectionRow),
        timestamp,
      }, 500);
    }

    return jsonResponse({
      success: true,
      stage: "token_lookup",
      code: "gmail_ping_token_lookup_completed",
      message: "Gmail ping authenticated the user and completed connection and token lookup.",
      userId: user.id,
      requestId,
      tokenLookupSkipped: false,
      connectionLookupSucceeded: true,
      tokenLookupSucceeded: true,
      hasConnectionRow: Boolean(connectionRow),
      gmailEmailPresent: typeof connectionRow?.gmail_email === "string" && connectionRow.gmail_email.length > 0,
      connectedAtPresent: typeof connectionRow?.connected_at === "string",
      lastSyncStatus: typeof connectionRow?.last_sync_status === "string" ? connectionRow.last_sync_status : null,
      hasTokenRow: Boolean(tokenRow),
      expiresAtPresent: typeof tokenRow?.expires_at === "string",
      scopeCount: Array.isArray(tokenRow?.scope) ? tokenRow.scope.length : 0,
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
