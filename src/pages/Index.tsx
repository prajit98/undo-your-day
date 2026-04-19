import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Mail, ShieldCheck } from "lucide-react";
import { useUndo } from "@/context/UndoContext";
import { UndoCard } from "@/components/UndoCard";
import { MobileShell } from "@/components/MobileShell";
import { FeedSummary } from "@/components/FeedSummary";
import { urgencyFor } from "@/lib/urgency";
import { onboarding } from "@/lib/onboarding";

const Index = () => {
  const { items, active } = useUndo();
  const gmailConnected = onboarding.isGmailConnected();

  const { critical, upcoming } = useMemo(() => {
    const sorted = [...active].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    const critical = sorted.filter((i) => urgencyFor(i.category, i.dueAt).level === "critical");
    const upcoming = sorted.filter((i) => urgencyFor(i.category, i.dueAt).level !== "critical");
    return { critical, upcoming };
  }, [active]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const headline =
    critical.length > 0
      ? `${critical.length} undo moment${critical.length > 1 ? "s" : ""} need you today.`
      : "Nothing urgent. The week is yours.";

  return (
    <MobileShell>
      <header className="px-5 pb-1 pt-12">
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {today}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground shadow-soft">
            <span className="relative flex h-1.5 w-1.5">
              {gmailConnected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            {gmailConnected ? "Watching Gmail" : "Undo"}
          </span>
        </div>
        <h1 className="mt-3 whitespace-pre-line font-display text-[40px] leading-[1.05] tracking-snug text-foreground">
          {critical.length > 0 ? "A few things\nto undo today." : "Quiet today.\nNicely done."}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {headline}
        </p>
      </header>

      {active.length > 0 && <FeedSummary items={items} />}

      {critical.length > 0 && (
        <section className="mt-6 px-5">
          <SectionHeader
            kicker="Fix today"
            sub="Closing windows. Act now and you keep the option."
          />
          <div className="mt-3 space-y-3">
            {critical.map((item) => (
              <UndoCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-7 px-5">
          <SectionHeader
            kicker="Coming up"
            sub="Still plenty of time — we'll keep an eye on these."
          />
          <div className="mt-3 space-y-3">
            {upcoming.map((item) => (
              <UndoCard key={item.id} item={item} emphasis="calm" />
            ))}
          </div>
        </section>
      )}

      {/* Manual backup — secondary to the automatic-first story */}
      {active.length > 0 && (
        <Link
          to="/add"
          className="group mx-5 mt-7 flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-3.5 transition-colors hover:bg-card active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-foreground/65">
            <Plus className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-foreground/85">Add something Undo missed</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Paste, screenshot, or type it</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
        </Link>
      )}

      {active.length === 0 && (
        <div className="mx-5 mt-10 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center animate-fade-up">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <p className="mt-4 font-display text-[24px] leading-tight text-foreground">
            Nothing slipping yet.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground text-balance">
            {gmailConnected
              ? "Undo is watching. We'll surface things the moment they need you."
              : "Connect Gmail to let Undo catch trials, renewals, returns, and bills automatically."}
          </p>
          {!gmailConnected ? (
            <Link
              to="/onboarding"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[12.5px] font-medium text-background"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={1.9} />
              Connect Gmail
            </Link>
          ) : (
            <Link
              to="/add"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[12.5px] font-medium text-background"
            >
              Add something manually
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          )}
        </div>
      )}
    </MobileShell>
  );
};

function SectionHeader({ kicker, sub }: { kicker: string; sub: string }) {
  return (
    <div className="px-1">
      <h2 className="font-display text-[22px] leading-tight text-foreground">{kicker}</h2>
      <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export default Index;
