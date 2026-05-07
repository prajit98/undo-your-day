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
    <section className="mx-5 mt-6 rounded-[28px] bg-card p-5 shadow-card">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Right now
      </p>

      <div className="mt-4 grid grid-cols-3 gap-1">
        <Stat
          value={atRisk.value}
          label="at risk"
          accent
        />
        <Divider />
        <Stat value={String(expiringThisWeek)} label="this week" />
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
        className={`font-display text-[28px] leading-none tabular-nums ${
          accent ? "text-critical" : saved ? "text-saved" : "text-foreground"
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

function Divider() {
  return <span className="mx-auto h-8 w-px self-center bg-border" />;
}
