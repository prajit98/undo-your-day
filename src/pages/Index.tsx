import { useMemo } from "react";
import { useUndo } from "@/context/UndoContext";
import { UndoCard } from "@/components/UndoCard";
import { MobileShell } from "@/components/MobileShell";
import { FeedSummary } from "@/components/FeedSummary";
import { urgencyFor } from "@/lib/urgency";

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
        <h1 className="mt-3 font-display text-[40px] leading-[1.05] tracking-snug text-foreground">
          {critical.length > 0 ? "A few things\nto undo today." : "Quiet today.\nNicely done."}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
          {headline}
        </p>
      </header>

      <FeedSummary items={items} />

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
        <div className="mx-5 mt-12 rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="font-display text-xl">Nothing slipping.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We're watching. You'll hear from us only when it matters.
          </p>
        </div>
      )}
    </MobileShell>
  );
};

function SectionHeader({ kicker, sub }: { kicker: string; sub: string }) {
  return (
    <div>
      <h2 className="font-display text-lg leading-tight text-foreground">{kicker}</h2>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export default Index;
