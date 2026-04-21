import { Bell, Lock, Sparkles } from "lucide-react";
import { Category } from "@/lib/undo-data";
import { policyFor } from "@/lib/reminders";
import { usePremium } from "@/context/PremiumContext";
import { cn } from "@/lib/utils";

interface Props {
  category: Category;
  /** when true, render the slim card-embedded variant */
  compact?: boolean;
}

/**
 * Quiet inline preview of the reminder plan for an item.
 * - Free: shows the single calm cadence
 * - Premium: shows the multi-step protection cadence
 * - Free users see a soft "Last-chance nudge · Premium" line beneath
 */
export function ReminderPlan({ category, compact = true }: Props) {
  const { isPremium, showUpgrade } = usePremium();
  const p = policyFor(category);
  const schedule = isPremium ? p.premium : p.free;

  return (
    <div
      className={cn(
        "rounded-2xl bg-surface/60 px-3.5 py-2.5",
        compact ? "text-[11.5px]" : "text-[12.5px]"
      )}
    >
      <div className="flex items-center gap-2 text-foreground/80">
        <Bell className="h-3 w-3 text-primary" strokeWidth={2} />
        <span className="font-medium">Reminder</span>
        <span className="text-muted-foreground">·</span>
        <span className="truncate text-muted-foreground">{schedule.cadence}</span>
        {isPremium && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-2 w-2" strokeWidth={2.4} />
            Premium
          </span>
        )}
      </div>

      {!isPremium && (
        <button
          onClick={() => showUpgrade("reminders")}
          className="mt-1.5 flex w-full items-center gap-1.5 text-left text-[10.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Lock className="h-2.5 w-2.5" strokeWidth={2} />
          Last-chance nudge with Premium
        </button>
      )}
    </div>
  );
}
