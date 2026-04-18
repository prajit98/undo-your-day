import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Sparkles, RefreshCw, PackageOpen, Receipt, MessageCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Category, categoryMeta } from "@/lib/undo-data";
import { onboarding } from "@/lib/onboarding";

const cats: Category[] = ["trial", "renewal", "return", "bill", "followup"];

const catIcon: Record<Category, typeof Sparkles> = {
  trial: Sparkles,
  renewal: RefreshCw,
  return: PackageOpen,
  bill: Receipt,
  followup: MessageCircle,
};

const examples = [
  {
    kicker: "Trial",
    title: "Notion AI converts to paid tomorrow",
    detail: "Cancel before 6pm and you keep the $10/month.",
    save: "Save $10",
  },
  {
    kicker: "Return",
    title: "Last 3 days to return the Adidas runners",
    detail: "After Friday at midnight, the $128 is yours forever.",
    save: "Save $128",
  },
  {
    kicker: "Follow-up",
    title: "Reply to Maya before it gets awkward",
    detail: "She asked about Lisbon four days ago.",
    save: "Stay close",
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Category[]>(["trial", "renewal", "bill"]);

  const total = 4;

  const next = () => {
    if (step < total - 1) {
      setStep(step + 1);
      return;
    }
    // Final step → finish onboarding and route to capture
    onboarding.savePrefs(picked);
    onboarding.complete();
    navigate("/add");
  };

  const back = () => {
    if (step === 0) return;
    setStep(step - 1);
  };

  const skip = () => {
    onboarding.savePrefs(picked.length ? picked : cats);
    onboarding.complete();
    navigate("/");
  };

  const togglePick = (c: Category) => {
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 pt-10">
          <button
            onClick={back}
            disabled={step === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground/70 shadow-soft transition-opacity disabled:opacity-0"
            aria-label="Back"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all",
                  i === step ? "w-6 bg-foreground" : "w-1.5 bg-border"
                )}
              />
            ))}
          </div>
          <button
            onClick={skip}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        </header>

        {/* Step content */}
        <main className="flex flex-1 flex-col px-6 pt-10">
          {step === 0 && <StepIntro />}
          {step === 1 && <StepPick picked={picked} onToggle={togglePick} />}
          {step === 2 && <StepExamples />}
          {step === 3 && <StepReady />}
        </main>

        {/* CTA */}
        <footer className="px-6 pb-10 pt-4">
          <button
            onClick={next}
            disabled={step === 1 && picked.length === 0}
            className="group flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-all active:scale-[0.99] disabled:opacity-40"
          >
            {step === 0 && "Begin"}
            {step === 1 && (picked.length === 0 ? "Pick at least one" : `Continue with ${picked.length}`)}
            {step === 2 && "I get it"}
            {step === 3 && "Add my first undo"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </button>
          {step === 3 && (
            <button
              onClick={skip}
              className="mt-3 block w-full text-center text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              I'll do it later
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

/* ------------------------------- Steps ------------------------------- */

function StepIntro() {
  return (
    <div className="animate-fade-up">
      <div className="mb-10 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-soft">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
      </div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Welcome to Undo
      </p>
      <h1 className="mt-4 font-display text-[44px] leading-[1.02] tracking-snug text-foreground text-balance">
        Catch the things you meant to fix — before it's too late.
      </h1>
      <p className="mt-5 text-[14.5px] leading-relaxed text-muted-foreground text-balance">
        Trials that quietly convert. Returns you almost forgot. Replies you owe. Undo keeps the small stuff from becoming expensive.
      </p>
    </div>
  );
}

function StepPick({ picked, onToggle }: { picked: Category[]; onToggle: (c: Category) => void }) {
  return (
    <div className="animate-fade-up">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Step 1
      </p>
      <h1 className="mt-4 font-display text-[34px] leading-[1.05] tracking-snug text-foreground text-balance">
        What do you usually forget?
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
        Pick what matters. We'll watch for these and stay quiet about the rest.
      </p>

      <div className="mt-7 space-y-2">
        {cats.map((c) => {
          const Icon = catIcon[c];
          const meta = categoryMeta[c];
          const active = picked.includes(c);
          return (
            <button
              key={c}
              onClick={() => onToggle(c)}
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                active
                  ? "border-foreground/80 bg-card shadow-soft"
                  : "border-border bg-card/50 text-foreground/80"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                  active ? "bg-primary-soft text-primary" : "bg-surface text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="flex-1">
                <p className="text-[14px] font-medium">{meta.label}s</p>
                <p className="text-[11.5px] text-muted-foreground">{meta.description}</p>
              </div>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border transition-all",
                  active ? "border-foreground bg-foreground text-background" : "border-border"
                )}
              >
                {active && <Check className="h-3 w-3" strokeWidth={2.4} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepExamples() {
  return (
    <div className="animate-fade-up">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Step 2
      </p>
      <h1 className="mt-4 font-display text-[34px] leading-[1.05] tracking-snug text-foreground text-balance">
        This is what an undo moment looks like.
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
        A clear consequence, a tight window, and one small action that saves you.
      </p>

      <div className="mt-6 space-y-3">
        {examples.map((ex, i) => (
          <article
            key={ex.title}
            className="rounded-3xl bg-card p-4 shadow-card"
            style={{ animation: `fade-up 0.5s ease-out ${i * 0.08}s both` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {ex.kicker}
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-primary">
                {ex.save}
              </span>
            </div>
            <p className="mt-2 font-display text-[19px] leading-snug text-foreground text-balance">
              {ex.title}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {ex.detail}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function StepReady() {
  return (
    <div className="animate-fade-up">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Step 3
      </p>
      <h1 className="mt-4 font-display text-[40px] leading-[1.04] tracking-snug text-foreground text-balance">
        Add your first undo. It takes 20 seconds.
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground text-balance">
        Paste a receipt, a chat, an email — or type it. Undo finds the date, the amount, and what's at stake.
      </p>

      <ul className="mt-8 space-y-3">
        {[
          "Paste any text",
          "We extract the details",
          "You confirm in one tap",
        ].map((t, i) => (
          <li key={t} className="flex items-center gap-3 text-[13.5px] text-foreground/80">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Onboarding;
