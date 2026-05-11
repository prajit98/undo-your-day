import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  RotateCcw,
  PackageOpen,
  Receipt,
  ShieldCheck,
  Lock,
  Eye,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/context/AuthContext";
import { useUndo } from "@/context/UndoContext";

const looksFor = [
  { icon: Sparkles, title: "Free trials about to convert" },
  { icon: RotateCcw, title: "Subscriptions about to renew" },
  { icon: PackageOpen, title: "Return windows about to close" },
  { icon: Receipt, title: "Bills or invoices due soon" },
];

const doesNotDo = [
  "Send, delete, or move emails",
  "Change anything in your inbox",
  "Add anything without your review",
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
    q: "What does Undo store?",
    a: "Just enough to show a candidate — merchant, date, amount — plus the items you choose to keep and your account basics.",
  },
  {
    q: "Does Undo support other inboxes?",
    a: "Gmail is the first integration. Anything outside Gmail can be added manually.",
  },
];

const sectionAnchors = [
  { id: "looks-for", label: "What Undo looks for" },
  { id: "boundaries", label: "What Undo does not do" },
  { id: "review-first", label: "Review first" },
  { id: "faq", label: "FAQ" },
];

export default function Trust() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gmailConnection } = useUndo();

  // Context-aware soft CTA: in-app users go back; visitors get a gentle "Get started".
  const inApp = Boolean(user);
  const alreadyConnected = Boolean(gmailConnection);

  const primaryHref = inApp ? (alreadyConnected ? "/settings" : "/onboarding") : "/auth";
  const primaryLabel = inApp
    ? alreadyConnected
      ? "Back to Undo"
      : "Continue setup"
    : "Get started";

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

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10 sm:pt-14">
        {/* Hero — calmer, no pushy connect CTA */}
        <section className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-soft backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Trust &amp; privacy
          </span>
          <h1 className="mt-6 font-display text-[44px] leading-[1.04] tracking-tight text-foreground sm:text-[56px]">
            Your inbox, handled carefully.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[15.5px] leading-[1.6] text-muted-foreground">
            Read-only Gmail access. You review everything before it&apos;s kept.
          </p>

          {/* Anchor nav — refined pill */}
          <nav className="mx-auto mt-8 inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 shadow-soft backdrop-blur">
            {sectionAnchors.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex rounded-full px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </section>

        {/* What Undo looks for */}
        <Section
          id="looks-for"
          eyebrow="What Undo looks for"
          title="Four things, nothing more."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {looksFor.map(({ icon: Icon, title }) => (
              <div
                key={title}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[14.5px] font-medium text-foreground">
                  {title}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* What Undo does not do */}
        <Section
          id="boundaries"
          eyebrow="What Undo does not do"
          title="Clear boundaries, by design."
        >
          <div className="rounded-3xl border border-border/70 bg-card p-2 shadow-soft">
            <ul className="divide-y divide-border/70">
              {doesNotDo.map((line) => (
                <li key={line} className="flex items-start gap-3 px-4 py-3.5">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <span className="text-[14.5px] leading-[1.5] text-foreground">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-center text-[12.5px] text-muted-foreground">
            Read-only means read-only.
          </p>
        </Section>

        {/* Review-first */}
        <Section
          id="review-first"
          eyebrow="Review first"
          title="Nothing is kept without you."
        >
          <div className="overflow-hidden rounded-3xl border border-primary/20 bg-primary-soft/60 p-7 shadow-soft">
            <ol className="space-y-4">
              {[
                ["Undo suggests", "Candidates show up in a quiet review screen."],
                ["You decide", "Skim merchant, date, amount. Keep or skip."],
                ["You stay in control", "Disconnect Gmail anytime in Settings."],
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

        {/* Soft closing — single, calm reassurance */}
        <section className="mt-20 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-4 font-display text-[28px] leading-[1.15] tracking-tight text-foreground sm:text-[32px]">
            Built to be helpful, not invasive.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={primaryHref}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-[13.5px] font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
            >
              {primaryLabel}
            </Link>
          </div>
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
      <h2 className="mt-3 font-display text-[28px] leading-[1.1] tracking-tight text-foreground sm:text-[32px]">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
