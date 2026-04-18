import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useUndo } from "@/context/UndoContext";
import { UndoCard } from "@/components/UndoCard";
import { MobileShell } from "@/components/MobileShell";
import { FeedSummary } from "@/components/FeedSummary";
import { urgencyFor } from "@/lib/urgency";
import { onboarding } from "@/lib/onboarding";

const Index = () => {
  const { items, active } = useUndo();

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
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Undo
          </span>
        </div>
        <h1 className="mt-3 whitespace-pre-line font-display text-[40px] leading-[1.05] tracking-snug text-foreground">
          {critical.length > 0 ? "A few things\nto undo today." : "Quiet today.\nNicely done."}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {headline}
        </p>
      </header>

      <FeedSummary items={items} />

      {!onboarding.hasFirstCapture() && (
        <Link
          to="/add"
          className="group mx-5 mt-5 flex items-center gap-3 rounded-3xl border border-primary/20 bg-primary-soft/60 p-4 transition-all hover:bg-primary-soft active:scale-[0.99] animate-fade-up"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-soft">
            <Sparkles className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <p className="text-[13.5px] font-medium leading-tight text-foreground">
              Add your first undo
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Paste anything — we'll do the rest in seconds.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </Link>
      )}

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

      {active.length === 0 && (
        <div className="mx-5 mt-10 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center animate-fade-up">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Sparkles className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <p className="mt-4 font-display text-[22px] leading-tight text-foreground">
            Nothing slipping yet.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Add a trial, a return, or a bill — Undo will quietly watch the clock.
          </p>
          <Link
            to="/add"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[12.5px] font-medium text-background"
          >
            Add your first undo
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
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
