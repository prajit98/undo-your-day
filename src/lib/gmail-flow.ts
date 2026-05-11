export const GMAIL_SYNC_RETRY_AFTER_KEY = "undo.gmail.sync-retry-after";
export const GMAIL_RATE_LIMIT_COOLDOWN_MS = 60_000;
export const GMAIL_RECONNECT_MESSAGE = "Gmail needs to be reconnected.";

function hasSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function getGmailRetryAfter() {
  if (!hasSessionStorage()) return 0;
  return Number(window.sessionStorage.getItem(GMAIL_SYNC_RETRY_AFTER_KEY) ?? "0");
}

export function setGmailRetryAfter(timestampMs: number) {
  if (!hasSessionStorage()) return;
  window.sessionStorage.setItem(GMAIL_SYNC_RETRY_AFTER_KEY, String(timestampMs));
}

export function clearGmailRetryAfter() {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(GMAIL_SYNC_RETRY_AFTER_KEY);
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function errorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : undefined;
}

function isTechnicalRecursionMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("maximum call stack")
    || normalized.includes("call stack size")
    || normalized.includes("too much recursion");
}

export function isGmailRateLimitError(error: unknown) {
  return errorCode(error) === "gmail_rate_limited";
}

export function isGmailReconnectError(error: unknown) {
  const code = errorCode(error);
  const status = errorStatus(error);
  const message = errorMessage(error);

  return code === "gmail_reconnect_required"
    || code === "gmail_refresh_token_missing"
    || code === "gmail_not_connected"
    || status === 409
    || isGmailReconnectMessage(message);
}

export function isGmailReconnectMessage(message: string | null | undefined) {
  if (!message) return false;

  const normalized = message.toLowerCase();
  return normalized.includes("gmail needs to be reconnected")
    || normalized.includes("reconnect gmail")
    || normalized.includes("permission has expired")
    || normalized.includes("expired or revoked")
    || normalized.includes("invalid_grant");
}

export function formatGmailSyncError(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error);

  if (code === "gmail_rate_limited") {
    return "Gmail is busy right now. Please wait a minute and try again.";
  }

  if (isGmailReconnectError(error)) {
    return GMAIL_RECONNECT_MESSAGE;
  }

  if (message && !isTechnicalRecursionMessage(message)) {
    return message;
  }

  return "Undo could not scan Gmail right now. Please try again.";
}
