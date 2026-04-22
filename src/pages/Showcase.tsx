import { useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, RefreshCw, PackageOpen, Receipt, MessageCircle,
  Bell, Check, Clock, ArrowRight, ShieldCheck, Eye, Mail, Lock,
  ChevronLeft, ChevronRight, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SplashMark } from "@/components/Splash";

/* ============================================================
   /showcase — screenshot-ready states for marketing capture.
   Each scene is a self-contained "phone" frame with curated
   static content. No live data. No nav chrome.
   ============================================================ */

type SceneKey =
  | "hero"
  | "permission"
  | "scanning"
  | "review"
  | "feed"
  | "recap"
  | "premium";

interface Scene {
  key: SceneKey;
  label: string;
  caption: string;
  render: () => ReactNode;
}

const SCENES: Scene[] = [
  { key: "hero",       label: "Hero",        caption: "The product, at rest.",                        render: HeroScene },
  { key: "permission", label: "Permission",  caption: "Trust, before any data moves.",                render: PermissionScene },
  { key: "scanning",   label: "Scanning",    caption: "A calm, premium working state.",               render: ScanningScene },
  { key: "review",     label: "Review",      caption: "What Undo found — you decide.",                render: ReviewScene },
  { key: "feed",       label: "Fix today",   caption: "The daily feed at its sharpest.",              render: FeedScene },
  { key: "recap",      label: "Weekly recap",caption: "Caught in time, calmly summed up.",            render: RecapScene },
  { key: "premium",    label: "Premium",     caption: "Stronger protection — never noisy.",           render: PremiumScene },
];

