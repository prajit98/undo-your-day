import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell, Mail, ChevronRight, Sparkles, PlayCircle, ShieldCheck, Check, Lock, LogOut, UserRound,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { Switch } from "@/components/ui/switch";
import { CategoryIconCircle } from "@/components/CategoryBadge";
import { useAuth } from "@/context/AuthContext";
import { usePremium, FREE_ITEM_LIMIT } from "@/context/PremiumContext";
import { useUndo } from "@/context/UndoContext";
import { appConfig } from "@/lib/app-config";
import {
  clearGmailRetryAfter,
  formatGmailSyncError,
  GMAIL_RATE_LIMIT_COOLDOWN_MS,
  getGmailRetryAfter,
  isGmailRateLimitError,
  setGmailRetryAfter,
} from "@/lib/gmail-flow";
import { autoCategories } from "@/lib/onboarding";
import { appRepository, type GmailDiagnosticResult } from "@/lib/persistence";
import { reminderPolicy } from "@/lib/reminders";
import { categoryMeta, Category } from "@/lib/undo-data";
import { toast } from "sonner";

const cats: Category[] = ["trial", "renewal", "return", "bill", "followup"];
const categoryPlural: Record<Category, string> = {
  trial: "Trials",
  renewal: "Renewals",
  return: "Returns",
  bill: "Bills",
  followup: "Follow-ups",
};

type GmailPingResult = Record<string, unknown> & {
  success?: boolean;
  stage?: string;
  message?: string;
};

type GmailPingMode = "auth" | "token" | "refresh" | "list";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fallbackDiagnosticResult(input: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
  stage?: string;
}): GmailDiagnosticResult {
  return {
    diagnostic: true,
    success: false,
    stage: input.stage ?? "frontend",
    code: input.code,
    message: input.message,
    requestId: "local",
    requestCountUsed: 0,
    tokenRefreshSucceeded: false,
    gmailListSucceeded: false,
    gmailMessageFetchSucceeded: false,
    parsingSucceeded: false,
    checks: {
      connected: true,
      tokenLookupSucceeded: false,
      accessTokenResolved: false,
      tokenRefreshAttempted: false,
      tokenRefreshSucceeded: false,
      gmailListSucceeded: false,
      gmailMessageFetchSucceeded: false,
      parsingSucceeded: false,
    },
    details: {
      status: input.status,
      directFetch: true,
      ...(input.details ?? {}),
    },
    timestamp: new Date().toISOString(),
  };
}

function readDiagnosticAccessToken() {
  if (typeof window === "undefined") {
    return { accessToken: undefined, details: { reason: "window_unavailable" } };
  }

  if (!appConfig.supabaseUrl) {
    return { accessToken: undefined, details: { reason: "supabase_url_missing" } };
  }

  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch (error) {
    return {
      accessToken: undefined,
      details: {
        reason: "local_storage_unavailable",
        errorMessage: error instanceof Error ? error.message : "Unknown storage error.",
      },
    };
  }

  let projectRef = "";
  try {
    projectRef = new URL(appConfig.supabaseUrl).hostname.split(".")[0] ?? "";
  } catch (error) {
    return {
      accessToken: undefined,
      details: {
        reason: "supabase_url_invalid",
        errorMessage: error instanceof Error ? error.message : "Invalid Supabase URL.",
      },
    };
  }

  const keyCandidates = new Set<string>();
  if (projectRef) {
    keyCandidates.add(`sb-${projectRef}-auth-token`);
  }

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
      keyCandidates.add(key);
    }
  }

  for (const key of keyCandidates) {
    const raw = storage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as {
        access_token?: string;
        currentSession?: { access_token?: string };
      };
      const accessToken = parsed.access_token ?? parsed.currentSession?.access_token;
      if (accessToken) {
        return {
          accessToken,
          details: {
            tokenStorageKey: key,
            checkedStorageKeyCount: keyCandidates.size,
          },
        };
      }
    } catch {
      // Ignore stale or unrelated Supabase auth entries.
    }
  }

  return {
    accessToken: undefined,
    details: {
      reason: "access_token_not_found",
      checkedStorageKeyCount: keyCandidates.size,
    },
  };
}

