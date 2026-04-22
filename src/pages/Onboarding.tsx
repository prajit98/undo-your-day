import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, RefreshCw, PackageOpen, Receipt, Check, ChevronLeft,
  ShieldCheck, Eye, Mail, Pencil, X, ArrowRight, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Category, categoryMeta } from "@/lib/undo-data";
import { autoCategories } from "@/lib/onboarding";
import { Candidate, candidateToItem, generateCandidates } from "@/lib/candidates";
import { useUndo } from "@/context/UndoContext";
import { usePremium } from "@/context/PremiumContext";
import { CategoryBadge } from "@/components/CategoryBadge";
import { shortDue } from "@/lib/urgency";
import { toast } from "sonner";

type Step = "categories" | "permission" | "scanning" | "review";

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

const Onboarding = () => {
  const navigate = useNavigate();
  const { addItem, onboarding } = useUndo();
  const { isPremium, availableActiveSlots, canCreateActiveItems, showUpgrade } = usePremium();
  const [step, setStep] = useState<Step>("categories");
  const [picked, setPicked] = useState<Category[]>(onboarding.pickedCategories);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPicked(onboarding.pickedCategories);
  }, [onboarding.pickedCategories]);

  const skipGmail = async () => {
    await onboarding.savePrefs(picked);
    await onboarding.setGmailConnected(false);
    await onboarding.complete();
    navigate("/");
  };

  const keepCandidate = async (candidate: Candidate) => {
    if (!canCreateActiveItems()) {
      return false;
    }

    await addItem(candidateToItem(candidate));
    return true;
  };

  const keepAllCandidates = async (items: Candidate[]) => {
    if (items.length === 0) {
      return { keptCount: 0, completed: false };
    }

    if (isPremium || items.length <= availableActiveSlots) {
      for (const candidate of items) {
        await addItem(candidateToItem(candidate));
      }
      await onboarding.savePrefs(picked);
      await onboarding.complete();
      await onboarding.markFirstCapture();
      toast.success("Only what you kept is on your feed now.", {
        description: `Undo is keeping an eye on ${items.length} thing${items.length === 1 ? "" : "s"} from here.`,
        duration: 3200,
      });
      navigate("/");
      return { keptCount: items.length, completed: true };
    }

    if (availableActiveSlots <= 0) {
      showUpgrade("limit");
      return { keptCount: 0, completed: false };
    }

    for (const candidate of items.slice(0, availableActiveSlots)) {
      await addItem(candidateToItem(candidate));
    }
    showUpgrade("limit");

    return { keptCount: availableActiveSlots, completed: false };
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
        {step === "categories" && (
          <CategoryStep
            picked={picked}
            onToggle={(category) =>
              setPicked((current) => (
                current.includes(category)
                  ? current.filter((entry) => entry !== category)
                  : [...current, category]
              ))
            }
            onContinue={() => setStep("permission")}
          />
        )}

        {step === "permission" && (
          <PermissionStep
            picked={picked}
            onConnect={async () => {
              await onboarding.setGmailConnected(true);
              setStep("scanning");
            }}
            onSkip={() => void skipGmail()}
            onBack={() => setStep("categories")}
          />
        )}

        {step === "scanning" && (
          <ScanningStep
            picked={picked}
            onDone={() => {
              setCandidates(generateCandidates(picked));
              setStep("review");
            }}
          />
        )}

        {step === "review" && (
          <ReviewStep
            candidates={candidates.filter((candidate) => !dismissed.has(candidate.id))}
            onDismiss={(id) => setDismissed((current) => new Set(current).add(id))}
            onKeepAll={keepAllCandidates}
            onKeep={keepCandidate}
            onFinish={async (keptCount) => {
              await onboarding.savePrefs(picked);
              await onboarding.complete();
              if (keptCount > 0) {
                await onboarding.markFirstCapture();
              }
              toast.success(
                keptCount > 0
                  ? "Undo is now protecting what you kept."
                  : "All clear for now. Undo will stay quietly ready.",
                { duration: 3000 },
              );
              navigate("/");
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

function CategoryStep({
  picked, onToggle, onContinue,
}: {
  picked: Category[];
  onToggle: (category: Category) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      <header className="px-6 pt-14">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Welcome to Undo
        </p>
        <h1 className="mt-5 font-display text-[40px] leading-[1.04] tracking-snug text-foreground text-balance">
          What should Undo help you catch?
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground text-balance">
          Pick the kinds of things that are easiest to miss.
        </p>
      </header>

      <main className="flex-1 px-6 pt-9">
        <div className="space-y-2.5">
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
                    : "border-border bg-card/40 hover:bg-card/70",
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
  picked, onConnect, onSkip, onBack,
}: {
  picked: Category[];
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
          Review before feed
        </span>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-7 pt-12">
        <h1 className="font-display text-[34px] leading-[1.06] tracking-snug text-foreground text-balance">
          Let Undo catch the small things you meant to fix.
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground text-balance">
          Undo stays focused on likely {scopedCategories}. Gmail detection comes later, and review still comes first.
        </p>

        <div className="mt-9 space-y-3">
          <InfoCard
            icon={Eye}
            title="Only what you asked Undo to catch"
            tone="neutral"
            bullets={[
              `Likely ${scopedCategories}`,
              "Dates, amounts, and time windows tied to those",
              "No general inbox browsing",
            ]}
          />
          <InfoCard
            icon={ShieldCheck}
            title="You stay in control"
            tone="primary"
            bullets={[
              "Nothing joins your feed until you keep it",
              "Keep, edit, or dismiss in a tap",
              "Turn Gmail off anytime in Settings",
            ]}
          />
        </div>
      </main>

      <footer className="px-7 pb-10 pt-8">
        <button
          onClick={() => void onConnect()}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99]"
        >
          <Mail className="h-4 w-4" strokeWidth={1.9} />
          See how Gmail works
        </button>
        <button
          onClick={() => void onSkip()}
          className="mt-4 block w-full text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Maybe later — I&apos;ll add things myself
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
        "rounded-3xl p-5 shadow-card transition-colors",
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
  "Checking trial end dates",
  "Looking for renewal and bill deadlines",
  "Pulling out return windows and amounts",
  "Keeping review before feed",
];

function ScanningStep({ picked, onDone }: { picked: Category[]; onDone: () => void }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const cycle = setInterval(() => {
      setMessageIndex((current) => (current + 1) % SCAN_MESSAGES.length);
    }, 1700);
    const finish = setTimeout(onDone, 6200);
    return () => {
      clearInterval(cycle);
      clearTimeout(finish);
    };
  }, [onDone]);

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

      <h1 className="mt-12 font-display text-[30px] leading-[1.1] tracking-snug text-foreground text-balance">
        See how Undo checks for things still worth catching.
      </h1>
      <p className="mt-3 max-w-[17rem] text-[13px] leading-relaxed text-muted-foreground text-balance">
        Only the categories you picked. Review still comes first.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex rounded-full bg-card px-3 py-1 text-[10.5px] font-medium text-muted-foreground shadow-soft">
          Only what you picked
        </span>
        <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-[10.5px] font-medium text-primary shadow-soft">
          Review before feed
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
  candidates, onDismiss, onKeep, onKeepAll, onFinish, onEmptyManual,
}: {
  candidates: Candidate[];
  onDismiss: (id: string) => void;
  onKeep: (candidate: Candidate) => Promise<boolean>;
  onKeepAll: (items: Candidate[]) => Promise<{ keptCount: number; completed: boolean }>;
  onFinish: (keptCount: number) => Promise<void>;
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
    return <EmptyMatches onManual={onEmptyManual} onSkip={() => onFinish(0)} />;
  }

  return (
    <div className="flex flex-1 flex-col pb-32 animate-fade-in">
      <header className="px-6 pt-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary">
          Gmail flow
        </p>
        <h1 className="mt-3 font-display text-[34px] leading-[1.06] tracking-snug text-foreground text-balance">
          Undo surfaced a few things still worth catching.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground text-balance">
          Keep what matters. Nothing here reaches your feed until you say yes.
        </p>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-card/70 px-4 py-3 shadow-soft ring-1 ring-border/60">
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
                Still protectable
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

      <main className="mt-5 flex-1 space-y-3 px-5">
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
            onDismiss={() => onDismiss(candidate.id)}
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

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-background via-background to-transparent px-6 pb-8 pt-8">
        <button
          onClick={() => void onFinish(kept.size)}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99]"
        >
          {anyKept
            ? `Continue with ${kept.size} item${kept.size === 1 ? "" : "s"}`
            : remaining.length === 0
              ? "Take me to the feed"
              : "Skip the rest"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate, index, onKeep, onDismiss,
}: {
  candidate: Candidate;
  index: number;
  onKeep: () => Promise<void>;
  onDismiss: () => void;
}) {
  const isUrgent = Boolean(candidate.urgent);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl bg-card p-5 shadow-card animate-fade-up",
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
            {candidate.source && ` · ${candidate.source}`}
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-full p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.7} />
        </button>
      </div>

      <h3
        className={cn(
          "mt-3 font-display leading-[1.13] text-foreground text-balance",
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
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-medium text-background transition-transform active:scale-[0.98]"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
          Keep this
        </button>
        <button
          aria-label="Edit"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground/65 transition-colors hover:text-foreground"
          onClick={() => toast("You'll be able to fine-tune this from the feed.", { duration: 1600 })}
        >
          <Pencil className="h-4 w-4" strokeWidth={1.7} />
        </button>
        <button
          onClick={onDismiss}
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
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-soft text-primary">
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h1 className="mt-8 text-center font-display text-[32px] leading-[1.08] tracking-snug text-foreground text-balance">
        Nothing slipping right now.
      </h1>
      <p className="mt-3 text-center text-[14px] leading-relaxed text-muted-foreground text-balance">
        No strong matches this time. Manual add is here if you need it.
      </p>

      <div className="mt-9 space-y-2.5">
        {[
          { label: "Add manually", desc: "Type the details yourself" },
          { label: "Upload screenshot", desc: "Drop in a receipt or order confirmation" },
          { label: "Paste text", desc: "From an email, chat, or message" },
        ].map((option) => (
          <button
            key={option.label}
            onClick={() => void onManual()}
            className="flex w-full items-center justify-between rounded-2xl bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
          >
            <div>
              <p className="text-[14px] font-medium text-foreground">{option.label}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">{option.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
          </button>
        ))}
      </div>

      <button
        onClick={() => void onSkip()}
        className="mt-auto pt-8 text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Take me to the feed
      </button>
    </div>
  );
}

export default Onboarding;
