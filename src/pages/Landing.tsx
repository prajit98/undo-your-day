import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  ShieldCheck,
  Sparkles,
  Receipt,
  RotateCcw,
  CalendarClock,
  CreditCard,
  Lock,
  Eye,
  CheckCircle2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const Landing = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    setSubmitted(true);
    toast.success("You're on the list. We'll be in touch.");
  };

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
      <section className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div className="animate-fade-up-soft">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-soft">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-soft-pulse rounded-full bg-primary" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Now with Gmail
            </span>
            <h1 className="mt-6 font-display text-[44px] leading-[1.02] tracking-snug text-balance sm:text-[60px] lg:text-[68px]">
              Catch the small things —{" "}
              <em className="text-primary not-italic italic">before they cost you.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
              Undo quietly watches your inbox for trials, renewals, returns, and bills — and gives you a
              moment to fix them before they slip.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#waitlist"
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-[15px] font-medium text-background transition-transform hover:-translate-y-px"
              >
                Join the early list
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Free while in early access · No card · Takes 30 seconds
            </p>
          </div>

          {/* Phone mock */}
          <div className="relative mx-auto w-full max-w-[340px] animate-fade-up-soft">
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
      <section className="mx-auto mt-32 max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            The quiet cost
          </p>
          <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[48px]">
            The small stuff adds up.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
            None of it feels urgent — until the charge lands. Undo notices while you're busy living.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Sparkles,
              title: "That free trial you forgot",
              cost: "$19.99, every month",
            },
            {
              icon: RotateCcw,
              title: "The return you didn't get to",
              cost: "$84 you can't get back",
            },
            {
              icon: CalendarClock,
              title: "The renewal that just hit",
              cost: "Locked in for another year",
            },
            {
              icon: CreditCard,
              title: "The bill that became a late fee",
              cost: "$35 — plus a hit to your credit",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group rounded-3xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
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
      <section id="how" className="mx-auto mt-32 max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            How Undo works
          </p>
          <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[48px]">
            Set it up once. <br />
            Undo handles the watching.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {[
            {
              step: "01",
              icon: Mail,
              title: "Connect Gmail",
              body: "Undo only scans for trials, renewals, returns, and bills. Nothing else is touched.",
            },
            {
              step: "02",
              icon: Eye,
              title: "Review the suggestions",
              body: "Every find is shown to you first. Keep, edit, or dismiss in a tap.",
            },
            {
              step: "03",
              icon: ShieldCheck,
              title: "Fix it in time",
              body: "Cancel before the charge. Return before the window. Pay before the fee.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="relative overflow-hidden rounded-[28px] border border-border bg-card p-8 shadow-soft"
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
      <section className="mx-auto mt-32 max-w-6xl px-6">
        <div className="overflow-hidden rounded-[36px] border border-border bg-card shadow-card">
          <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
            <div className="p-10 sm:p-14">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                <Lock className="h-3 w-3" strokeWidth={2} />
                Only you see this
              </span>
              <h2 className="mt-5 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[44px]">
                Narrow by design.
              </h2>
              <p className="mt-5 text-[15.5px] leading-relaxed text-muted-foreground">
                Undo looks for four things — trials, renewals, returns, and bills. Nothing else is read,
                stored, or shared. And nothing reaches your feed until you say so.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  "Trial endings and renewal dates",
                  "Payment due dates and amounts",
                  "Return windows before they close",
                  "Merchant names — never message contents",
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
            </div>

            <div className="relative bg-mist p-10 sm:p-14">
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
                <div className="mt-6 space-y-4">
                  {[
                    {
                      title: "Review before anything is kept",
                      body: "No suggestion joins your feed until you tap Keep.",
                    },
                    {
                      title: "Edit or dismiss freely",
                      body: "Wrong amount? Not relevant? One tap and it's gone.",
                    },
                    {
                      title: "Disconnect in one tap",
                      body: "Change your mind? Undo stops looking. Immediately.",
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
      <section className="mx-auto mt-32 max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Inside Undo
          </p>
          <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug sm:text-[48px]">
            Calm intelligence, end to end.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
            From the moment you connect Gmail to the day you save your first $19.99 — every screen feels
            quiet, considered, and on your side.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { variant: "permission", label: "Gmail permission" },
            { variant: "scanning", label: "Scanning state" },
            { variant: "review", label: "Review detected items" },
            { variant: "feed", label: "Fix today feed" },
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
      <section className="mx-auto mt-32 max-w-4xl px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Why it feels different
        </p>
        <h2 className="mt-4 font-display text-[40px] leading-[1.04] tracking-snug text-balance sm:text-[56px]">
          Not another to-do app. <br />
          <em className="text-primary not-italic italic">A quiet protection layer.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed text-muted-foreground">
          You don't need more lists. You need a quiet second pair of eyes — catching the small things
          before they turn into money, stress, or regret.
        </p>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="mx-auto mt-32 max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-[40px] border border-border bg-card p-10 shadow-card sm:p-16">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(700px 360px at 50% 0%, hsl(var(--primary) / 0.12), transparent 60%)",
            }}
          />
          <div className="relative text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              Early access · Limited spots
            </span>
            <h2 className="mt-5 font-display text-[40px] leading-[1.05] tracking-snug sm:text-[56px]">
              Get in early.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-muted-foreground">
              Be one of the first to try Undo — and help shape what we build next. One quiet email when
              your spot is ready.
            </p>

            {!submitted ? (
              <form
                onSubmit={handleSubmit}
                className="mx-auto mt-8 flex w-full max-w-md flex-col items-stretch gap-2 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-full border border-border bg-background px-5 py-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-[15px] font-medium text-background transition-opacity hover:opacity-90"
                >
                  Save my spot
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-primary-soft px-5 py-3 text-[14.5px] font-medium text-primary">
                <Check className="h-4 w-4" strokeWidth={2.25} />
                You're in. We'll be in touch soon.
              </div>
            )}

            <p className="mt-5 text-xs text-muted-foreground">
              Free in early access · One email, never spam · Unsubscribe in a tap
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="font-display text-xl tracking-snug">Undo</span>
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} — Catch what slips.
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

/* ───────────────────────── Phone mock ───────────────────────── */

type PhoneVariant = "feed" | "permission" | "scanning" | "review";

const PhoneMock = ({ variant, small = false }: { variant: PhoneVariant; small?: boolean }) => {
  const aspect = small ? "aspect-[9/18]" : "aspect-[9/19]";
  return (
    <div
      className={`relative ${aspect} w-full rounded-[40px] border border-border bg-foreground/90 p-2 shadow-card`}
      style={{ boxShadow: "0 30px 80px -30px hsl(200 25% 12% / 0.35), 0 8px 24px -12px hsl(200 25% 12% / 0.18)" }}
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
        Watching
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
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[8px] font-medium text-primary">
      <Lock className="h-2 w-2" />
      Only you see this
    </span>
    <h3 className="mt-3 font-display text-[18px] leading-[1.05] tracking-snug">
      Let Undo look for the things that quietly slip through.
    </h3>
    <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
      Likely trials, renewals, returns, and bills — reviewed by you first.
    </p>

    <div className="mt-3 space-y-2">
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
        Connect Gmail safely
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
      Undo is finding things that still can be fixed
    </h3>
    <p className="mt-2 text-[9.5px] text-muted-foreground">Checking for bill deadlines…</p>
  </div>
);

const ReviewScreen = () => (
  <div className="flex h-full flex-col px-4 pt-9">
    <h3 className="font-display text-[18px] leading-tight tracking-snug">
      Undo found a few things worth catching.
    </h3>
    <p className="mt-1 text-[9.5px] text-muted-foreground">Review what to keep.</p>

    <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary px-2.5 py-1.5">
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
    className={`rounded-xl border ${urgent ? "border-critical/30 bg-critical-soft/40" : "border-border bg-card"} p-2.5 shadow-soft`}
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
