import { ShieldCheck, AlertCircle, CalendarClock } from "lucide-react";
import { UndoItem } from "@/lib/undo-data";

interface Props {
  items: UndoItem[]; // all items including done/archived
}

const HOUR = 36e5;

export function FeedSummary({ items }: Props) {
  const now = Date.now();

  const active = items.filter((i) => i.status === "active");

  const moneyAtRisk = active.reduce((sum, i) => sum + (i.amountValue ?? 0), 0);

  const expiringThisWeek = active.filter((i) => {
    const h = (new Date(i.dueAt).getTime() - now) / HOUR;
    return h >= 0 && h <= 24 * 7;
  }).length;

  const recentlySaved = items.filter((i) => {
    if (i.status !== "done") return false;
    const h = (now - new Date(i.dueAt).getTime()) / HOUR;
    return h <= 24 * 14; // last 2 weeks
  });
  const savedCount = recentlySaved.length;
  const savedAmount = recentlySaved.reduce((s, i) => s + (i.amountValue ?? 0), 0);

  const fmt = (n: number) =>
    n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(n % 1 === 0 ? 0 : 0)}`;

  return (
    <section className="mx-5 mt-5 rounded-3xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          This week at a glance
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-saved-soft px-2 py-0.5 text-[10px] font-semibold text-saved">
          <ShieldCheck className="h-3 w-3" strokeWidth={2.4} />
          On it
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat
          icon={<AlertCircle className="h-3.5 w-3.5 text-critical" strokeWidth={2.2} />}
          value={moneyAtRisk > 0 ? fmt(moneyAtRisk) : "—"}
          label="at risk"
          accent="text-critical"
        />
        <Stat
          icon={<CalendarClock className="h-3.5 w-3.5 text-foreground/60" strokeWidth={2.2} />}
          value={String(expiringThisWeek)}
          label="expiring"
        />
        <Stat
          icon={<ShieldCheck className="h-3.5 w-3.5 text-saved" strokeWidth={2.2} />}
          value={savedCount > 0 ? `${savedCount}` : "0"}
          label={savedAmount > 0 ? `saved ${fmt(savedAmount)}` : "saved"}
          accent="text-saved"
        />
      </div>
    </section>
  );
}

function Stat({
  icon, value, label, accent,
}: { icon: React.ReactNode; value: string; label: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-background/60 p-3">
      <div className="flex items-center gap-1.5">{icon}</div>
      <p className={`mt-1.5 font-display text-[22px] leading-none tabular-nums ${accent ?? "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
