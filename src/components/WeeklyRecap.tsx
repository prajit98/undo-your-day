import { ShieldCheck, ArrowRight } from "lucide-react";
import { useUndo } from "@/context/UndoContext";
import { usePremium } from "@/context/PremiumContext";
import { isActiveUndoItem } from "@/lib/undo-data";
import { summarizeItemAmounts } from "@/lib/money";
import { dedupeActiveObligations } from "@/lib/obligations";

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
  const caughtValue = summarizeItemAmounts(caughtThisWeek, "--");

  const comingNext = dedupeActiveObligations(items.filter((item) => {
    if (!isActiveUndoItem(item)) return false;
    const hoursUntilDue = (new Date(item.dueAt).getTime() - now) / HOUR;
    return hoursUntilDue > 24 * 7 && hoursUntilDue <= 24 * 14;
  })).length;

  if (caughtCount === 0 && comingNext === 0) return null;

  const forwardLine = comingNext > 0
    ? `${comingNext} coming next.`
    : "Nothing urgent next week.";

  return (
    <section className="relative mx-5 mt-6 overflow-hidden rounded-[24px] border border-border/55 bg-card/70 p-4 shadow-soft">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/5 to-transparent"
      />
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
          <button
            onClick={() => showUpgrade("history")}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Recap
            <ArrowRight className="h-3 w-3" strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat value={String(caughtCount)} label="caught" />
        <Stat
          value={caughtValue.hasAmount ? caughtValue.value : String(comingNext)}
          label={caughtValue.hasAmount ? "value" : "next"}
          accent
        />
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {forwardLine}
      </p>
    </section>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-[18px] bg-surface/60 px-3 py-3 ring-1 ring-border/35">
      <p
        className={`font-display text-[22px] leading-none tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
