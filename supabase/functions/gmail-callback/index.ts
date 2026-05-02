import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  exchangeCodeForTokens,
  fetchGmailProfile,
  getGoogleOAuthConfig,
} from "../_shared/google.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { decryptGmailRefreshToken, encryptGmailRefreshToken } from "../_shared/token-crypto.ts";

function redirectTo(path: string, params?: Record<string, string>) {
  const { publicAppUrl } = getGoogleOAuthConfig();
  const url = new URL(path, publicAppUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const oauthState = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");
  const admin = createAdminClient();

  if (googleError) {
    return redirectTo("/onboarding", {
      gmail: "error",
      reason: googleError,
    });
  }

  if (!code || !oauthState) {
    return redirectTo("/onboarding", {
      gmail: "error",
      reason: "missing_code",
    });
  }

  const { data: pendingState, error: pendingError } = await admin
    .from("gmail_tokens")
    .select("user_id, refresh_token, oauth_return_to, oauth_state_expires_at")
    .eq("oauth_state", oauthState)
    .maybeSingle();

  if (pendingError || !pendingState) {
    return redirectTo("/onboarding", {
      gmail: "error",
      reason: "invalid_state",
    });
  }

  const expiresAt = pendingState.oauth_state_expires_at
    ? new Date(String(pendingState.oauth_state_expires_at)).getTime()
    : 0;

  if (!expiresAt || expiresAt < Date.now()) {
    return redirectTo("/onboarding", {
      gmail: "error",
      reason: "expired_state",
    });
  }

  const returnTo = typeof pendingState.oauth_return_to === "string" && pendingState.oauth_return_to.startsWith("/")
    ? pendingState.oauth_return_to
    : "/onboarding";

  try {
    const tokens = await exchangeCodeForTokens(code);
    const accessToken = tokens.access_token;
    const existingRefreshToken = await decryptGmailRefreshToken(
      typeof pendingState.refresh_token === "string" ? pendingState.refresh_token : null,
    );
    const refreshToken = tokens.refresh_token ?? existingRefreshToken;

    if (!accessToken) {
      throw new Error("Google did not return an access token.");
    }

    if (!refreshToken) {
      throw new Error("Google did not return a refresh token.");
    }

    const gmailEmail = await fetchGmailProfile(accessToken);
    const now = new Date();
    const expiresAtIso = tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
      : null;
    const scope = tokens.scope?.split(/\s+/).filter(Boolean) ?? [];

    const { error: connectionError } = await admin.from("gmail_connections").upsert({
      user_id: pendingState.user_id,
      gmail_email: gmailEmail,
      scope,
      connected_at: now.toISOString(),
      last_sync_status: "connected",
      last_sync_error: null,
      updated_at: now.toISOString(),
    });

    if (connectionError) {
      throw new Error(connectionError.message);
    }

    const { error: tokenError } = await admin.from("gmail_tokens").upsert({
      user_id: pendingState.user_id,
      access_token: accessToken,
      refresh_token: await encryptGmailRefreshToken(refreshToken),
      scope,
      token_type: tokens.token_type ?? "Bearer",
      expires_at: expiresAtIso,
      oauth_state: null,
      oauth_state_expires_at: null,
      oauth_return_to: null,
      updated_at: now.toISOString(),
    });

    if (tokenError) {
      throw new Error(tokenError.message);
    }

    const { error: preferenceError } = await admin
      .from("preferences")
      .update({
        gmail_connected: true,
        updated_at: now.toISOString(),
      })
      .eq("user_id", pendingState.user_id);

    if (preferenceError) {
      throw new Error(preferenceError.message);
    }

    return redirectTo(returnTo, { gmail: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "gmail_connect_failed";

    await admin.from("gmail_tokens").update({
      oauth_state: null,
      oauth_state_expires_at: null,
      oauth_return_to: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", pendingState.user_id);

    return redirectTo(returnTo, {
      gmail: "error",
      reason: message,
    });
  }
});
