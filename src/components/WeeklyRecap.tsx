import { ShieldCheck, ArrowRight } from "lucide-react";
import { useUndo } from "@/context/UndoContext";
import { usePremium } from "@/context/PremiumContext";
import { isActiveUndoItem } from "@/lib/undo-data";

const HOUR = 36e5;

export function WeeklyRecap() {
  const { items } = useUndo();
  const { isPremium, showUpgrade } = usePremium();
  const now = Date.now();

  const caughtThisWeek = items.filter((item) => {
    if (item.status !== "done") return false;
    const hoursSinceDue = (now - new Date(item.dueAt).getTime()) / HOUR;
    return hoursSinceDue >= 0 && hoursSinceDue <= 24 * 7;
  });

  const caughtCount = caughtThisWeek.length;
  const protectedAmount = caughtThisWeek.reduce((sum, item) => sum + (item.amountValue ?? 0), 0);

  const comingNext = items.filter((item) => {
    if (!isActiveUndoItem(item)) return false;
    const hoursUntilDue = (new Date(item.dueAt).getTime() - now) / HOUR;
    return hoursUntilDue > 24 * 7 && hoursUntilDue <= 24 * 14;
  }).length;

  if (caughtCount === 0 && comingNext === 0) return null;

  const fmt = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(0)}`);

  const title =
    caughtCount > 0
      ? "Undo helped you catch a few things in time."
      : "Quiet week. A few more items are already in view.";

  const summary =
    protectedAmount > 0
      ? `Money protected, decisions made, and ${comingNext > 0 ? "a few more items already in view." : "nothing urgent building next."}`
      : comingNext > 0
        ? "Nothing slipped this week, and a few more items are already in view."
        : "Nothing slipped this week. Undo will keep watch in the background.";

  return (
    <section className="relative mx-5 mt-6 overflow-hidden rounded-[30px] border border-border/60 bg-card/95 p-6 shadow-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/7 to-transparent"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary shadow-soft">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} />
          </span>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            This week
          </p>
        </div>
        <span className="inline-flex rounded-full bg-surface/85 px-2.5 py-1 text-[10px] font-medium text-muted-foreground ring-1 ring-border/40">
          Weekly recap
        </span>
      </div>

      <h3 className="mt-4 font-display text-[24px] leading-[1.08] text-foreground text-balance">
        {title}
      </h3>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        {summary}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat value={String(caughtCount)} label="caught in time" />
        <Stat
          value={protectedAmount > 0 ? fmt(protectedAmount) : "--"}
          label="money protected"
          accent
        />
      </div>

      <div className="mt-4 rounded-[22px] bg-surface/70 p-4 ring-1 ring-border/50">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Coming next
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/80 text-balance">
          {comingNext > 0
            ? `${comingNext} item${comingNext === 1 ? "" : "s"} ${comingNext === 1 ? "is" : "are"} already in view for next week. Undo will keep an eye on ${comingNext === 1 ? "it" : "them"}.`
            : "Nothing urgent is building next week. Undo will keep watch in the background."}
        </p>
      </div>

      {!isPremium && (
        <button
          onClick={() => showUpgrade("history")}
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/75 transition-colors hover:text-foreground"
        >
          See full recap
          <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </button>
      )}
    </section>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-[20px] bg-surface/70 p-4 ring-1 ring-border/40">
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
