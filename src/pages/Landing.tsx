import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  CalendarClock,
  CreditCard,
  Lock,
  Eye,
  CheckCircle2,
} from "lucide-react";

const TALLY_SRC =
  "https://tally.so/embed/q4EMaO?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1";
const TALLY_WIDGET_SRC = "https://tally.so/widgets/embed.js";

declare global {
  interface Window {
    Tally?: { loadEmbeds: () => void };
  }
}

const TallyForm = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe && !iframe.src) {
      iframe.src = iframe.dataset.tallySrc ?? TALLY_SRC;
    }

    const loadEmbed = () => {
      if (typeof window.Tally !== "undefined") {
        window.Tally.loadEmbeds();
      }
    };

    if (typeof window.Tally !== "undefined") {
      loadEmbed();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TALLY_WIDGET_SRC}"]`,
    );

    if (existing == null) {
      const script = document.createElement("script");
      script.src = TALLY_WIDGET_SRC;
      script.async = true;
      script.onload = loadEmbed;
      script.onerror = loadEmbed;
      document.body.appendChild(script);
      return () => {
        script.onload = null;
        script.onerror = null;
      };
    }

    existing.addEventListener("load", loadEmbed, { once: true });
    existing.addEventListener("error", loadEmbed, { once: true });

    return () => {
      existing.removeEventListener("load", loadEmbed);
      existing.removeEventListener("error", loadEmbed);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={TALLY_SRC}
      data-tally-src={TALLY_SRC}
      loading="lazy"
      width="100%"
      height={320}
      frameBorder={0}
      marginHeight={0}
      marginWidth={0}
      title="Be first to try Undo"
      className="block min-h-[320px] w-full bg-transparent"
    />
  );
};

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, hsl(var(--primary) / 0.10), transparent 60%), radial-gradient(900px 500px at -10% 30%, hsl(var(--primary-glow) / 0.08), transparent 60%)",
        }}
      />

      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
        <Link to="/landing" className="flex items-center gap-2">
          <span className="font-display text-2xl tracking-snug">Undo</span>
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="#how"
            className="hidden rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            How it works
          </a>
          <a
            href="#waitlist"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Get early access
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-[72px] sm:pt-[104px]">
        <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_1fr] lg:gap-20">
          <div className="animate-fade-up-soft">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-soft backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-soft-pulse rounded-full bg-primary" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Starts with Gmail
            </span>
            <h1 className="mt-7 max-w-[11ch] font-display text-[44px] leading-[1] tracking-snug text-balance sm:max-w-[12ch] sm:text-[60px] lg:max-w-[11ch] lg:text-[68px]">
              Catch the things you meant to fix —{" "}
              <em className="text-primary not-italic italic">before it’s too late.</em>
            </h1>
            <p className="mt-7 max-w-[34rem] text-[17px] leading-[1.75] text-muted-foreground">
              Undo is designed to surface likely trials, renewals, returns, and bills, then bring
              them to review before they become expensive, stressful, or awkward.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href="#waitlist"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-4 text-[15px] font-medium text-background shadow-soft transition-transform hover:-translate-y-px"
              >
                Get early access
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-4 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary"
              >
                See how it works
              </a>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" strokeWidth={2} />
              Only the four things that matter. Nothing is kept without your review.
            </p>
          </div>

          {/* Phone mock */}
          <div className="relative mx-auto w-full max-w-[344px] animate-fade-up-soft">
            <div
              className="absolute -inset-10 -z-10 rounded-full opacity-60 blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)",
              }}
            />
            <PhoneMock variant="feed" />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto mt-36 max-w-6xl px-6 sm:mt-44">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            The quiet cost
          </p>
          <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[48px]">
            Small mistakes get expensive.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
            It usually isn’t one big disaster. It’s the free trial you forgot to cancel. The return
            window you meant to use. The renewal that hit before you noticed. The bill that quietly
            became a late fee.
          </p>
          <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
            Undo helps catch those small things while they’re still fixable.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Sparkles,
              title: "Forgot to cancel a trial",
              cost: "$19.99, every month",
            },
            {
              icon: RotateCcw,
              title: "Missed a return window",
              cost: "$84 you can’t get back",
            },
            {
              icon: CalendarClock,
              title: "Renewal hit before you noticed",
              cost: "Locked in for another year",
            },
            {
              icon: CreditCard,
              title: "Bill slipped into a late fee",
              cost: "$35 — plus a hit to your credit",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group min-h-[212px] rounded-[28px] border border-border/70 bg-card/95 p-7 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground/70">
                <item.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </div>
              <p className="mt-5 text-[15px] font-medium leading-snug">{item.title}</p>
              <p className="mt-2 text-[13px] text-muted-foreground">{item.cost}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto mt-36 max-w-6xl px-6 sm:mt-44">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            How Undo works
          </p>
          <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[48px]">
            Three calm steps.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {[
            {
              step: "01",
              icon: Mail,
              title: "Start with Gmail",
              body: "Undo stays focused on likely trials, renewals, returns, and bills — nothing broader.",
            },
            {
              step: "02",
              icon: Eye,
              title: "Review what Undo found",
              body: "Nothing goes into your feed until you keep it.",
            },
            {
              step: "03",
              icon: ShieldCheck,
              title: "Fix what still can be saved",
              body: "See what matters now, act quickly, and move on.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="relative overflow-hidden rounded-[30px] border border-border/70 bg-card/95 p-8 shadow-soft"
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-[28px] text-muted-foreground/60">{s.step}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <s.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </div>
              </div>
              <h3 className="mt-8 font-display text-[26px] leading-tight tracking-snug">{s.title}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust section */}
      <section className="mx-auto mt-36 max-w-6xl px-6 sm:mt-44">
        <div className="overflow-hidden rounded-[36px] border border-border/70 bg-card/95 shadow-card">
          <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
            <div className="p-10 sm:p-16">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                <Lock className="h-3 w-3" strokeWidth={2} />
                Only you see this
              </span>
              <h2 className="mt-6 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[44px]">
                Only the four things that matter.
              </h2>
              <p className="mt-5 text-[15.5px] leading-relaxed text-muted-foreground">
                Undo is designed to look for just:
              </p>

              <ul className="mt-6 space-y-4">
                {[
                  "Trial and renewal dates",
                  "Payment due dates",
                  "Return deadlines",
                  "Amounts and merchant names",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-[15px]">
                    <CheckCircle2
                      className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-primary"
                      strokeWidth={1.75}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-[14.5px] leading-relaxed text-muted-foreground">
                Nothing is saved without you. Undo surfaces suggestions for review — keep, edit, or
                dismiss anything. You stay in control the whole time.
              </p>
            </div>

            <div className="relative bg-mist p-10 sm:p-16">
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  background:
                    "radial-gradient(closest-side at 70% 30%, hsl(var(--primary) / 0.10), transparent 70%)",
                }}
              />
              <div className="relative">
                <h3 className="font-display text-[26px] leading-tight tracking-snug">
                  You stay in control.
                </h3>
                <div className="mt-7 space-y-4">
                  {[
                    {
                      title: "Review before anything is kept",
                      body: "No suggestion joins your feed until you tap Keep.",
                    },
                    {
                      title: "Edit or dismiss freely",
                      body: "Wrong amount? Not relevant? One tap and it’s gone.",
                    },
                    {
                      title: "Disconnect in one tap",
                      body: "Change your mind? Undo steps back immediately.",
                    },
                  ].map((c) => (
                    <div
                      key={c.title}
                      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
                    >
                      <p className="text-[14.5px] font-medium">{c.title}</p>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{c.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="mx-auto mt-36 max-w-6xl px-6 sm:mt-44">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Inside Undo
          </p>
          <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[48px]">
            See what Undo catches.
          </h2>
        </div>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { variant: "permission", label: "Gmail trust" },
            { variant: "scanning", label: "Finding what matters" },
            { variant: "review", label: "Review before keeping" },
            { variant: "feed", label: "Fix today" },
          ].map((p) => (
            <div key={p.variant} className="flex flex-col items-center gap-4">
              <div className="w-full max-w-[260px]">
                <PhoneMock variant={p.variant as PhoneVariant} small />
              </div>
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {p.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why different */}
      <section className="mx-auto mt-36 max-w-4xl px-6 text-center sm:mt-44">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Why it feels different
        </p>
        <h2 className="mt-4 font-display text-[40px] leading-[1.04] tracking-snug text-balance sm:text-[56px]">
          Not a to-do app. <br />
          <em className="text-primary not-italic italic">A protection layer.</em>
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-[16.5px] leading-relaxed text-muted-foreground">
          Undo is not about organizing your life. It is about catching the small things that quietly
          make life worse — before they turn into stress, wasted money, or awkwardness.
        </p>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="mx-auto mt-36 max-w-3xl px-6 pb-28 sm:mt-44">
            <div className="relative overflow-hidden rounded-[40px] border border-border/70 bg-card/95 p-8 shadow-card sm:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(700px 360px at 50% 0%, hsl(var(--primary) / 0.12), transparent 60%)",
            }}
          />
          <div className="relative">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                Early access
              </span>
              <h2 className="mt-6 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[52px]">
                Be first to try Undo.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-muted-foreground">
                Join the early list for first access to Undo.
              </p>
            </div>

            <div className="mx-auto mt-10 w-full max-w-lg rounded-[30px] border border-border/70 bg-background/75 p-4 shadow-soft backdrop-blur-sm sm:p-6">
              <div className="overflow-hidden rounded-[28px] bg-transparent ring-1 ring-border/40">
                <TallyForm />
              </div>
            </div>

            <p className="mx-auto mt-6 max-w-sm text-center text-xs text-muted-foreground">
              We’ll only email when there’s something worth opening.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-12 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <span className="font-display text-xl tracking-snug">Undo</span>
            <span className="text-xs text-muted-foreground">
              Catch the things you meant to fix — before it’s too late.
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#waitlist" className="hover:text-foreground">
              Early access
            </a>
            <Link to="/" className="hover:text-foreground">
              Open app
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* Phone mock */

type PhoneVariant = "feed" | "permission" | "scanning" | "review";

const PhoneMock = ({ variant, small = false }: { variant: PhoneVariant; small?: boolean }) => {
  const aspect = small ? "aspect-[9/18]" : "aspect-[9/19]";
  return (
    <div
      className={`relative ${aspect} w-full rounded-[42px] border border-border/70 bg-foreground/95 p-2.5 shadow-card`}
      style={{ boxShadow: "0 34px 90px -34px hsl(200 25% 12% / 0.38), 0 10px 28px -14px hsl(200 25% 12% / 0.2)" }}
    >
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-foreground/90" />
      <div className="relative h-full w-full overflow-hidden rounded-[32px] bg-background">
        {variant === "feed" && <FeedScreen />}
        {variant === "permission" && <PermissionScreen />}
        {variant === "scanning" && <ScanningScreen />}
        {variant === "review" && <ReviewScreen />}
      </div>
    </div>
  );
};

const FeedScreen = () => (
  <div className="flex h-full flex-col px-4 pt-9">
    <div className="flex items-center justify-between">
      <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Tuesday · Apr 22
      </p>
      <span className="inline-flex items-center gap-1 rounded-full bg-card px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground shadow-soft">
        <span className="h-1 w-1 rounded-full bg-primary" />
        Review-first
      </span>
    </div>
    <h3 className="mt-2 font-display text-[20px] leading-tight tracking-snug">
      2 undo moments need you today.
    </h3>

    <div className="mt-3 space-y-2">
      <MiniCard
        urgent
        chip="Trial"
        title="Save $19.99 if you cancel today"
        meta="Notion AI · ends today"
      />
      <MiniCard chip="Return" title="Last 2 days to return" meta="Adidas · $84.00" />
      <MiniCard chip="Bill" title="Avoid the late fee this week" meta="ConEd · $112.40" />
      <MiniCard chip="Renewal" title="Spotify renews tomorrow" meta="$11.99 / mo" />
    </div>
  </div>
);

const PermissionScreen = () => (
  <div className="flex h-full flex-col px-4 pt-10">
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[8px] font-medium text-primary shadow-soft">
      <Lock className="h-2 w-2" />
      Only you see this
    </span>
    <h3 className="mt-3 font-display text-[18px] leading-[1.05] tracking-snug">
      See how Undo looks for the things that quietly slip through.
    </h3>
    <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
      Likely trials, renewals, returns, and bills — reviewed by you first.
    </p>

      <div className="mt-3 space-y-2.5">
      <div className="rounded-xl border border-border bg-card p-2.5">
        <p className="text-[9px] font-medium">Only the four things that matter</p>
        <ul className="mt-1.5 space-y-1 text-[8.5px] text-muted-foreground">
          <li>· Trial & renewal dates</li>
          <li>· Payment due dates</li>
          <li>· Return deadlines</li>
        </ul>
      </div>
      <div className="rounded-xl border border-border bg-card p-2.5">
        <p className="text-[9px] font-medium">Nothing is saved without you</p>
        <p className="mt-1 text-[8.5px] leading-snug text-muted-foreground">
          You see every suggestion before it joins your feed.
        </p>
      </div>
    </div>

    <div className="mt-auto pb-4">
      <div className="rounded-full bg-foreground py-2 text-center text-[9.5px] font-medium text-background">
        See Gmail flow
      </div>
      <p className="mt-2 text-center text-[8.5px] text-muted-foreground">Maybe later</p>
    </div>
  </div>
);

const ScanningScreen = () => (
  <div className="flex h-full flex-col items-center justify-center px-4 text-center">
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span
        className="absolute inset-0 animate-soft-pulse rounded-full"
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.35), transparent 70%)" }}
      />
      <span
        className="absolute inset-3 animate-breathe rounded-full"
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.55), transparent 70%)" }}
      />
      <span className="relative h-6 w-6 rounded-full bg-primary shadow-glow" />
    </div>
    <h3 className="mt-6 font-display text-[16px] leading-tight tracking-snug">
      Undo is checking for things still worth catching
    </h3>
    <p className="mt-2 text-[9.5px] text-muted-foreground">Checking bill deadlines…</p>
  </div>
);

const ReviewScreen = () => (
  <div className="flex h-full flex-col px-4 pt-9">
    <h3 className="font-display text-[18px] leading-tight tracking-snug">
      Undo found a few things worth catching.
    </h3>
    <p className="mt-1 text-[9.5px] text-muted-foreground">Review what to keep.</p>

    <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/85 px-2.5 py-1.5">
      <span className="text-[9px] font-medium">5 suggestions · $147 at risk</span>
      <span className="rounded-full bg-foreground px-2 py-0.5 text-[8.5px] font-medium text-background">
        Keep all
      </span>
    </div>

    <div className="mt-3 space-y-2">
      <MiniCard
        urgent
        chip="Trial"
        title="Save $19.99 if you cancel today"
        meta="Notion AI"
        action="Keep"
      />
      <MiniCard chip="Return" title="Last 2 days to return" meta="Adidas · $84" action="Keep" />
      <MiniCard chip="Bill" title="ConEd bill in 3 days" meta="$112.40" action="Keep" />
    </div>
  </div>
);

const MiniCard = ({
  chip,
  title,
  meta,
  urgent,
  action,
}: {
  chip: string;
  title: string;
  meta: string;
  urgent?: boolean;
  action?: string;
}) => (
  <div
    className={`rounded-xl border ${urgent ? "border-critical/30 bg-critical-soft/40" : "border-border bg-card"} p-3 shadow-soft`}
  >
    <div className="flex items-center justify-between">
      <span
        className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider ${urgent ? "bg-critical/15 text-critical" : "bg-chip text-chip-foreground"}`}
      >
        {chip}
      </span>
      {action && (
        <span className="rounded-full bg-foreground px-2 py-0.5 text-[8px] font-medium text-background">
          {action}
        </span>
      )}
    </div>
    <p className="mt-1.5 text-[10.5px] font-medium leading-tight">{title}</p>
    <p className="mt-0.5 text-[8.5px] text-muted-foreground">{meta}</p>
  </div>
);

export default Landing;
