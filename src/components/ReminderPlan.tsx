import { Bell } from "lucide-react";
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
        "rounded-2xl bg-surface/65 px-3.5 py-2.5 ring-1 ring-border/35",
        compact ? "text-[11.5px]" : "text-[12.5px]",
      )}
    >
      <div className="flex items-center gap-2 text-foreground/80">
        <Bell className="h-3 w-3 shrink-0 text-primary" strokeWidth={2} />
        <span className="font-medium">{snoozed ? "Snoozed" : "Reminder"}</span>
        <span className="text-muted-foreground">/</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {snoozed ? "Tomorrow" : preview.schedule.cadence}
        </span>
      </div>
    </div>
  );
}
