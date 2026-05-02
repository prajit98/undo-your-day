import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RotateCcw,
  PackageOpen,
  Receipt,
  Eye,
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  Mail,
  Loader2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/context/AuthContext";
import { useUndo } from "@/context/UndoContext";
import { appRepository } from "@/lib/persistence";
import { toast } from "sonner";

const looksFor = [
  {
    icon: Sparkles,
    title: "Free trials about to convert",
    body: "So you can decide before the first charge lands.",
  },
  {
    icon: RotateCcw,
    title: "Subscriptions about to renew",
    body: "A quiet heads-up before the auto-renewal goes through.",
  },
  {
    icon: PackageOpen,
    title: "Return windows about to close",
    body: "We surface what's still inside its return window.",
  },
  {
    icon: Receipt,
    title: "Bills or invoices due soon",
    body: "Catch payments before they slip into late fees.",
  },
];

const doesNotDo = [
  "Undo does not send emails",
  "Undo does not delete or move emails",
  "Undo does not change anything in your inbox",
  "Undo does not add anything to your feed without your review",
  "Undo is read-only when scanning Gmail",
];

const stored = [
  {
    title: "Connection status",
    body: "Whether Gmail is connected, and when it last synced.",
  },
  {
    title: "Relevant extracted details",
    body: "Just the snippets needed to show a candidate — merchant, date, amount.",
  },
  {
    title: "Items you choose to keep",
    body: "Only the candidates you approve become Undo items.",
  },
  {
    title: "Account basics",
    body: "Your email, name, and preferences so Undo works across sessions.",
  },
];

const faqs = [
  {
    q: "Why does Undo need Gmail access?",
    a: "Most trials, renewals, returns, and bills first show up as a confirmation email. Undo looks for those signals so you can act before the deadline.",
  },
  {
    q: "Does Undo change anything in my inbox?",
    a: "No. Gmail access is read-only. Undo never sends, deletes, labels, or modifies your emails.",
  },
  {
    q: "Can I disconnect Gmail later?",
    a: "Yes — anytime from Settings. You can also revoke access directly from your Google account.",
  },
  {
    q: "What if Undo finds nothing?",
    a: "That's fine. You'll see a calm empty state and you can still add items manually whenever something comes up.",
  },
  {
    q: "Does Undo support other inboxes?",
    a: "Gmail is the first integration. Other inboxes may come later — for now, anything outside Gmail can be added manually.",
  },
  {
    q: "Can I review suggestions before they appear in the app?",
    a: "Always. Nothing becomes an active Undo item until you approve it.",
  },
];

const trustChips = [
  { icon: Lock, label: "Read-only" },
  { icon: Eye, label: "Review-first" },
  { icon: ShieldCheck, label: "Gmail connected securely" },
];

const sectionAnchors = [
  { id: "looks-for", label: "What Undo looks for" },
  { id: "boundaries", label: "What Undo does not do" },
  { id: "review-first", label: "Review-first" },
  { id: "faq", label: "FAQ" },
];

