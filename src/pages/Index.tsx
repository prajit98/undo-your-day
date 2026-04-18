import { useMemo } from "react";
import { useUndo } from "@/context/UndoContext";
import { UndoCard } from "@/components/UndoCard";
import { MobileShell } from "@/components/MobileShell";

const Index = () => {
  const { active } = useUndo();

  const sorted = useMemo(
    () => [...active].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt)),
    [active]
  );

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const urgent = sorted.filter((i) => +new Date(i.dueAt) - Date.now() < 1000 * 60 * 60 * 48).length;

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-10">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {today}
        </p>
        <h1 className="mt-2 font-display text-[32px] leading-tight text-foreground">
          Undo Feed
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {urgent > 0
            ? `${urgent} small thing${urgent > 1 ? "s" : ""} you can still fix today.`
            : "You're all caught up. Nothing slipping through."}
        </p>
      </header>

      <section className="space-y-3 px-5 pt-5">
        {sorted.map((item) => (
          <UndoCard key={item.id} item={item} />
        ))}
        {sorted.length === 0 && (
          <div className="mt-12 rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-display text-xl">A quiet day.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing to undo right now. We'll let you know.
            </p>
          </div>
        )}
      </section>
    </MobileShell>
  );
};

export default Index;
