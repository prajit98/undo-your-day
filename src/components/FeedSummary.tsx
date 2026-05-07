import { UndoItem, isActiveUndoItem } from "@/lib/undo-data";
import { summarizeItemAmounts } from "@/lib/money";
import { dedupeActiveObligations } from "@/lib/obligations";

interface Props {
  items: UndoItem[];
}

const HOUR = 36e5;

export function FeedSummary({ items }: Props) {
  const now = Date.now();
  const active = dedupeActiveObligations(items.filter(isActiveUndoItem));

  const atRisk = summarizeItemAmounts(active);

  const expiringThisWeek = active.filter((i) => {
    const h = (new Date(i.dueAt).getTime() - now) / HOUR;
    return h >= 0 && h <= 24 * 7;
  }).length;

  const caughtInTime = items.filter((i) => {
    if (i.status !== "done") return false;
    const h = (now - new Date(i.dueAt).getTime()) / HOUR;
    return h <= 24 * 14;
  }).length;

  return (
    <section className="mx-5 mt-5 rounded-[24px] bg-card/90 px-4 py-4 shadow-soft ring-1 ring-border/35">
      <div className="grid grid-cols-3 gap-1">
        <Stat
          value={atRisk.value}
          label="at risk"
          accent
        />
        <Divider />
        <Stat value={String(expiringThisWeek)} label="week" />
        <Divider />
        <Stat value={String(caughtInTime)} label="caught" saved />
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  accent,
  saved,
}: {
  value: string;
  label: string;
  accent?: boolean;
  saved?: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p
        className={`font-display text-[24px] leading-none tabular-nums ${
          accent ? "text-critical" : saved ? "text-saved" : "text-foreground"
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

function Divider() {
  return <span className="mx-auto h-7 w-px self-center bg-border/70" />;
}
