import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { buildGoogleAuthUrl } from "../_shared/google.ts";
import { corsHeaders, withCorsHeaders } from "../_shared/cors.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";

const ALLOWED_RETURN_PATHS = new Set(["/onboarding", "/settings"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const requestedReturnTo = typeof body?.returnTo === "string" ? body.returnTo : "/onboarding";
    const returnTo = ALLOWED_RETURN_PATHS.has(requestedReturnTo) ? requestedReturnTo : "/onboarding";

    const oauthState = crypto.randomUUID();
    const admin = createAdminClient();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: existingTokenRow, error: existingTokenError } = await admin
      .from("gmail_tokens")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingTokenError) {
      throw new Error(existingTokenError.message);
    }

    if (existingTokenRow) {
      const { error } = await admin.from("gmail_tokens").update({
        oauth_state: oauthState,
        oauth_state_expires_at: expiresAt,
        oauth_return_to: returnTo,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await admin.from("gmail_tokens").insert({
        user_id: user.id,
        oauth_state: oauthState,
        oauth_state_expires_at: expiresAt,
        oauth_return_to: returnTo,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    const url = buildGoogleAuthUrl({
      state: oauthState,
      loginHint: user.email ?? undefined,
    });

    return Response.json({ url }, {
      headers: withCorsHeaders({
        "Content-Type": "application/json",
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start Gmail connection.";
    const status = message === "Unauthorized" ? 401 : 500;

    return Response.json({ error: message }, {
      status,
      headers: withCorsHeaders({
        "Content-Type": "application/json",
      }),
    });
  }
});