const Showcase = () => {
  const [active, setActive] = useState<SceneKey>("hero");
  const idx = SCENES.findIndex((s) => s.key === active);
  const scene = SCENES[idx];

  const go = (delta: number) => {
    const next = (idx + delta + SCENES.length) % SCENES.length;
    setActive(SCENES[next].key);
  };

  return (
    <div className="min-h-screen w-full bg-mist">
      {/* ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-16 pt-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            Back to app
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-card px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-soft">
              Press kit
            </span>
          </div>
        </header>

        {/* Title */}
        <div className="mt-10 max-w-2xl">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary">
            Undo · screenshot states
          </p>
          <h1 className="mt-3 font-display text-[44px] leading-[1.04] tracking-snug text-foreground text-balance">
            The moments worth showing.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground text-balance">
            Seven curated states — for landing visuals, social posts, and short videos. Capture each in a clean device frame.
          </p>
        </div>

        {/* Tabs */}
        <nav className="mt-8 flex flex-wrap gap-1.5">
          {SCENES.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all",
                active === s.key
                  ? "bg-foreground text-background shadow-soft"
                  : "bg-card text-foreground/70 hover:bg-card/70 hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Stage */}
        <div className="mt-10 grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center">
          {/* Phone frame */}
          <div className="flex justify-center lg:justify-start">
            <PhoneFrame>{scene.render()}</PhoneFrame>
          </div>

          {/* Caption / nav */}
          <div className="max-w-md lg:pl-6">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              State {idx + 1} / {SCENES.length}
            </p>
            <h2 className="mt-3 font-display text-[34px] leading-[1.08] tracking-snug text-foreground text-balance">
              {scene.label}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground text-balance">
              {scene.caption}
            </p>

            <div className="mt-7 flex items-center gap-2">
              <button
                onClick={() => go(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground/70 shadow-soft transition-colors hover:text-foreground"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <button
                onClick={() => go(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground/70 shadow-soft transition-colors hover:text-foreground"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <p className="ml-3 text-[11px] text-muted-foreground">
                Capture at 1170 × 2532 for clean assets.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Device frame — a calm, neutral phone shell that doesn't
   compete with the content inside.
   ============================================================ */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {/* soft halo */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[64px] opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, hsl(var(--primary) / 0.10) 0%, transparent 70%)",
        }}
      />
      <div
        className="relative h-[720px] w-[360px] overflow-hidden rounded-[52px] bg-foreground/90 p-[10px] shadow-[0_30px_80px_-30px_hsl(200_25%_12%/0.35),0_8px_28px_-12px_hsl(200_25%_12%/0.18)]"
      >
        <div className="relative h-full w-full overflow-hidden rounded-[42px] bg-background">
          {/* status bar */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-7 pt-3 text-[10.5px] font-semibold text-foreground/80">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
            </span>
          </div>
          {/* content */}
          <div className="h-full w-full overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   1. HERO — the product as a poster
   ============================================================ */
function HeroScene() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-mist px-7 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 35%, hsl(var(--primary) / 0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        <SplashMark size={88} />
      </div>

      <h1 className="relative mt-9 font-display text-[34px] leading-[1.05] tracking-snug text-foreground text-balance">
        Catch the things you meant to fix.
      </h1>
      <p className="relative mt-3 text-[13px] leading-relaxed text-muted-foreground text-balance">
        A calm daily feed of trials, renewals, returns, bills, and follow-ups —
        before they cost you.
      </p>

      <div className="relative mt-10 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[10.5px] font-medium text-muted-foreground shadow-soft">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        Quietly watching
      </div>
    </div>
  );
}

/* ============================================================
   2. PERMISSION — Gmail trust screen
   ============================================================ */
function PermissionScene() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="flex items-center justify-between px-5 pt-12">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground/70 shadow-soft">
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-soft">
          <Lock className="h-2.5 w-2.5" strokeWidth={2} />
          Only you see this
        </span>
        <div className="w-9" />
      </header>

      <main className="flex-1 px-7 pt-10">
        <h1 className="font-display text-[28px] leading-[1.08] tracking-snug text-foreground text-balance">
          Let Undo quietly catch the things that slip by.
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground text-balance">
          Undo only looks for likely trials, renewals, returns, and bills — nothing else.
        </p>

        <div className="mt-7 space-y-2.5">
          <TrustCard
            icon={Eye}
            title="Only the four things that matter"
            bullets={["Trial end and renewal dates", "Bill due dates", "Return windows closing"]}
          />
          <TrustCard
            icon={ShieldCheck}
            title="Nothing saved without you"
            primary
            bullets={["Suggestions wait for review", "Disconnect anytime"]}
          />
        </div>
      </main>

      <footer className="px-7 pb-9 pt-6">
        <div className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-[13px] font-medium text-background shadow-glow">
          <Mail className="h-3.5 w-3.5" strokeWidth={1.9} />
          Connect Gmail safely
        </div>
        <p className="mt-3 text-center text-[11.5px] text-muted-foreground">
          Maybe later — I'll add things myself
        </p>
      </footer>
    </div>
  );
}
function TrustCard({
  icon: Icon, title, bullets, primary = false,
}: { icon: typeof Eye; title: string; bullets: string[]; primary?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-4 shadow-card", primary ? "bg-primary-soft/60 ring-1 ring-primary/15" : "bg-card")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-xl",
          primary ? "bg-card text-primary" : "bg-surface text-foreground/70")}>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <p className="text-[12px] font-semibold tracking-tight text-foreground">{title}</p>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-foreground/75">
            <span className={cn("mt-[6px] h-1 w-1 shrink-0 rounded-full", primary ? "bg-primary/70" : "bg-muted-foreground/60")} />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   3. SCANNING — calm, premium working state
   ============================================================ */
function ScanningScene() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background px-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 40%, hsl(var(--primary) / 0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex h-32 w-32 items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary/[0.08] animate-soft-pulse" />
        <span className="absolute inline-flex h-24 w-24 rounded-full bg-primary/[0.12] animate-soft-pulse" style={{ animationDelay: "0.5s" }} />
        <span className="absolute inline-flex h-16 w-16 rounded-full bg-primary/[0.18] animate-soft-pulse" style={{ animationDelay: "1s" }} />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-primary-foreground shadow-glow animate-breathe">
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
        </span>
      </div>

      <h1 className="relative mt-10 font-display text-[26px] leading-[1.1] tracking-snug text-foreground text-balance">
        Undo is finding things that still can be fixed.
      </h1>
      <p className="relative mt-3 text-[12px] text-muted-foreground">
        Pulling out dates and amounts
      </p>

      <div className="relative mt-7 h-[2px] w-28 overflow-hidden rounded-full bg-surface">
        <div className="shimmer h-full w-full rounded-full" />
      </div>
    </div>
  );
}

/* ============================================================
   4. REVIEW — detected items
   ============================================================ */
function ReviewScene() {
  return (
    <div className="flex h-full w-full flex-col bg-background pt-10">
      <header className="px-5 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">From your Gmail</p>
        <h1 className="mt-2 font-display text-[26px] leading-[1.06] tracking-snug text-foreground text-balance">
          Undo found a few things worth catching.
        </h1>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-card/60 px-3.5 py-2.5 shadow-soft ring-1 ring-border/60">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[20px] leading-none text-foreground tabular-nums">3</span>
            <span className="text-[11px] text-muted-foreground">suggestions</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">At risk</span>
            <span className="font-display text-[16px] leading-none text-foreground tabular-nums">$48</span>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-2.5 overflow-hidden px-5 pt-5">
        <ReviewItem
          icon={Sparkles}
          title="Notion trial converts in 2 days"
          meta="Trial · $16/mo"
        />
        <ReviewItem
          icon={PackageOpen}
          title="Return Patagonia jacket"
          meta="Return window · 4 days left"
        />
        <ReviewItem
          icon={Receipt}
          title="ConEd electric bill due Friday"
          meta="Bill · $32"
        />
      </div>

      <footer className="px-5 pb-8 pt-4">
        <div className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-[13px] font-medium text-background shadow-glow">
          Keep all 3
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
      </footer>
    </div>
  );
}
function ReviewItem({ icon: Icon, title, meta }: { icon: typeof Sparkles; title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-card">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-foreground/70 ring-1 ring-border/60">
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{meta}</p>
      </div>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="h-3 w-3" strokeWidth={2.4} />
      </span>
    </div>
  );
}

/* ============================================================
   5. FEED — Fix today
   ============================================================ */
function FeedScene() {
  return (
    <div className="flex h-full w-full flex-col bg-background pt-10">
      <header className="px-5 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Tuesday, April 22
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-soft">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Watching Gmail
          </span>
        </div>
        <h1 className="mt-2 whitespace-pre-line font-display text-[32px] leading-[1.05] tracking-snug text-foreground">
          A few things{"\n"}to undo today.
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          2 undo moments need you today.
        </p>
      </header>

      {/* Summary strip */}
      <section className="mx-5 mt-5 rounded-[24px] bg-card p-4 shadow-card">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Right now</p>
        <div className="mt-3 grid grid-cols-3 gap-1">
          <Stat value="$48" label="at risk" tone="critical" />
          <Divider />
          <Stat value="2" label="this week" />
          <Divider />
          <Stat value="5" label="caught" tone="saved" />
        </div>
      </section>

      <section className="mt-5 px-5">
        <h2 className="font-display text-[18px] leading-tight text-foreground">Fix today</h2>
        <div className="mt-2.5 space-y-2.5">
          <CriticalCard
            title="Notion trial converts tonight"
            meta="Trial · in 8h"
            amount="Save $16"
          />
        </div>
      </section>
    </div>
  );
}
function Stat({ value, label, tone }: { value: string; label: string; tone?: "critical" | "saved" }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className={cn("font-display text-[24px] leading-none tabular-nums",
        tone === "critical" ? "text-critical" : tone === "saved" ? "text-saved" : "text-foreground")}>
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  );
}
function Divider() { return <span className="mx-auto h-7 w-px self-center bg-border" />; }

function CriticalCard({ title, meta, amount }: { title: string; meta: string; amount: string }) {
  return (
    <article className="relative overflow-hidden rounded-[24px] bg-card p-4 shadow-card ring-1 ring-critical/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-critical" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-critical">
            Converts today · {meta.split("·")[1].trim()}
          </span>
        </div>
        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/70" />
      </div>
      <h3 className="mt-2.5 font-display text-[20px] leading-[1.15] text-foreground text-balance">
        {title}
      </h3>
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-chip px-2 py-0.5 text-[10.5px] font-medium text-chip-foreground">
          <Sparkles className="h-2.5 w-2.5" strokeWidth={1.8} />
          Trial
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider tabular-nums text-critical">{amount}</span>
      </div>
      <div className="mt-3 rounded-2xl bg-surface/60 px-3 py-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-foreground/80">
          <Bell className="h-3 w-3 text-primary" strokeWidth={2} />
          <span className="font-medium">Reminder</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">The day before</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-critical px-4 py-2 text-[12px] font-medium text-critical-foreground">
          Fix now <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </button>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-foreground/65">
          <Clock className="h-3.5 w-3.5" strokeWidth={1.7} />
        </span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface text-foreground/65">
          <Check className="h-3.5 w-3.5" strokeWidth={1.7} />
        </span>
      </div>
    </article>
  );
}

/* ============================================================
   6. WEEKLY RECAP
   ============================================================ */
function RecapScene() {
  return (
    <div className="flex h-full w-full flex-col bg-background pt-10">
      <header className="px-5 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sunday recap
        </p>
        <h1 className="mt-2 font-display text-[28px] leading-[1.08] tracking-snug text-foreground text-balance">
          Quietly, you caught a lot.
        </h1>
      </header>

      <section className="mx-5 mt-6 overflow-hidden rounded-[28px] border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">This week</p>
          </div>
        </div>

        <h3 className="mt-3 font-display text-[22px] leading-tight text-foreground text-balance">
          Caught in time this week.
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <RecapStat value="3" label="items fixed" />
          <RecapStat value="$84" label="protected" accent />
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          2 things coming up next week — we'll watch them for you.
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-foreground/75">
          See everything Undo caught
          <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </div>
      </section>

      <div className="mx-5 mt-5 rounded-2xl bg-primary-soft/50 p-4 ring-1 ring-primary/10">
        <p className="text-[11px] leading-relaxed text-foreground/80 text-balance">
          <span className="font-semibold text-primary">Calm by design.</span> No streaks. No score. Just protection that quietly compounds.
        </p>
      </div>
    </div>
  );
}
function RecapStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface/60 p-3.5">
      <p className={cn("font-display text-[24px] leading-none tabular-nums", accent ? "text-primary" : "text-foreground")}>
        {value}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ============================================================
   7. PREMIUM upgrade moment — elegant, never aggressive
   ============================================================ */
function PremiumScene() {
  const included = [
    { icon: ShieldCheck, label: "Unlimited active items" },
    { icon: Bell, label: "Multiple reminders per item" },
    { icon: Clock, label: "Smarter timing + last-chance" },
    { icon: Sparkles, label: "Richer weekly recap" },
  ];
  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      {/* dimmed sheet feeling */}
      <div className="flex-1 bg-foreground/[0.04]" />
      <div className="rounded-t-[32px] bg-card p-6 shadow-card">
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          You've reached 5 active items
        </p>
        <h2 className="mt-2 font-display text-[22px] leading-[1.15] tracking-snug text-foreground text-balance">
          You're using Undo like it's meant to be used.
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Upgrade for unlimited protection — keep watching every trial, renewal, return, and bill.
        </p>

        <ul className="mt-5 space-y-2 rounded-2xl bg-surface/60 p-3.5">
          {included.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-[12px] text-foreground/85">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon className="h-3 w-3" strokeWidth={1.8} />
              </span>
              <span className="flex-1">{label}</span>
              <Check className="h-3 w-3 text-primary" strokeWidth={2.2} />
            </li>
          ))}
        </ul>

        <div className="mt-5 w-full rounded-full bg-foreground py-3.5 text-center text-[13px] font-medium text-background shadow-soft">
          Upgrade to Premium
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Maybe later</p>
        <p className="mt-3 text-center text-[10.5px] text-muted-foreground">Cancel anytime. Calm by design.</p>
      </div>
    </div>
  );
}

export default Showcase;
