import type { Candidate } from "./candidates";
import { AppFunctionError } from "./persistence";

export const GMAIL_SYNC_RETRY_AFTER_KEY = "undo.gmail.sync-retry-after";
export const GMAIL_REVIEW_CANDIDATES_KEY = "undo.gmail.review-candidates";
export const GMAIL_RATE_LIMIT_COOLDOWN_MS = 60_000;

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

export function stashGmailReviewCandidates(candidates: Candidate[]) {
  if (!hasSessionStorage()) return;
  window.sessionStorage.setItem(GMAIL_REVIEW_CANDIDATES_KEY, JSON.stringify(candidates));
}

export function hasPendingGmailReviewCandidates() {
  if (!hasSessionStorage()) return false;
  return Boolean(window.sessionStorage.getItem(GMAIL_REVIEW_CANDIDATES_KEY));
}

export function takePendingGmailReviewCandidates(): Candidate[] {
  if (!hasSessionStorage()) return [];

  const raw = window.sessionStorage.getItem(GMAIL_REVIEW_CANDIDATES_KEY);
  window.sessionStorage.removeItem(GMAIL_REVIEW_CANDIDATES_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Candidate[] : [];
  } catch {
    return [];
  }
}

export function formatGmailSyncError(error: unknown) {
  if (error instanceof AppFunctionError) {
    if (error.code === "gmail_rate_limited") {
      return "Gmail is busy right now. Please wait a minute and try again.";
    }

    if (error.code === "gmail_not_connected" || error.status === 409) {
      return "Undo needs you to reconnect Gmail before scanning again.";
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Undo could not scan Gmail right now. Please try again.";
}
