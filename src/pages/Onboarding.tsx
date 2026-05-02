import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles, RefreshCw, PackageOpen, Receipt, Check, ChevronLeft,
  ShieldCheck, Eye, Mail, Pencil, X, ArrowRight, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Category, categoryMeta } from "@/lib/undo-data";
import { autoCategories } from "@/lib/onboarding";
import { Candidate, CandidatePatch, candidateToItem } from "@/lib/candidates";
import { useUndo } from "@/context/UndoContext";
import { usePremium } from "@/context/PremiumContext";
import { CategoryBadge } from "@/components/CategoryBadge";
import { shortDue } from "@/lib/urgency";
import { appRepository } from "@/lib/persistence";
import {
  clearGmailRetryAfter,
  formatGmailSyncError,
  GMAIL_RATE_LIMIT_COOLDOWN_MS,
  getGmailRetryAfter,
  isGmailRateLimitError,
  setGmailRetryAfter,
} from "@/lib/gmail-flow";
import { toast } from "sonner";

type Step = "categories" | "permission" | "connected" | "scanning" | "review";

const catIcon: Record<Category, typeof Sparkles> = {
  trial: Sparkles,
  renewal: RefreshCw,
  return: PackageOpen,
  bill: Receipt,
  followup: Sparkles,
};

const catTagline: Record<Category, string> = {
  trial: "before they convert",
  renewal: "before they hit",
  return: "before the window closes",
  bill: "before late fees",
  followup: "",
};

const categoryPlural: Record<Category, string> = {
  trial: "Trials",
  renewal: "Renewals",
  return: "Returns",
  bill: "Bills",
  followup: "Follow-ups",
};

