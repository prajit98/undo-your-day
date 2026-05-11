import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell, Mail, ChevronRight, ShieldCheck, Check, Lock, LogOut, UserRound,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/context/AuthContext";
import { usePremium, FREE_ITEM_LIMIT } from "@/context/PremiumContext";
import { useUndo } from "@/context/UndoContext";
import { appConfig } from "@/lib/app-config";
import { dedupeObligations } from "@/lib/obligations";
import {
  clearGmailRetryAfter,
  formatGmailSyncError,
  GMAIL_RATE_LIMIT_COOLDOWN_MS,
  getGmailRetryAfter,
  isGmailRateLimitError,
  isGmailReconnectError,
  isGmailReconnectMessage,
  setGmailRetryAfter,
} from "@/lib/gmail-flow";
import { appRepository } from "@/lib/persistence";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { isPremium, showUpgrade } = usePremium();
  const { active, preferences, gmailConnection, refresh } = useUndo();
  const [scanningGmail, setScanningGmail] = useState(false);
  const [gmailActionError, setGmailActionError] = useState<string | null>(null);
  const [skippedSuggestionCount, setSkippedSuggestionCount] = useState(0);

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

  useEffect(() => {
    let cancelled = false;

    if (!gmailConnection) {
      setSkippedSuggestionCount(0);
      return () => {
        cancelled = true;
      };
    }

    appRepository.gmail.listSkippedCandidates()
      .then((candidates) => {
        if (cancelled) return;
        setSkippedSuggestionCount(dedupeObligations(candidates).length);
      })
      .catch(() => {
        if (!cancelled) {
          setSkippedSuggestionCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gmailConnection]);

  if (!preferences) {
    return null;
  }

  const accountName = user?.name?.trim() || user?.email?.trim() || "Signed in";
  const accountMeta = user?.name?.trim() ? user?.email?.trim() ?? null : null;
  const hasScannedGmail = Boolean(gmailConnection?.lastSyncedAt) || gmailConnection?.lastSyncStatus === "error";
  const gmailNeedsReconnect = Boolean(
    gmailConnection
      && (isGmailReconnectMessage(gmailActionError) || isGmailReconnectMessage(gmailConnection.lastSyncError)),
  );
  const gmailScanLabel = !gmailConnection
    ? "Off"
    : gmailNeedsReconnect
      ? "Reconnect"
    : gmailConnection.lastSyncStatus === "error"
      ? "Needs retry"
      : hasScannedGmail
        ? "Connected"
        : "Ready to scan";
  const gmailScanSummary = !gmailConnection
    ? "Not connected."
    : gmailNeedsReconnect
      ? "Your Gmail permission has expired or was removed."
    : gmailConnection.lastSyncStatus === "error"
      ? "Last scan didn't finish."
      : hasScannedGmail
        ? `Last checked ${formatSyncTime(gmailConnection.lastSyncedAt)}.`
        : "First scan not run yet.";
  const gmailActionLabel = !gmailConnection
    ? "Connect Gmail"
    : gmailNeedsReconnect
      ? "Reconnect Gmail"
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

  const disconnectGmail = async () => {
    try {
      await appRepository.gmail.disconnect();
      await refresh();
      setGmailActionError(null);
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

    try {
      const nextCandidates = await appRepository.gmail.syncCandidates();
      clearGmailRetryAfter();
      await refresh();

      if (nextCandidates.length > 0) {
        toast.success("Undo found a few things to review.");
        navigate("/onboarding");
        return;
      }

      toast.success("Gmail is connected. Nothing urgent showed up.");
    } catch (error) {
      const isRateLimited = isGmailRateLimitError(error);
      const needsReconnect = isGmailReconnectError(error);
      const message = formatGmailSyncError(error);
      if (isRateLimited) {
        setGmailRetryAfter(Date.now() + GMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      if (needsReconnect) {
        clearGmailRetryAfter();
      }
      await refresh().catch(() => undefined);
      setGmailActionError(message);
      toast.error(message);
    } finally {
      setScanningGmail(false);
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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Gmail</p>
                  {gmailConnection?.email ? (
                    <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                      {gmailConnection.email}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      Not connected
                    </p>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                  {gmailScanLabel}
                </span>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                {gmailScanSummary}
              </p>

              {skippedSuggestionCount > 0 && (
                <Link
                  to="/settings/skipped-suggestions"
                  className="mt-3 flex items-center justify-between rounded-2xl bg-surface/70 px-3 py-2.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-surface"
                >
                  <span>Skipped suggestions · {skippedSuggestionCount}</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </span>
                </Link>
              )}

              {(gmailActionError || gmailConnection?.lastSyncStatus === "error") && (
                <p className="mt-3 rounded-2xl bg-critical-soft/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-critical">
                  {gmailActionError ?? gmailConnection?.lastSyncError ?? "Undo could not scan Gmail right now."}
                </p>
              )}

            </div>
          </div>

          <button
            onClick={() => void (!gmailConnection || gmailNeedsReconnect ? connectGmail() : runGmailScan())}
            disabled={scanningGmail}
            className="mt-4 w-full rounded-full bg-foreground py-3.5 text-[13px] font-medium text-background shadow-soft transition-transform active:scale-[0.99]"
          >
            {scanningGmail ? "Scanning Gmail..." : gmailActionLabel}
          </button>
          {gmailConnection && (
            <button
              onClick={() => void disconnectGmail()}
              className="mt-3 block w-full text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Turn off Gmail
            </button>
          )}
          <Link
            to="/trust"
            className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            How Undo handles Gmail
          </Link>
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
                  Stronger protection is on.
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
                  5 active items. One reminder each.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface/70 px-3 py-2 text-[11px]">
              <span className="text-muted-foreground">Active items</span>
              <span className="tabular-nums font-medium text-foreground">
                {active.length} / {FREE_ITEM_LIMIT}
              </span>
            </div>
            <button
              onClick={() => showUpgrade("limit")}
              className="mt-3 w-full rounded-full bg-foreground py-3 text-[12.5px] font-medium text-background shadow-soft transition-transform active:scale-[0.99]"
            >
              Upgrade
            </button>
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
                  Undo times reminders by category and deadline.
                </p>

                <p className="mt-2 rounded-2xl bg-surface/70 px-3 py-2 text-[11.5px] text-foreground/75">
                  Push and email reminders are coming later.
                </p>
              </div>
            </div>
          </div>
        </section>

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
      </div>
    </MobileShell>
  );
};


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
