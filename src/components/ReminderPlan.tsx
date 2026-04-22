import { Bell, Sparkles } from "lucide-react";
import { Category } from "@/lib/undo-data";
import { reminderPreviewFor } from "@/lib/reminders";
import { usePremium } from "@/context/PremiumContext";
import { cn } from "@/lib/utils";

interface Props {
  category: Category;
  dueAt: string;
  remindAt?: string;
  compact?: boolean;
}

export function ReminderPlan({ category, dueAt, remindAt, compact = true }: Props) {
  const { isPremium } = usePremium();
  const preview = reminderPreviewFor(category, dueAt, isPremium);
  const snoozed = remindAt ? new Date(remindAt).getTime() > Date.now() : false;

  return (
    <div
      className={cn(
        "rounded-2xl bg-surface/70 px-3.5 py-3 ring-1 ring-border/40",
        compact ? "text-[11.5px]" : "text-[12.5px]",
      )}
    >
      <div className="flex items-center gap-2 text-foreground/80">
        <Bell className="h-3 w-3 text-primary" strokeWidth={2} />
        <span className="font-medium">{snoozed ? "Reminder snoozed" : "In-app reminder"}</span>
        <span className="text-muted-foreground">/</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {snoozed ? "Until tomorrow" : preview.schedule.cadence}
        </span>
        {isPremium && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-2 w-2" strokeWidth={2.4} />
            Premium
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[10.75px] leading-relaxed text-foreground/80">
        {snoozed
          ? "Undo will surface this again tomorrow in the app, as long as there is still time."
          : preview.detail}
      </p>

      {!snoozed && preview.support && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <Sparkles className="h-2.5 w-2.5 text-primary" strokeWidth={2} />
          {preview.support}
        </p>
      )}
    </div>
  );
}