function formatCategoryList(categories: Category[]) {
  const labels = categories.map((category) => categoryPlural[category]);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function toDateInputValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateInputToIso(value: string, fallbackIso: string) {
  if (!value) return fallbackIso;
  const date = new Date(`${value}T17:00:00`);
  return Number.isNaN(date.getTime()) ? fallbackIso : date.toISOString();
}

function amountInputValue(candidate: Candidate) {
  if (typeof candidate.amountValue === "number") {
    return String(candidate.amountValue);
  }
  return candidate.amount?.replace(/[^0-9.]/g, "") ?? "";
}

function parseAmountInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[^0-9.]/g, "");
  if (!/\d/.test(normalized)) return undefined;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem, onboarding, refresh, gmailConnection } = useUndo();
  const { isPremium, availableActiveSlots, canCreateActiveItems, showUpgrade } = usePremium();
  const [step, setStep] = useState<Step>("categories");
  const [picked, setPicked] = useState<Category[]>(onboarding.pickedCategories);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(() => onboarding.isComplete);
  const [connecting, setConnecting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setPicked(onboarding.pickedCategories);
  }, [onboarding.pickedCategories]);

  useEffect(() => {
    if (!onboarding.isComplete && !gmailConnection) {
      return;
    }

    let cancelled = false;
    setLoadingCandidates(true);

    appRepository.gmail.listPendingCandidates()
      .then((pendingCandidates) => {
        if (cancelled) return;

        if (pendingCandidates.length > 0) {
          setCandidates(pendingCandidates);
          setDismissed(new Set());
          setSyncError(null);
          setStep("review");
          return;
        }

        if (onboarding.isComplete) {
          navigate("/app", { replace: true });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message = formatGmailSyncError(error);
        setSyncError(message);
        if (onboarding.isComplete) {
          toast.error(message);
          navigate("/app", { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCandidates(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gmailConnection, navigate, onboarding.isComplete]);

  useEffect(() => {
    const gmailStatus = searchParams.get("gmail");
    const reason = searchParams.get("reason");
    if (gmailStatus === "connected") {
      setConnecting(false);
      setSyncError(null);
      setStep("connected");
      navigate("/onboarding", { replace: true });
      return;
    }

    if (gmailStatus === "error") {
      clearGmailRetryAfter();
      const message = reason
        ? `Gmail connection did not finish: ${reason.replace(/_/g, " ")}.`
        : "Undo could not finish the Gmail connection.";
      setConnecting(false);
      setSyncError(message);
      toast.error(message);
      setStep("permission");
      navigate("/onboarding", { replace: true });
    }
  }, [searchParams, navigate]);

  const skipGmail = async () => {
    await onboarding.savePrefs(picked);
    await onboarding.complete();
    navigate("/app");
  };

  const connectGmail = async () => {
    setConnecting(true);
    setSyncError(null);
    try {
      await onboarding.savePrefs(picked);
      clearGmailRetryAfter();
      const url = await appRepository.gmail.getAuthorizationUrl({ returnTo: "/onboarding" });
      window.location.assign(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not start the Gmail connection.";
      toast.error(message);
      setSyncError(message);
      setConnecting(false);
    }
  };

  const startFirstScan = async () => {
    const retryAfterMs = getGmailRetryAfter();

    if (retryAfterMs > Date.now()) {
      const message = "Gmail is busy right now. Please wait a minute and try again.";
      setSyncError(message);
      toast.error(message);
      return;
    }

    setStep("scanning");
    setSyncError(null);
    try {
      await refresh();
      const nextCandidates = await appRepository.gmail.syncCandidates();
      clearGmailRetryAfter();
      await refresh();
      setCandidates(nextCandidates);
      setDismissed(new Set());
      setStep("review");
      navigate("/onboarding", { replace: true });
    } catch (error) {
      const isRateLimited = isGmailRateLimitError(error);
      const message = formatGmailSyncError(error);
      console.error("[Undo Gmail] first scan failed", error);
      if (isRateLimited) {
        setGmailRetryAfter(Date.now() + GMAIL_RATE_LIMIT_COOLDOWN_MS);
      }
      await refresh().catch(() => undefined);
      setSyncError(message);
      toast.error(message);
      setStep("connected");
    }
  };

  const keepCandidate = async (candidate: Candidate) => {
    if (!canCreateActiveItems()) {
      return false;
    }

    await addItem(candidateToItem(candidate));
    await appRepository.gmail.updateCandidateStatus(candidate.id, "kept");
    return true;
  };

  const saveCandidateEdit = async (candidateId: string, patch: CandidatePatch) => {
    const updated = await appRepository.gmail.updateCandidate(candidateId, patch);
    setCandidates((current) => current.map((candidate) => (
      candidate.id === candidateId ? updated : candidate
    )));
    return updated;
  };

  const keepAllCandidates = async (items: Candidate[]) => {
    if (items.length === 0) {
      return { keptCount: 0, completed: false };
    }

    if (isPremium || items.length <= availableActiveSlots) {
      for (const candidate of items) {
        await addItem(candidateToItem(candidate));
        await appRepository.gmail.updateCandidateStatus(candidate.id, "kept");
      }
      await onboarding.savePrefs(picked);
      await onboarding.complete();
      await onboarding.markFirstCapture();
      toast.success("Only what you kept is on your feed now.", {
        description: `Undo is now watching ${items.length} item${items.length === 1 ? "" : "s"}.`,
        duration: 3200,
      });
      navigate("/app");
      return { keptCount: items.length, completed: true };
    }

    if (availableActiveSlots <= 0) {
      showUpgrade("limit");
      return { keptCount: 0, completed: false };
    }

    for (const candidate of items.slice(0, availableActiveSlots)) {
      await addItem(candidateToItem(candidate));
      await appRepository.gmail.updateCandidateStatus(candidate.id, "kept");
    }
    showUpgrade("limit");

    return { keptCount: availableActiveSlots, completed: false };
  };

  const dismissCandidate = async (id: string) => {
    try {
      await appRepository.gmail.updateCandidateStatus(id, "dismissed");
      setDismissed((current) => new Set(current).add(id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not dismiss this suggestion.";
      toast.error(message);
    }
  };

  const dismissRemainingCandidates = async (remainingIds: string[]) => {
    await Promise.all(
      remainingIds.map((id) => appRepository.gmail.updateCandidateStatus(id, "dismissed")),
    );
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[55vh] opacity-60"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, hsl(var(--primary) / 0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col">
        {loadingCandidates && onboarding.isComplete && (
          <OpeningReviewStep />
        )}

        {!loadingCandidates && step === "categories" && (
          <CategoryStep
            picked={picked}
            onToggle={(category) =>
              setPicked((current) => (
                current.includes(category)
                  ? current.filter((entry) => entry !== category)
                  : [...current, category]
              ))
            }
            onContinue={() => setStep(gmailConnection ? "connected" : "permission")}
          />
        )}

        {!loadingCandidates && step === "permission" && (
          <PermissionStep
            picked={picked}
            isConnected={Boolean(gmailConnection)}
            isConnecting={connecting}
            syncError={syncError}
            onConnect={() => void connectGmail()}
            onSkip={() => void skipGmail()}
            onBack={() => setStep("categories")}
          />
        )}

        {!loadingCandidates && step === "scanning" && (
          <ScanningStep picked={picked} />
        )}

        {!loadingCandidates && step === "connected" && (
          <ConnectedStep
            picked={picked}
            syncError={syncError}
            onStartScan={() => void startFirstScan()}
            onSkip={() => void skipGmail()}
            onBack={() => setStep("permission")}
          />
        )}

        {!loadingCandidates && step === "review" && (
          <ReviewStep
            candidates={candidates.filter((candidate) => !dismissed.has(candidate.id))}
            onDismiss={dismissCandidate}
            onEdit={saveCandidateEdit}
            onKeepAll={keepAllCandidates}
            onKeep={keepCandidate}
            onFinish={async (keptCount, remainingIds) => {
              try {
                await dismissRemainingCandidates(remainingIds);
              } catch {
                toast.error("Undo could not clear the remaining suggestions. Please try again.");
                return;
              }
              await onboarding.savePrefs(picked);
              await onboarding.complete();
              if (keptCount > 0) {
                await onboarding.markFirstCapture();
              }
              toast.success(
                keptCount > 0
                  ? "Undo is now protecting the items you kept."
                  : "All clear for now. Undo will stay ready.",
                { duration: 3000 },
              );
              navigate("/app");
            }}
            onEmptyManual={async () => {
              await onboarding.savePrefs(picked);
              await onboarding.complete();
              navigate("/add");
            }}
          />
        )}
      </div>
    </div>
  );
};

function OpeningReviewStep() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-soft text-primary shadow-soft">
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h1 className="mt-8 max-w-[13ch] font-display text-[30px] leading-[1.08] tracking-snug text-foreground text-balance">
        Opening your review.
      </h1>
      <p className="mt-3 max-w-[18rem] text-[13px] leading-relaxed text-muted-foreground text-balance">
        Undo is checking for saved Gmail suggestions first.
      </p>
      <div className="mt-7 h-[2px] w-32 overflow-hidden rounded-full bg-surface">
        <div className="shimmer h-full w-full rounded-full" />
      </div>
    </div>
  );
}

function CategoryStep({
  picked, onToggle, onContinue,
}: {
  picked: Category[];
  onToggle: (category: Category) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      <header className="px-6 pt-16">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Welcome to Undo
        </p>
        <h1 className="mt-5 max-w-[12ch] font-display text-[40px] leading-[1.03] tracking-snug text-foreground text-balance">
          What should Undo help you{" "}
          <em className="text-primary not-italic italic">catch?</em>
        </h1>
        <p className="mt-3 max-w-[30rem] text-[14px] leading-relaxed text-muted-foreground text-balance">
          Pick the kinds of things that are easiest to miss.
        </p>
      </header>

      <main className="flex-1 px-6 pt-8">
        <div className="space-y-3">
          {autoCategories.map((category, index) => {
            const Icon = catIcon[category];
            const meta = categoryMeta[category];
            const active = picked.includes(category);
            return (
              <button
                key={category}
                onClick={() => onToggle(category)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] animate-fade-up-soft",
                  active
                    ? "border-primary/30 bg-card shadow-card"
                    : "border-border bg-card/55 hover:bg-card/75",
                )}
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                    active ? "bg-primary-soft text-primary" : "bg-surface text-muted-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </span>
                <div className="flex-1">
                  <p className={cn("text-[15px] font-medium", active ? "text-foreground" : "text-foreground/80")}>
                    {categoryPlural[category]}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {catTagline[category]}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border transition-all",
                    active ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                  )}
                >
                  {active && <Check className="h-3 w-3" strokeWidth={2.4} />}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="px-6 pb-10 pt-6">
        <button
          onClick={onContinue}
          disabled={picked.length === 0}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99] disabled:opacity-40"
        >
          Continue
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </button>
      </footer>
    </div>
  );
}

function PermissionStep({
  picked, isConnected, isConnecting, syncError, onConnect, onSkip, onBack,
}: {
  picked: Category[];
  isConnected: boolean;
  isConnecting: boolean;
  syncError: string | null;
  onConnect: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onBack: () => void;
}) {
  const scopedCategories = formatCategoryList(picked).toLowerCase();
  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      <header className="flex items-center justify-between px-5 pt-10">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground/70 shadow-soft transition-colors hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground shadow-soft">
          <Lock className="h-2.5 w-2.5" strokeWidth={2} />
          You review first
        </span>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-7 pt-12">
        <h1 className="max-w-[13ch] font-display text-[34px] leading-[1.05] tracking-snug text-foreground text-balance">
          Let Undo catch the small things you still have time to fix.
        </h1>
        <p className="mt-4 max-w-[31rem] text-[14px] leading-relaxed text-muted-foreground text-balance">
          Undo only checks Gmail for likely {scopedCategories}. You review everything before anything is kept.
        </p>

        <div className="mt-9 space-y-3">
          <InfoCard
            icon={Eye}
            title="What Undo looks for"
            tone="neutral"
            bullets={[
              `Likely ${scopedCategories}`,
              "Dates, amounts, and time windows tied to those",
              "Nothing broader",
            ]}
          />
          <InfoCard
            icon={ShieldCheck}
            title="What happens next"
            tone="primary"
            bullets={[
              "You review everything first",
              "Keep, edit, or dismiss in a tap",
              "Nothing is kept without you",
            ]}
          />
        </div>

        {syncError && (
          <p className="mt-5 rounded-2xl bg-critical-soft/70 px-4 py-3 text-[12px] leading-relaxed text-critical">
            {syncError}
          </p>
        )}
      </main>

      <footer className="px-7 pb-10 pt-8">
        <button
          onClick={() => void onConnect()}
          disabled={isConnecting}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99]"
        >
          <Mail className="h-4 w-4" strokeWidth={1.9} />
          {isConnecting ? "Opening Gmail..." : isConnected ? "Reconnect Gmail" : "Connect Gmail"}
        </button>
        <button
          onClick={() => void onSkip()}
          className="mt-4 block w-full text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Maybe later. I&apos;ll add items myself.
        </button>
      </footer>
    </div>
  );
}

function ConnectedStep({
  picked, syncError, onStartScan, onSkip, onBack,
}: {
  picked: Category[];
  syncError: string | null;
  onStartScan: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onBack: () => void;
}) {
  const scopedCategories = formatCategoryList(picked).toLowerCase();

  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      <header className="flex items-center justify-between px-5 pt-10">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground/70 shadow-soft transition-colors hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[10.5px] font-medium text-primary shadow-soft">
          <Check className="h-3 w-3" strokeWidth={2.3} />
          Gmail connected
        </span>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-7 pt-12">
        <h1 className="max-w-[12ch] font-display text-[34px] leading-[1.05] tracking-snug text-foreground text-balance">
          Gmail connected.
        </h1>
        <p className="mt-4 max-w-[31rem] text-[14px] leading-relaxed text-muted-foreground text-balance">
          Undo can now do a first pass for likely {scopedCategories}. You review everything before anything is kept.
        </p>

        <div className="mt-9 space-y-3">
          <InfoCard
            icon={Mail}
            title="What the first scan does"
            tone="neutral"
            bullets={[
              `Checks Gmail for likely ${scopedCategories}`,
              "Pulls out dates, amounts, and time windows",
              "Brings everything into review first",
            ]}
          />
          <InfoCard
            icon={ShieldCheck}
            title="What happens after that"
            tone="primary"
            bullets={[
              "Keep what matters",
              "Dismiss anything that does not belong",
              "Nothing goes straight to the feed",
            ]}
          />
        </div>

        {syncError && (
          <p className="mt-5 rounded-2xl bg-critical-soft/70 px-4 py-3 text-[12px] leading-relaxed text-critical">
            {syncError}
          </p>
        )}
      </main>

      <footer className="px-7 pb-10 pt-8">
        <button
          onClick={() => void onStartScan()}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99]"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.9} />
          Start first scan
        </button>
        <button
          onClick={() => void onSkip()}
          className="mt-4 block w-full text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Do this later
        </button>
      </footer>
    </div>
  );
}

function InfoCard({
  icon: Icon, title, bullets, tone = "neutral",
}: {
  icon: typeof Eye;
  title: string;
  bullets: string[];
  tone?: "neutral" | "primary";
}) {
  const isPrimary = tone === "primary";
  return (
    <div
      className={cn(
        "rounded-[28px] p-5 shadow-card transition-colors",
        isPrimary
          ? "bg-primary-soft/70 ring-1 ring-primary/15"
          : "bg-card/95 ring-1 ring-border/50",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            isPrimary ? "bg-card text-primary" : "bg-surface text-foreground/70",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <p className="text-[13px] font-semibold tracking-tight text-foreground">{title}</p>
      </div>
      <ul className="mt-3.5 space-y-2.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/75">
            <span
              className={cn(
                "mt-[7px] h-1 w-1 shrink-0 rounded-full",
                isPrimary ? "bg-primary/70" : "bg-muted-foreground/60",
              )}
            />
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SCAN_MESSAGES = [
  "Checking Gmail for likely trial end dates",
  "Looking for renewal, return, and bill deadlines",
  "Pulling out dates, amounts, and time windows",
  "Keeping everything in review before the feed",
];

function ScanningStep({ picked }: { picked: Category[] }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const cycle = setInterval(() => {
      setMessageIndex((current) => (current + 1) % SCAN_MESSAGES.length);
    }, 1700);
    return () => {
      clearInterval(cycle);
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center animate-fade-in">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-primary/8 animate-soft-pulse"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="absolute inline-flex h-28 w-28 rounded-full bg-primary/12 animate-soft-pulse"
          style={{ animationDelay: "0.5s" }}
        />
        <span
          className="absolute inline-flex h-20 w-20 rounded-full bg-primary/18 animate-soft-pulse"
          style={{ animationDelay: "1s" }}
        />
        <span
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-primary-foreground shadow-glow animate-breathe"
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.7} />
        </span>
      </div>

      <h1 className="mt-12 max-w-[13ch] font-display text-[30px] leading-[1.08] tracking-snug text-foreground text-balance">
        Undo is checking for things still worth catching.
      </h1>
      <p className="mt-3 max-w-[18rem] text-[13px] leading-relaxed text-muted-foreground text-balance">
        Only the categories you picked. Review still comes first.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex rounded-full bg-card px-3 py-1 text-[10.5px] font-medium text-muted-foreground shadow-soft">
          Only what you picked
        </span>
        <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-[10.5px] font-medium text-primary shadow-soft">
          You review first
        </span>
      </div>

      <p className="mt-4 text-[11.5px] uppercase tracking-[0.16em] text-muted-foreground">
        Checking {formatCategoryList(picked).toLowerCase()}
      </p>

      <div className="mt-8 flex h-6 items-center justify-center">
        <p
          key={messageIndex}
          className="text-[12.5px] font-medium tracking-[0.01em] text-foreground/70 animate-fade-up-soft"
        >
          {SCAN_MESSAGES[messageIndex]}
        </p>
      </div>

      <div className="mt-7 h-[2px] w-36 overflow-hidden rounded-full bg-surface">
        <div className="shimmer h-full w-full rounded-full" />
      </div>
    </div>
  );
}

function ReviewStep({
  candidates, onDismiss, onEdit, onKeep, onKeepAll, onFinish, onEmptyManual,
}: {
  candidates: Candidate[];
  onDismiss: (id: string) => void | Promise<void>;
  onEdit: (id: string, patch: CandidatePatch) => Promise<Candidate>;
  onKeep: (candidate: Candidate) => Promise<boolean>;
  onKeepAll: (items: Candidate[]) => Promise<{ keptCount: number; completed: boolean }>;
  onFinish: (keptCount: number, remainingIds: string[]) => Promise<void>;
  onEmptyManual: () => Promise<void>;
}) {
  const [kept, setKept] = useState<Set<string>>(new Set());

  const remaining = useMemo(() => candidates.filter((candidate) => !kept.has(candidate.id)), [candidates, kept]);
  const anyKept = kept.size > 0;
  const totalAtRisk = useMemo(
    () => remaining.reduce((sum, candidate) => sum + (candidate.amountValue ?? 0), 0),
    [remaining],
  );

  if (candidates.length === 0) {
    return <EmptyMatches onManual={onEmptyManual} onSkip={() => onFinish(0, [])} />;
  }

  return (
    <div className="flex flex-1 flex-col pb-32 animate-fade-in">
      <header className="px-6 pt-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary">
          Gmail
        </p>
        <h1 className="mt-3 max-w-[14ch] font-display text-[34px] leading-[1.05] tracking-snug text-foreground text-balance">
          Undo surfaced a few things still worth catching.
        </h1>
        <p className="mt-3 max-w-[31rem] text-[13.5px] leading-relaxed text-muted-foreground text-balance">
          Keep what matters. Nothing is kept automatically.
        </p>

        <div className="mt-5 flex items-center justify-between rounded-[22px] bg-card/80 px-4 py-3.5 shadow-soft ring-1 ring-border/60">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[22px] leading-none text-foreground tabular-nums">
              {remaining.length}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              suggestion{remaining.length === 1 ? "" : "s"}
            </span>
          </div>
          {totalAtRisk > 0 && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Still at risk
              </span>
              <span className="font-display text-[18px] leading-none text-foreground tabular-nums">
                ${Math.round(totalAtRisk)}
              </span>
            </div>
          )}
        </div>

        {remaining.length > 1 && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={async () => {
                const result = await onKeepAll(remaining);
                if (result.completed || result.keptCount === 0) {
                  return;
                }

                const nextIds = remaining.slice(0, result.keptCount).map((candidate) => candidate.id);
                setKept((current) => {
                  const next = new Set(current);
                  nextIds.forEach((id) => next.add(id));
                  return next;
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3.5 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary-soft/80"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
              Keep all {remaining.length}
            </button>
          </div>
        )}
      </header>

      <main className="mt-5 flex-1 space-y-3.5 px-5">
        {remaining.map((candidate, index) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            index={index}
            onKeep={async () => {
              if (!await onKeep(candidate)) {
                return;
              }
              setKept((current) => new Set(current).add(candidate.id));
            }}
            onDismiss={() => void onDismiss(candidate.id)}
            onEdit={onEdit}
          />
        ))}

        {remaining.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-7 text-center animate-fade-up">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Check className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <p className="mt-4 font-display text-[22px] leading-tight text-foreground">
              {anyKept ? "All reviewed." : "All clear."}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {anyKept ? "Undo is ready to keep watch over what you kept." : "Nothing kept. Undo will stay quiet for now."}
            </p>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-background via-background/95 to-transparent px-6 pb-8 pt-8">
        <button
          onClick={() => void onFinish(kept.size, remaining.map((candidate) => candidate.id))}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99]"
        >
          {anyKept
            ? `Continue with ${kept.size} item${kept.size === 1 ? "" : "s"}`
            : remaining.length === 0
              ? "Go to the feed"
              : "Skip the rest"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate, index, onKeep, onDismiss, onEdit,
}: {
  candidate: Candidate;
  index: number;
  onKeep: () => Promise<void>;
  onDismiss: () => void | Promise<void>;
  onEdit: (id: string, patch: CandidatePatch) => Promise<Candidate>;
}) {
  const isUrgent = Boolean(candidate.urgent);
  const sourceLabel = candidate.merchant ?? candidate.source;
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [draftTitle, setDraftTitle] = useState(candidate.title);
  const [draftCategory, setDraftCategory] = useState<Category>(candidate.category);
  const [draftDueDate, setDraftDueDate] = useState(toDateInputValue(candidate.dueAt));
  const [draftAmount, setDraftAmount] = useState(amountInputValue(candidate));

  useEffect(() => {
    if (isEditing) return;
    setDraftTitle(candidate.title);
    setDraftCategory(candidate.category);
    setDraftDueDate(toDateInputValue(candidate.dueAt));
    setDraftAmount(amountInputValue(candidate));
  }, [candidate, isEditing]);

  const saveEdit = async () => {
    const title = draftTitle.trim();
    if (!title) {
      toast.error("Add a short title before saving.");
      return;
    }

    const amountValue = parseAmountInput(draftAmount);
    if (amountValue === undefined) {
      toast.error("Use a simple amount, like 16 or 16.99.");
      return;
    }

    setSavingEdit(true);
    try {
      await onEdit(candidate.id, {
        title,
        category: draftCategory,
        dueAt: dateInputToIso(draftDueDate, candidate.dueAt),
        amountValue,
        currency: candidate.currency ?? "USD",
      });
      toast.success("Suggestion updated.");
      setIsEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not save those changes.";
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[28px] bg-card/95 p-[22px] shadow-card animate-fade-up",
        isUrgent && "ring-1 ring-critical/20",
      )}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: "both" }}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent",
          isUrgent ? "from-critical/8" : "from-primary/6",
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
              isUrgent ? "bg-critical-soft text-critical" : "bg-surface text-foreground/60",
            )}
          >
            {isUrgent ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-critical" />
              </span>
            ) : (
              <Sparkles className="h-2.5 w-2.5" strokeWidth={2.2} />
            )}
            {isUrgent ? "Urgent" : "Detected"}
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {shortDue(candidate.dueAt)}
            {sourceLabel && ` - ${sourceLabel}`}
          </span>
        </div>
        <button
          onClick={() => void onDismiss()}
          aria-label="Dismiss"
          className="rounded-full p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.7} />
        </button>
      </div>

      <h3
        className={cn(
          "mt-3 font-display leading-[1.1] text-foreground text-balance",
          isUrgent ? "text-[23px]" : "text-[20.5px]",
        )}
      >
        {candidate.title}
      </h3>

      {candidate.detail && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {candidate.detail}
        </p>
      )}

      {isEditing && (
        <div className="mt-5 rounded-[22px] bg-surface/75 p-4 ring-1 ring-border/50">
          <label className="block">
            <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Title
            </span>
            <textarea
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              rows={2}
              className="w-full resize-none rounded-2xl border-0 bg-card px-3 py-2.5 text-[13px] leading-relaxed text-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </label>

          <div className="mt-4">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Category
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {autoCategories.map((category) => {
                const active = draftCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setDraftCategory(category)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "bg-card text-foreground/70 ring-1 ring-border/60",
                    )}
                  >
                    {categoryPlural[category]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Due date
              </span>
              <input
                type="date"
                value={draftDueDate}
                onChange={(event) => setDraftDueDate(event.target.value)}
                className="w-full rounded-2xl border-0 bg-card px-3 py-2.5 text-[12.5px] text-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Amount
              </span>
              <input
                value={draftAmount}
                onChange={(event) => setDraftAmount(event.target.value)}
                placeholder="optional"
                inputMode="decimal"
                className="w-full rounded-2xl border-0 bg-card px-3 py-2.5 text-[12.5px] text-foreground shadow-soft placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => void saveEdit()}
              disabled={savingEdit}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-4 py-2.5 text-[12.5px] font-medium text-background transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {savingEdit ? "Saving..." : "Save changes"}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={savingEdit}
              className="rounded-full px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <CategoryBadge category={candidate.category} />
        {candidate.amount && (
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] tabular-nums",
              isUrgent ? "bg-critical-soft text-critical" : "bg-surface text-foreground/60",
            )}
          >
            {isUrgent ? "Save " : ""}
            {candidate.amount}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => void onKeep()}
          disabled={isEditing}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-medium text-background transition-transform active:scale-[0.98]"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
          Keep this
        </button>
        <button
          aria-label="Edit"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground/65 transition-colors hover:text-foreground"
          onClick={() => setIsEditing((value) => !value)}
        >
          <Pencil className="h-4 w-4" strokeWidth={1.7} />
        </button>
        <button
          onClick={() => void onDismiss()}
          aria-label="Dismiss"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground/65 transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.7} />
        </button>
      </div>
    </article>
  );
}

function EmptyMatches({ onManual, onSkip }: { onManual: () => Promise<void>; onSkip: () => Promise<void> }) {
  return (
    <div className="flex flex-1 flex-col px-7 pb-10 pt-16 animate-fade-in">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-soft text-primary shadow-soft">
        <Mail className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <p className="mt-7 text-center text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary">
        Gmail connected
      </p>
      <h1 className="mt-8 text-center font-display text-[32px] leading-[1.08] tracking-snug text-foreground text-balance">
        Nothing urgent showed up.
      </h1>
      <p className="mt-3 text-center text-[14px] leading-relaxed text-muted-foreground text-balance">
        Undo did not find a likely trial, renewal, return, or bill that needs review in this pass.
      </p>

      <div className="mt-8 rounded-[28px] bg-card/90 p-5 shadow-soft ring-1 ring-border/45">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-[14px] font-medium text-foreground">Undo will stay ready.</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              Keep Gmail connected and scan again later when new receipts, renewals, or invoices arrive.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => void onSkip()}
        className="mt-9 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99]"
      >
        Back to Feed
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="mt-7 rounded-[24px] bg-card/50 p-4 ring-1 ring-border/40">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Need to add one yourself?
        </p>
        <button
          onClick={() => void onManual()}
          className="mt-3 flex w-full items-center justify-between rounded-[20px] bg-card/95 p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
        >
          <div>
            <p className="text-[13.5px] font-medium text-foreground">Add manually</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">Use this only when you already know what to track.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
        </button>
      </div>

      <button
        onClick={() => void onSkip()}
        className="mt-auto pt-8 text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Keep Gmail connected
      </button>
    </div>
  );
}

export default Onboarding;