export default function Trust() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { gmailConnection } = useUndo();
  const [connecting, setConnecting] = useState(false);

  const alreadyConnected = Boolean(gmailConnection);

  const handleConnect = async () => {
    if (!ready) return;
    if (!user) {
      // Not signed in — go through auth, which then leads into onboarding/Gmail.
      navigate("/auth");
      return;
    }
    if (alreadyConnected) {
      navigate("/settings");
      return;
    }
    try {
      setConnecting(true);
      const url = await appRepository.gmail.getAuthorizationUrl({ returnTo: "/settings" });
      window.location.assign(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not start Gmail connection.";
      toast.error(message);
      setConnecting(false);
    }
  };

  const ctaLabel = !ready
    ? "Loading..."
    : connecting
      ? "Opening Gmail..."
      : alreadyConnected
        ? "Gmail is connected"
        : "Connect Gmail";

  return (
    <div className="min-h-screen bg-mist">
      {/* Top bar */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 pt-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Link
          to="/"
          className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          Undo
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:pt-16">
        {/* Hero */}
        <section className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-soft backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Trust &amp; privacy
          </span>
          <h1 className="mt-6 font-display text-[44px] leading-[1.04] tracking-tight text-foreground sm:text-[56px]">
            Your inbox, handled carefully.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-[1.6] text-muted-foreground">
            Undo scans for likely trials, renewals, returns, and bills — so you
            can review what still matters before it becomes a problem.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => void handleConnect()}
              disabled={connecting || !ready}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-[14px] font-medium text-background shadow-soft transition-transform hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {ctaLabel}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card/80 px-6 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-card"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>

          <p className="mt-4 text-[12px] text-muted-foreground">
            Read-only Gmail access · You review everything first
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {trustChips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-[12px] font-medium text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {label}
              </span>
            ))}
          </div>

          {/* In-page anchors */}
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
            {sectionAnchors.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </section>

        <Divider />

        {/* What Undo looks for */}
        <Section
          id="looks-for"
          eyebrow="What Undo looks for"
          title="Four things, nothing more."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {looksFor.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-border/70 bg-card p-5 shadow-soft"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mt-4 text-[15px] font-medium text-foreground">
                  {title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-[1.55] text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Divider />

        {/* What Undo does not do */}
        <Section
          id="boundaries"
          eyebrow="What Undo does not do"
          title="Clear boundaries, by design."
        >
          <div className="rounded-3xl border border-border/70 bg-card p-2 shadow-soft">
            <ul className="divide-y divide-border/70">
              {doesNotDo.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 px-4 py-4"
                >
                  <XCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted-foreground/70" />
                  <span className="text-[14.5px] leading-[1.5] text-foreground">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-center text-[12.5px] text-muted-foreground">
            Read-only means read-only. Undo can look — never touch.
          </p>
        </Section>

        <Divider />

        {/* What gets stored */}
        <Section eyebrow="What gets stored" title="Only what's useful to you.">
          <div className="grid gap-3 sm:grid-cols-2">
            {stored.map(({ title, body }) => (
              <div
                key={title}
                className="rounded-3xl border border-border/70 bg-card p-5 shadow-soft"
              >
                <h3 className="text-[14.5px] font-medium text-foreground">
                  {title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-[1.55] text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Divider />

        {/* What stays private */}
        <Section eyebrow="What stays private" title="Not built to read your inbox.">
          <div className="rounded-3xl border border-border/70 bg-card p-7 shadow-soft">
            <p className="text-[15px] leading-[1.65] text-foreground">
              Undo isn't a chat app or an inbox client. It looks for narrow
              signals tied to trials, renewals, returns, and bills — the small
              things that turn into expensive mistakes.
            </p>
            <p className="mt-4 text-[14.5px] leading-[1.65] text-muted-foreground">
              Personal conversations, work threads, newsletters, photos — none
              of that is what Undo is here for. If it doesn't look like
              something still worth fixing, Undo moves on.
            </p>
          </div>
        </Section>

        <Divider />

        {/* Review-first */}
        <Section
          id="review-first"
          eyebrow="Review-first"
          title="Nothing becomes active without you."
        >
          <div className="overflow-hidden rounded-3xl border border-primary/20 bg-primary-soft/60 p-7 shadow-soft">
            <ol className="space-y-4">
              {[
                ["Undo suggests", "Candidates show up in a quiet review screen."],
                ["You review", "Skim merchant, date, amount. Keep or skip."],
                ["You choose what to keep", "Only approved items become Undo items."],
                ["You stay in control", "Disconnect or clear anytime in Settings."],
              ].map(([title, body], i) => (
                <li key={title} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-[12px] font-semibold text-primary shadow-soft">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[14.5px] font-medium text-foreground">
                      {title}
                    </p>
                    <p className="mt-1 text-[13.5px] leading-[1.55] text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        <Divider />

        {/* FAQ */}
        <Section id="faq" eyebrow="FAQ" title="A few honest questions.">
          <div className="rounded-3xl border border-border/70 bg-card px-2 shadow-soft">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map(({ q, a }, i) => (
                <AccordionItem
                  key={q}
                  value={`item-${i}`}
                  className="border-border/70 px-4 last:border-b-0"
                >
                  <AccordionTrigger className="text-left text-[14.5px] font-medium text-foreground hover:no-underline">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-[14px] leading-[1.6] text-muted-foreground">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Section>

        {/* Closing */}
        <section className="mt-20 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-4 font-display text-[28px] leading-[1.15] tracking-tight text-foreground">
            Built to be helpful, not invasive.
          </p>
          <p className="mt-3 text-[14px] text-muted-foreground">
            A protection layer — not inbox surveillance.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => void handleConnect()}
              disabled={connecting || !ready}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-[14px] font-medium text-background shadow-soft transition-transform hover:-translate-y-[1px] disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {ctaLabel}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              Go back
            </button>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Read-only Gmail access · You review everything first
          </p>
        </section>
      </main>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-24 sm:mt-20">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-[30px] leading-[1.1] tracking-tight text-foreground sm:text-[36px]">
        {title}
      </h2>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Divider() {
  return (
    <div className="mx-auto mt-16 h-px w-24 bg-border sm:mt-20" />
  );
}
