import { useMemo } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useUndo } from "@/context/UndoContext";
import { CategoryBadge } from "@/components/CategoryBadge";
import { dayKey, formatDay } from "@/lib/utils-time";

const Timeline = () => {
  const { active } = useUndo();

  const grouped = useMemo(() => {
    const sorted = [...active].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    const map = new Map<string, typeof sorted>();
    sorted.forEach((i) => {
      const k = dayKey(i.dueAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    });
    return Array.from(map.entries());
  }, [active]);

  const todayKey = dayKey(new Date().toISOString());

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          What's ahead
        </p>
        <h1 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug">Timeline.</h1>
      </header>

      {grouped.length === 0 ? (
        <div className="mx-5 mt-10 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
          <p className="font-display text-[20px] leading-tight text-foreground">A clear horizon.</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Nothing scheduled. Add an undo and it'll appear here on its day.
          </p>
        </div>
      ) : (
        <div className="mt-8 px-5">
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
            {grouped.map(([key, items]) => {
              const isToday = key === todayKey;
              return (
                <section key={key} className="relative pb-7">
                  <span
                    className={`absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                      isToday ? "border-primary bg-primary" : "border-border bg-background"
                    }`}
                  />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {isToday ? "Today" : formatDay(key)}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {items.map((i) => (
                      <li key={i.id} className="rounded-2xl bg-card p-4 shadow-soft">
                        <div className="mb-2">
                          <CategoryBadge category={i.category} />
                        </div>
                        <p className="font-display text-[15px] leading-snug">{i.title}</p>
                        {i.amount && (
                          <p className="mt-1 text-xs text-muted-foreground">{i.amount} · {i.source}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </MobileShell>
  );
};

export default Timeline;
