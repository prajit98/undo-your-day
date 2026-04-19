import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, RefreshCw, PackageOpen, Receipt, Check, ChevronLeft,
  ShieldCheck, Eye, Mail, Pencil, X, ArrowRight, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Category, categoryMeta } from "@/lib/undo-data";
import { onboarding, autoCategories } from "@/lib/onboarding";
import { Candidate, candidateToItem, generateCandidates } from "@/lib/candidates";
import { useUndo } from "@/context/UndoContext";
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

const Onboarding = () => {
  const navigate = useNavigate();
  const { addItem } = useUndo();
  const [step, setStep] = useState<Step>("categories");
  const [picked, setPicked] = useState<Category[]>(autoCategories);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const skipGmail = () => {
    onboarding.savePrefs(picked);
    onboarding.setGmailConnected(false);
    onboarding.complete();
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Subtle ambient gradient for cohesion across screens */}
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
            onToggle={(c) =>
              setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))
            }
            onContinue={() => setStep("permission")}
          />
        )}

        {step === "permission" && (
          <PermissionStep
            onConnect={() => {
              onboarding.setGmailConnected(true);
              setStep("scanning");
            }}
            onSkip={skipGmail}
            onBack={() => setStep("categories")}
          />
        )}

        {step === "scanning" && (
          <ScanningStep
            onDone={() => {
              setCandidates(generateCandidates(picked));
              setStep("review");
            }}
          />
        )}

        {step === "review" && (
          <ReviewStep
            candidates={candidates.filter((c) => !dismissed.has(c.id))}
            onDismiss={(id) => setDismissed((s) => new Set(s).add(id))}
            onKeepAll={(items) => {
              items.forEach((c) => addItem(candidateToItem(c)));
              onboarding.savePrefs(picked);
              onboarding.complete();
              onboarding.markFirstCapture();
              toast.success("Undo is watching a few things for you now", {
                description: `${items.length} item${items.length === 1 ? "" : "s"} on your feed`,
                duration: 3200,
              });
              navigate("/");
            }}
            onKeep={(c) => {
              addItem(candidateToItem(c));
              setDismissed((s) => new Set(s).add(c.id));
            }}
            onFinish={(keptCount) => {
              onboarding.savePrefs(picked);
              onboarding.complete();
              if (keptCount > 0) onboarding.markFirstCapture();
              toast.success(
                keptCount > 0
                  ? "You're protected against a few easy-to-miss things"
                  : "All clear for now — Undo will keep watch",
                { duration: 3000 },
              );
              navigate("/");
            }}
            onEmptyManual={() => {
              onboarding.savePrefs(picked);
              onboarding.complete();
              navigate("/add");
            }}
          />
        )}
      </div>
    </div>
  );
};

/* ---------------------------- 1. Categories ---------------------------- */

