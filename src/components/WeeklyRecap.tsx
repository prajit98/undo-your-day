import { ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { useUndo } from "@/context/UndoContext";
import { usePremium } from "@/context/PremiumContext";

const HOUR = 36e5;

export function WeeklyRecap() {
  const { items } = useUndo();
  const { isPremium, showUpgrade } = usePremium();
  const now = Date.now();

  const caughtThisWeek = items.filter((i) => {
    if (i.status !== "done") return false;
    const h = (now - new Date(i.dueAt).getTime()) / HOUR;
    return h >= 0 && h <= 24 * 7;
  });

  const protectedAmount = caughtThisWeek.reduce((s, i) => s + (i.amountValue ?? 0), 0);

  const comingNext = items.filter((i) => {
    if (i.status !== "active") return false;
    const h = (new Date(i.dueAt).getTime() - now) / HOUR;
    return h > 24 * 7 && h <= 24 * 14;
  }).length;

  // Don't show until there's something gentle to say
  if (caughtThisWeek.length === 0 && comingNext === 0) return null;

  const fmt = (n: number) =>
    n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(0)}`;

  const onMore = () => showUpgrade(isPremium ? "history" : "recap");

  return (
    <section className="mx-5 mt-6 overflow-hidden rounded-[28px] border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />
          </span>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            This week
          </p>
        </div>
        {!isPremium && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Lock className="h-2.5 w-2.5" strokeWidth={2} />
            Free recap
          </span>
        )}
      </div>

      <h3 className="mt-3 font-display text-[22px] leading-tight text-foreground text-balance">
        Caught in time this week.
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat
          value={String(caughtThisWeek.length)}
          label={caughtThisWeek.length === 1 ? "item fixed" : "items fixed"}
        />
        <Stat
          value={protectedAmount > 0 ? fmt(protectedAmount) : "—"}
          label="protected"
          accent
        />
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
        {comingNext > 0
          ? `${comingNext} thing${comingNext === 1 ? "" : "s"} coming up next week — we'll watch them for you.`
          : "Quiet week ahead. We'll keep watching."}
      </p>

      <button
        onClick={onMore}
        className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/75 hover:text-foreground"
      >
        {isPremium ? "See protection history" : "See everything Undo caught"}
        <ArrowRight className="h-3 w-3" strokeWidth={2} />
      </button>
    </section>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface/60 p-3.5">
      <p
        className={`font-display text-[26px] leading-none tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