async function runDirectGmailDiagnostic() {
  const tokenResult = readDiagnosticAccessToken();
  if (!tokenResult.accessToken) {
    return fallbackDiagnosticResult({
      code: "diagnostic_access_token_missing",
      message: "Undo could not find the current browser access token.",
      details: tokenResult.details,
    });
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${appConfig.supabaseUrl}/functions/v1/gmail-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "diagnostic" }),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text };
      }
    }

    if (isRecord(payload) && payload.diagnostic === true) {
      return payload as unknown as GmailDiagnosticResult;
    }

    return fallbackDiagnosticResult({
      stage: isRecord(payload) && typeof payload.stage === "string" ? payload.stage : "function_response",
      code: isRecord(payload) && typeof payload.code === "string" ? payload.code : "diagnostic_unstructured_response",
      message: isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : response.ok
          ? "Gmail diagnostic returned an unreadable response."
          : "Gmail diagnostic request failed.",
      status: response.status,
      details: {
        ...tokenResult.details,
        responseOk: response.ok,
        rawPayload: payload,
      },
    });
  } catch (error) {
    const aborted = error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError";

    return fallbackDiagnosticResult({
      code: aborted ? "diagnostic_request_timeout" : "diagnostic_direct_fetch_failed",
      message: aborted
        ? "Undo could not finish the Gmail diagnostic in time."
        : "Undo could not run the Gmail diagnostic.",
      details: {
        ...tokenResult.details,
        errorMessage: error instanceof Error ? error.message : "Unknown direct fetch error.",
      },
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function runDirectGmailPing(mode: GmailPingMode = "auth") {
  const tokenResult = readDiagnosticAccessToken();
  if (!tokenResult.accessToken) {
    return {
      success: false,
      stage: "frontend",
      code: "gmail_ping_access_token_missing",
      message: "Undo could not find the current browser access token.",
      requestId: "local",
      details: {
        directFetch: true,
        mode,
        ...tokenResult.details,
      },
      timestamp: new Date().toISOString(),
    } satisfies GmailPingResult;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
  const requestBody = mode === "auth"
    ? {}
    : {
      phase: mode,
      mode,
      includeTokenLookup: mode === "token" || mode === "refresh",
      includeRefresh: mode === "refresh",
      includeList: mode === "list",
    };
  const pingUrl = new URL(`${appConfig.supabaseUrl}/functions/v1/gmail-ping`);
  if (mode !== "auth") {
    pingUrl.searchParams.set("phase", mode);
  }

  try {
    const response = await fetch(pingUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
        "X-Gmail-Ping-Phase": mode,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: unknown = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text };
      }
    }

    if (isRecord(payload)) {
      return {
        ...payload,
        details: {
          ...(isRecord(payload.details) ? payload.details : {}),
          directFetch: true,
          mode,
          requestBody,
          responseOk: response.ok,
          ...tokenResult.details,
        },
      } satisfies GmailPingResult;
    }

    return {
      success: false,
      stage: "function_response",
      code: "gmail_ping_unstructured_response",
      message: "Gmail ping returned an unreadable response.",
      requestId: "local",
      details: {
        directFetch: true,
        mode,
        responseOk: response.ok,
        status: response.status,
        rawPayload: payload,
        ...tokenResult.details,
      },
      timestamp: new Date().toISOString(),
    } satisfies GmailPingResult;
  } catch (error) {
    const aborted = error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError";

    return {
      success: false,
      stage: "frontend",
      code: aborted ? "gmail_ping_timeout" : "gmail_ping_direct_fetch_failed",
      message: aborted
        ? "Undo could not finish Gmail ping in time."
        : "Undo could not run Gmail ping.",
      requestId: "local",
      details: {
        directFetch: true,
        mode,
        errorMessage: error instanceof Error ? error.message : "Unknown ping error.",
        ...tokenResult.details,
      },
      timestamp: new Date().toISOString(),
    } satisfies GmailPingResult;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { isPremium } = usePremium();
  const { active, preferences, onboarding, updatePreferences, gmailConnection, refresh } = useUndo();
  const [scanningGmail, setScanningGmail] = useState(false);
  const [runningGmailDiagnostic, setRunningGmailDiagnostic] = useState(false);
  const [gmailDiagnostic, setGmailDiagnostic] = useState<GmailDiagnosticResult | null>(null);
  const [runningGmailPing, setRunningGmailPing] = useState(false);
  const [gmailPingMode, setGmailPingMode] = useState<GmailPingMode | null>(null);
  const [gmailPing, setGmailPing] = useState<GmailPingResult | null>(null);
  const [gmailActionError, setGmailActionError] = useState<string | null>(null);

  useEffect(() => {
    const gmailStatus = searchParams.get("gmail");
    const reason = searchParams.get("reason");

    if (gmailStatus === "connected") {
      void refresh()
        .then(() => {
          setGmailActionError(null);
          toast.success("Gmail connected. Start the first scan when you're ready.");
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Undo could not refresh Gmail status.";
          toast.error(message);
        })
        .finally(() => {
          navigate("/settings", { replace: true });
        });
      return;
    }

    if (gmailStatus === "error") {
      const message = reason
        ? `Gmail connection did not finish: ${reason.replace(/_/g, " ")}.`
        : "Undo could not finish the Gmail connection.";
      setGmailActionError(message);
      toast.error(message);
      navigate("/settings", { replace: true });
    }
  }, [searchParams, refresh, navigate]);

  if (!preferences) {
    return null;
  }

  const accountName = user?.name?.trim() || user?.email?.trim() || "Signed in";
  const accountMeta = user?.name?.trim() ? user?.email?.trim() ?? null : null;
  const watchedByGmail = onboarding.pickedCategories.length > 0 ? onboarding.pickedCategories : autoCategories;
  const enabledCats = preferences.enabledCategories;
  const hasScannedGmail = Boolean(gmailConnection?.lastSyncedAt) || gmailConnection?.lastSyncStatus === "error";
  const gmailScanLabel = !gmailConnection
    ? "Off"
    : gmailConnection.lastSyncStatus === "error"
      ? "Needs retry"
      : hasScannedGmail
        ? "Connected"
        : "Ready to scan";
  const gmailScanSummary = !gmailConnection
    ? "Connect Gmail so Undo can look for likely trials, renewals, returns, and bills."
    : gmailConnection.lastSyncStatus === "error"
      ? "Connected. The last scan did not finish."
      : hasScannedGmail
        ? `Last checked ${formatSyncTime(gmailConnection.lastSyncedAt)}.`
        : "Connected. First scan not run yet.";
  const gmailActionLabel = !gmailConnection
    ? "Connect Gmail"
    : hasScannedGmail
      ? "Scan Gmail now"
      : "Run first scan";
  const resourceLinks = [
    appConfig.hasSupportEmail ? {
      href: `mailto:${appConfig.supportEmail}`,
      label: "Contact support",
      detail: appConfig.supportEmail,
    } : null,
    appConfig.hasPrivacyPolicyUrl ? {
      href: appConfig.privacyPolicyUrl,
      label: "Privacy policy",
      detail: "See how Undo handles your data.",
    } : null,
    appConfig.hasAccountDeletionUrl ? {
      href: appConfig.accountDeletionUrl,
      label: "Delete account",
      detail: "Open the secure account deletion page.",
    } : null,
  ].filter((link): link is { href: string; label: string; detail: string } => Boolean(link));

  const toggleCategory = async (category: Category, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...enabledCats, category]))
      : enabledCats.filter((entry) => entry !== category);

    await updatePreferences({ enabledCategories: next });
  };

  const disconnectGmail = async () => {
    try {
      await appRepository.gmail.disconnect();
      await refresh();
      setGmailActionError(null);
      setGmailDiagnostic(null);
      setGmailPing(null);
      clearGmailRetryAfter();
      toast.success("Gmail turned off.", {
        duration: 2400,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not turn Gmail off.";
      toast.error(message);
    }
  };

  const connectGmail = async () => {
    try {
      setGmailActionError(null);
      setGmailDiagnostic(null);
      setGmailPing(null);
      clearGmailRetryAfter();
      const url = await appRepository.gmail.getAuthorizationUrl({ returnTo: "/settings" });
      window.location.assign(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not start Gmail connection.";
      setGmailActionError(message);
      toast.error(message);
    }
  };

  const runGmailScan = async () => {
    const retryAfterMs = getGmailRetryAfter();
    if (retryAfterMs > Date.now()) {
      const message = "Gmail is busy right now. Please wait a minute and try again.";
      setGmailActionError(message);
      toast.error(message);
      return;
    }

    setScanningGmail(true);
    setGmailActionError(null);
    setGmailDiagnostic(null);
    setGmailPing(null);

    try {
      const nextCandidates = await appRepository.gmail.syncCandidates();
      clearGmailRetryAfter();
      await refresh();

      if (nextCandidates.length > 0) {
        toast.success("Undo found a few things to review.");
        navigate("/onboarding");
        return;
      }

      toast.success("Nothing to review right now.");
    } catch (error) {
      const isRateLimited = isGmailRateLimitError(error);
      const message = formatGmailSyncError(error);
      if (isRateLimited) {
        setGmailRetryAfter(Date.now() + GMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      await refresh().catch(() => undefined);
      setGmailActionError(message);
      toast.error(message);
    } finally {
      setScanningGmail(false);
    }
  };

  const runGmailDiagnostic = async () => {
    setRunningGmailDiagnostic(true);
    setGmailActionError(null);
    setGmailDiagnostic(null);
    setGmailPing(null);

    try {
      const result = await runDirectGmailDiagnostic();
      setGmailDiagnostic(result);
      if (result.success) {
        toast.success("Gmail diagnostic finished.");
      } else {
        toast.error(`Gmail diagnostic stopped at ${result.stage}.`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown diagnostic error.";
      const result: GmailDiagnosticResult = {
        diagnostic: true,
        success: false,
        stage: "frontend",
        code: "diagnostic_request_failed",
        message: errorMessage,
        requestId: "local",
        requestCountUsed: 0,
        tokenRefreshSucceeded: false,
        gmailListSucceeded: false,
        gmailMessageFetchSucceeded: false,
        parsingSucceeded: false,
        checks: {
          connected: Boolean(gmailConnection),
          tokenLookupSucceeded: false,
          accessTokenResolved: false,
          tokenRefreshAttempted: false,
          tokenRefreshSucceeded: false,
          gmailListSucceeded: false,
          gmailMessageFetchSucceeded: false,
          parsingSucceeded: false,
        },
        details: {
          errorMessage,
          directFetch: true,
        },
        timestamp: new Date().toISOString(),
      };
      setGmailDiagnostic(result);
      setGmailActionError("Undo could not run the Gmail diagnostic right now.");
      toast.error("Undo could not run the Gmail diagnostic right now.");
    } finally {
      setRunningGmailDiagnostic(false);
    }
  };

  const runGmailPing = async (mode: GmailPingMode = "auth") => {
    setRunningGmailPing(true);
    setGmailPingMode(mode);
    setGmailActionError(null);
    setGmailDiagnostic(null);
    setGmailPing(null);

    try {
      const result = await runDirectGmailPing(mode);
      setGmailPing(result);
      if (result.success) {
        toast.success(
          mode === "list"
            ? "Gmail list check finished."
            : mode === "refresh"
            ? "Gmail refresh check finished."
            : mode === "token"
              ? "Gmail token check finished."
              : "Gmail ping reached the isolated function.",
        );
      } else {
        toast.error(`Gmail ping stopped at ${result.stage ?? "unknown"}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not run Gmail ping.";
      setGmailPing({
        success: false,
        stage: "frontend",
        code: "gmail_ping_failed",
        message,
        requestId: "local",
        details: { directFetch: true, mode },
        timestamp: new Date().toISOString(),
      });
      toast.error("Undo could not run Gmail ping.");
    } finally {
      setRunningGmailPing(false);
      setGmailPingMode(null);
    }
  };

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-14">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Preferences
        </p>
        <h1 className="mt-3 font-display text-[38px] leading-[1.04] tracking-snug">Settings</h1>
      </header>

      <div className="mt-6 space-y-5 px-5">
        <section className="rounded-[28px] bg-card/95 p-5 shadow-soft ring-1 ring-border/40">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-foreground/70">
              <UserRound className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{accountName}</p>
              {accountMeta && (
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {accountMeta}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={async () => {
              await signOut();
              toast.success("Signed out.");
              navigate("/auth", { replace: true });
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-[13px] font-medium text-background shadow-soft transition-transform active:scale-[0.99]"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.9} />
            Log out
          </button>
        </section>

        <section className="rounded-[28px] bg-card/95 p-5 shadow-soft ring-1 ring-border/40">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Mail className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Gmail</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {onboarding.gmailConnected
                      ? "Undo stays focused on the categories you picked and keeps review before anything is kept."
                      : "Connect Gmail so Undo can look for likely trials, renewals, returns, and bills."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                  {gmailScanLabel}
                </span>
              </div>

              <div className="mt-3 rounded-2xl bg-surface/70 px-3 py-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Gmail scope
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">
                  {formatCategoryList(watchedByGmail)}
                </p>
              </div>

              <div className="mt-3 rounded-2xl bg-surface/70 px-3 py-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Scan status
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">
                  {gmailScanSummary}
                </p>
                {gmailConnection?.email && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Connected as {gmailConnection.email}.
                  </p>
                )}
              </div>

              {(gmailActionError || gmailConnection?.lastSyncStatus === "error") && (
                <p className="mt-3 rounded-2xl bg-critical-soft/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-critical">
                  {gmailActionError ?? gmailConnection?.lastSyncError ?? "Undo could not scan Gmail right now."}
                </p>
              )}

              {gmailDiagnostic && (
                <div className="mt-3 rounded-2xl bg-surface/70 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Internal diagnostic
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      gmailDiagnostic.success
                        ? "bg-primary-soft text-primary"
                        : "bg-critical-soft text-critical"
                    }`}
                    >
                      {gmailDiagnostic.success ? "Passed" : "Stopped"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">
                    {gmailDiagnostic.message}
                  </p>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-background/70 p-2 text-[10px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(gmailDiagnostic, null, 2)}
                  </pre>
                </div>
              )}

              {gmailPing && (
                <div className="mt-3 rounded-2xl bg-surface/70 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Internal ping
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      gmailPing.success
                        ? "bg-primary-soft text-primary"
                        : "bg-critical-soft text-critical"
                    }`}
                    >
                      {gmailPing.success ? "Reached" : "Stopped"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">
                    {gmailPing.message ?? "Gmail ping returned a response."}
                  </p>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-background/70 p-2 text-[10px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(gmailPing, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => void (gmailConnection ? runGmailScan() : connectGmail())}
            disabled={scanningGmail || runningGmailDiagnostic || runningGmailPing}
            className="mt-4 w-full rounded-full bg-foreground py-3.5 text-[13px] font-medium text-background shadow-soft transition-transform active:scale-[0.99]"
          >
            {scanningGmail ? "Scanning Gmail..." : gmailActionLabel}
          </button>
          {gmailConnection && (
            <>
              <button
                onClick={() => void runGmailDiagnostic()}
                disabled={scanningGmail || runningGmailDiagnostic || runningGmailPing}
                className="mt-3 block w-full text-center text-[12.5px] font-medium text-foreground/75 transition-colors hover:text-foreground disabled:text-muted-foreground"
              >
                {runningGmailDiagnostic ? "Running diagnostic..." : "Run Gmail diagnostic"}
              </button>
              <button
                onClick={() => void runGmailPing()}
                disabled={scanningGmail || runningGmailDiagnostic || runningGmailPing}
                className="mt-3 block w-full text-center text-[12.5px] font-medium text-foreground/75 transition-colors hover:text-foreground disabled:text-muted-foreground"
              >
                {runningGmailPing && gmailPingMode === "auth" ? "Running ping..." : "Run Gmail ping"}
              </button>
              <button
                onClick={() => void runGmailPing("token")}
                disabled={scanningGmail || runningGmailDiagnostic || runningGmailPing}
                className="mt-3 block w-full text-center text-[12.5px] font-medium text-foreground/75 transition-colors hover:text-foreground disabled:text-muted-foreground"
              >
                {runningGmailPing && gmailPingMode === "token" ? "Checking token..." : "Run Gmail token check"}
              </button>
              <button
                onClick={() => void runGmailPing("refresh")}
                disabled={scanningGmail || runningGmailDiagnostic || runningGmailPing}
                className="mt-3 block w-full text-center text-[12.5px] font-medium text-foreground/75 transition-colors hover:text-foreground disabled:text-muted-foreground"
              >
                {runningGmailPing && gmailPingMode === "refresh" ? "Checking refresh..." : "Run Gmail refresh check"}
              </button>
              <button
                onClick={() => void runGmailPing("list")}
                disabled={scanningGmail || runningGmailDiagnostic || runningGmailPing}
                className="mt-3 block w-full text-center text-[12.5px] font-medium text-foreground/75 transition-colors hover:text-foreground disabled:text-muted-foreground"
              >
                {runningGmailPing && gmailPingMode === "list" ? "Checking Gmail list..." : "Run Gmail list check"}
              </button>
              <button
                onClick={() => void disconnectGmail()}
                className="mt-3 block w-full text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Turn off Gmail
              </button>
            </>
          )}
        </section>

        {isPremium ? (
          <section className="rounded-[28px] border border-primary/20 bg-primary-soft/60 p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Undo Premium</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Unlimited protection. Stronger reminders. Richer recap.
                </p>
              </div>
              <Check className="h-4 w-4 text-primary" strokeWidth={2.2} />
            </div>
          </section>
        ) : (
          <section className="w-full rounded-[28px] bg-card/95 p-5 text-left shadow-soft ring-1 ring-border/40">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Undo Free</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Up to 5 active items, with one calm reminder per item.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface/70 px-3 py-2 text-[11px]">
              <span className="text-muted-foreground">Active items</span>
              <span className="tabular-nums font-medium text-foreground">
                {active.length} / {FREE_ITEM_LIMIT}
              </span>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            In-app reminders
          </h2>
          <div className="rounded-[28px] bg-card/95 p-5 shadow-soft ring-1 ring-border/40">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-foreground/70">
                <Bell className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">In-app reminders</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  Undo keeps reminder timing calm and category-aware in the app.
                </p>

                <div className="mt-3 rounded-2xl bg-surface/70 px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Delivery channels
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">
                    Push and email delivery are not live yet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-end justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reminder rhythm
            </h2>
            <span className="text-[10.5px] text-muted-foreground">
              {isPremium ? "Premium" : "Free"}
            </span>
          </div>
          <div className="divide-y divide-border/60 rounded-[28px] bg-card/95 shadow-soft ring-1 ring-border/40">
            {cats.map((category) => {
              const policy = reminderPolicy[category];
              const schedule = isPremium ? policy.premium : policy.free;

              return (
                <div key={category} className="flex items-start gap-3 p-3.5">
                  <CategoryIconCircle category={category} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium leading-tight text-foreground">
                      {categoryMeta[category].label}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                      {policy.principle}
                    </p>
                    <p className="mt-1 text-[10.5px] text-muted-foreground/80">
                      {schedule.cadence}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground">
            {isPremium
              ? "Undo times reminders by category and keeps a last-chance in-app nudge for tighter deadlines."
              : "Undo picks one calm in-app reminder by category. Premium adds earlier nudges and a last-chance reminder when timing gets tight."}
          </p>
        </section>

        <section>
          <div className="mb-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What you want to catch
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Gmail stays focused on Trials, Renewals, Returns, and Bills. Follow-ups stay manual for now.
            </p>
          </div>
          <div className="divide-y divide-border/60 rounded-[28px] bg-card/95 shadow-soft ring-1 ring-border/40">
            {cats.map((category) => (
              <div key={category} className="flex items-center gap-3 p-3">
                <CategoryIconCircle category={category} />
                <span className="flex-1 text-sm font-medium">{categoryMeta[category].label}</span>
                <Switch
                  checked={enabledCats.includes(category)}
                  onCheckedChange={(value) => void toggleCategory(category, value)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] bg-primary-soft p-5 ring-1 ring-primary/10">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-base text-foreground">Undo, calmly</p>
              <p className="mt-1 text-xs text-foreground/70">
                Undo only surfaces reminders when there is still time to fix something. Never just to prove it's paying attention.
              </p>
            </div>
          </div>
        </section>

        <button
          onClick={async () => {
            await onboarding.reset();
            navigate("/onboarding");
          }}
          className="flex w-full items-center gap-3 rounded-[28px] bg-card/95 p-4 text-left shadow-soft ring-1 ring-border/40 transition-all active:scale-[0.99]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground/70">
            <PlayCircle className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Replay the intro</p>
            <p className="text-[11.5px] text-muted-foreground">See how Undo works again, in 30 seconds.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {resourceLinks.length > 0 && (
          <section>
            <div className="mb-2 px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Help & privacy
              </h2>
            </div>
            <div className="divide-y divide-border/60 rounded-[28px] bg-card/95 shadow-soft ring-1 ring-border/40">
              {resourceLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={link.href.startsWith("mailto:") ? undefined : "noreferrer"}
                  className="flex items-center gap-3 p-4 text-left transition-colors hover:bg-surface/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{link.label}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {link.detail}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Undo protects the small things that matter.
        </p>
      </div>
    </MobileShell>
  );
};

function formatCategoryList(categories: Category[]) {
  const labels = categories.map((category) => categoryPlural[category]);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function formatSyncTime(value?: string) {
  if (!value) {
    return "just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default Settings;