function CategoryStep({
  picked, onToggle, onContinue,
}: {
  picked: Category[];
  onToggle: (c: Category) => void;
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
          {autoCategories.map((c, i) => {
            const Icon = catIcon[c];
            const meta = categoryMeta[c];
            const active = picked.includes(c);
            return (
              <button
                key={c}
                onClick={() => onToggle(c)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] animate-fade-up-soft",
                  active
                    ? "border-primary/30 bg-card shadow-card"
                    : "border-border bg-card/40 hover:bg-card/70",
                )}
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
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
                    {meta.label}s
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {catTagline[c]}
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

/* ---------------------------- 2. Permission ---------------------------- */

function PermissionStep({
  onConnect, onSkip, onBack,
}: {
  onConnect: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
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
          Only you see this
        </span>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-7 pt-12">
        <h1 className="font-display text-[34px] leading-[1.06] tracking-snug text-foreground text-balance">
          Let Undo quietly watch for things worth catching.
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground text-balance">
          Undo looks for likely trials, renewals, returns, and bill deadlines — and turns them into items you can review.
        </p>

        <div className="mt-9 space-y-3">
          <InfoCard
            icon={Eye}
            title="What Undo looks for"
            tone="neutral"
            bullets={[
              "Trial and renewal dates",
              "Payment due dates",
              "Return deadlines",
              "Amounts and merchant names",
            ]}
          />
          <InfoCard
            icon={ShieldCheck}
            title="You stay in control"
            tone="primary"
            bullets={[
              "Suggestions are surfaced for review",
              "Keep, edit, or dismiss anything",
              "Add items manually anytime",
            ]}
          />
        </div>
      </main>

      <footer className="px-7 pb-10 pt-8">
        <button
          onClick={onConnect}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99]"
        >
          <Mail className="h-4 w-4" strokeWidth={1.9} />
          Connect Gmail
        </button>
        <button
          onClick={onSkip}
          className="mt-4 block w-full text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip for now
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
        isPrimary ? "bg-primary-soft/60 ring-1 ring-primary/15" : "bg-card",
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
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/75">
            <span
              className={cn(
                "mt-[7px] h-1 w-1 shrink-0 rounded-full",
                isPrimary ? "bg-primary/70" : "bg-muted-foreground/60",
              )}
            />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------- 3. Scanning ----------------------------- */

const SCAN_MESSAGES = [
  "Looking for trials and renewals",
  "Checking for bill deadlines",
  "Pulling out dates and amounts",
  "Writing what's at stake",
];

function ScanningStep({ onDone }: { onDone: () => void }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const cycle = setInterval(() => {
      setMsgIdx((i) => (i + 1) % SCAN_MESSAGES.length);
    }, 1700);
    const finish = setTimeout(onDone, 6200);
    return () => {
      clearInterval(cycle);
      clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center animate-fade-in">
      {/* Calm, layered orb — slower, more premium */}
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
        Undo is finding things that still can be fixed.
      </h1>
      <p className="mt-3 text-[13px] text-muted-foreground">
        This usually takes a moment.
      </p>

      {/* Rotating micro-messages — more elegant timing, fixed slot */}
      <div className="mt-10 flex h-6 items-center justify-center">
        <p
          key={msgIdx}
          className="text-[12.5px] font-medium tracking-[0.01em] text-foreground/70 animate-fade-up-soft"
        >
          {SCAN_MESSAGES[msgIdx]}
        </p>
      </div>

      {/* Subtle progress whisper */}
      <div className="mt-7 h-[2px] w-32 overflow-hidden rounded-full bg-surface">
        <div className="shimmer h-full w-full rounded-full" />
      </div>
    </div>
  );
}

/* ------------------------------ 4. Review ------------------------------ */

function ReviewStep({
  candidates, onDismiss, onKeep, onKeepAll, onFinish, onEmptyManual,
}: {
  candidates: Candidate[];
  onDismiss: (id: string) => void;
  onKeep: (c: Candidate) => void;
  onKeepAll: (items: Candidate[]) => void;
  onFinish: (keptCount: number) => void;
  onEmptyManual: () => void;
}) {
  const [kept, setKept] = useState<Set<string>>(new Set());

  const remaining = useMemo(() => candidates.filter((c) => !kept.has(c.id)), [candidates, kept]);
  const anyKept = kept.size > 0;
  const totalAtRisk = useMemo(
    () =>
      remaining.reduce((sum, c) => sum + (c.amountValue ?? 0), 0),
    [remaining],
  );

  if (candidates.length === 0) {
    return <EmptyMatches onManual={onEmptyManual} onSkip={() => onFinish(0)} />;
  }

  return (
    <div className="flex flex-1 flex-col pb-32 animate-fade-in">
      <header className="px-6 pt-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary">
          From your Gmail
        </p>
        <h1 className="mt-3 font-display text-[34px] leading-[1.06] tracking-snug text-foreground text-balance">
          Undo found a few things worth catching.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground text-balance">
          Review what to keep. You can edit or dismiss anything.
        </p>

        {/* Summary strip — establishes value at a glance */}
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-card/60 px-4 py-3 shadow-soft ring-1 ring-border/60">
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
                At risk
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
              onClick={() => onKeepAll(remaining)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3.5 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary-soft/80"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
              Keep all {remaining.length}
            </button>
          </div>
        )}
      </header>

      <main className="mt-5 flex-1 space-y-3 px-5">
        {remaining.map((c, i) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            index={i}
            onKeep={() => {
              setKept((s) => new Set(s).add(c.id));
              onKeep(c);
            }}
            onDismiss={() => onDismiss(c.id)}
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
              {anyKept ? "Undo will keep watch on what you kept." : "Nothing kept — that's okay."}
            </p>
          </div>
        )}
      </main>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-background via-background to-transparent px-6 pb-8 pt-8">
        <button
          onClick={() => onFinish(kept.size)}
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
  onKeep: () => void;
  onDismiss: () => void;
}) {
  const isUrgent = !!candidate.urgent;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl bg-card p-5 shadow-card animate-fade-up",
        isUrgent && "ring-1 ring-critical/20",
      )}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isUrgent && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-critical" />
            </span>
          )}
          <span
            className={cn(
              "text-[10.5px] font-semibold uppercase tracking-[0.16em]",
              isUrgent ? "text-critical" : "text-muted-foreground",
            )}
          >
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
              "text-[11px] font-semibold uppercase tracking-wider tabular-nums",
              isUrgent ? "text-critical" : "text-foreground/55",
            )}
          >
            {isUrgent ? "Save " : ""}{candidate.amount}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={onKeep}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-medium text-background transition-transform active:scale-[0.98]"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
          Keep
        </button>
        <button
          aria-label="Edit"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground/65 transition-colors hover:text-foreground"
          onClick={() => toast("You'll be able to edit on the feed.", { duration: 1600 })}
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

function EmptyMatches({ onManual, onSkip }: { onManual: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-7 pb-10 pt-16 animate-fade-in">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary-soft text-primary">
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h1 className="mt-8 text-center font-display text-[32px] leading-[1.08] tracking-snug text-foreground text-balance">
        Nothing slipping right now.
      </h1>
      <p className="mt-3 text-center text-[14px] leading-relaxed text-muted-foreground text-balance">
        Undo didn't find strong matches today. We'll keep watching — and you can add anything yourself.
      </p>

      <div className="mt-9 space-y-2.5">
        {[
          { label: "Add manually", desc: "Type the details yourself" },
          { label: "Upload screenshot", desc: "Drop in a receipt or order confirmation" },
          { label: "Paste text", desc: "From an email, chat, or message" },
        ].map((o) => (
          <button
            key={o.label}
            onClick={onManual}
            className="flex w-full items-center justify-between rounded-2xl bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
          >
            <div>
              <p className="text-[14px] font-medium text-foreground">{o.label}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">{o.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
          </button>
        ))}
      </div>

      <button
        onClick={onSkip}
        className="mt-auto pt-8 text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Take me to the feed
      </button>
    </div>
  );
}

export default Onboarding;
