import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { corsHeaders, withCorsHeaders } from "../_shared/cors.ts";
import { revokeGoogleToken } from "../_shared/google.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { decryptGmailRefreshToken } from "../_shared/token-crypto.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    const admin = createAdminClient();

    const { data: tokenRow, error: tokenError } = await admin
      .from("gmail_tokens")
      .select("refresh_token, access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (tokenError) {
      throw new Error(tokenError.message);
    }

    let refreshTokenToRevoke: string | null = null;
    try {
      refreshTokenToRevoke = await decryptGmailRefreshToken(tokenRow?.refresh_token);
    } catch {
      // Disconnect should still remove local state even if token decryption is unavailable.
    }

    const tokenToRevoke = refreshTokenToRevoke ?? tokenRow?.access_token;
    if (tokenToRevoke) {
      try {
        await revokeGoogleToken(tokenToRevoke);
      } catch {
        // Disconnect should still succeed locally even if Google revocation is delayed.
      }
    }

    const now = new Date().toISOString();
    const [{ error: deleteConnectionError }, { error: deleteTokenError }, { error: preferenceError }] = await Promise.all([
      admin.from("gmail_connections").delete().eq("user_id", user.id),
      admin.from("gmail_tokens").delete().eq("user_id", user.id),
      admin.from("preferences").update({
        gmail_connected: false,
        updated_at: now,
      }).eq("user_id", user.id),
    ]);

    if (deleteConnectionError) throw new Error(deleteConnectionError.message);
    if (deleteTokenError) throw new Error(deleteTokenError.message);
    if (preferenceError) throw new Error(preferenceError.message);

    return Response.json({ ok: true }, {
      headers: withCorsHeaders({
        "Content-Type": "application/json",
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not disconnect Gmail.";
    const status = message === "Unauthorized" ? 401 : 500;

    return Response.json({ error: message }, {
      status,
      headers: withCorsHeaders({
        "Content-Type": "application/json",
      }),
    });
  }
});
