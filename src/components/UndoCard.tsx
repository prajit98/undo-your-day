import { useState } from "react";
import { Check, Clock, Bell, BellPlus, Archive, ArrowRight, MoreHorizontal, Lock } from "lucide-react";
import { ReminderPlan } from "./ReminderPlan";
import { UndoItem } from "@/lib/undo-data";
import { useUndo } from "@/context/UndoContext";
import { usePremium } from "@/context/PremiumContext";
import { CategoryBadge } from "./CategoryBadge";
import { urgencyFor, shortDue } from "@/lib/urgency";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function UndoCard({ item, emphasis = "auto" }: { item: UndoItem; emphasis?: "auto" | "calm" }) {
  const { setStatus, snooze } = useUndo();
  const { isPremium, registerReminder } = usePremium();
  const [exiting, setExiting] = useState(false);
  const urgency = urgencyFor(item.category, item.dueAt);
  const isCritical = emphasis === "auto" && urgency.level === "critical";
  const isFixToday = emphasis === "auto" && urgency.level === "today";
  const showReminderPlan = emphasis === "auto" && urgency.level !== "coming";
  const primaryActionLabel = isCritical ? "Fix now" : isFixToday ? "Fix today" : "Undo now";
  const urgencyChipLabel = isCritical ? "Critical" : isFixToday ? "Fix today" : urgency.label;

  const handle = (action: () => Promise<void>, label: string) => {
    setExiting(true);
    setTimeout(() => {
      void action().then(() => {
        toast.success(label, { duration: 1800 });
      });
    }, 180);
  };

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl bg-card p-5 shadow-card transition-all duration-200 animate-fade-up",
        isCritical && "ring-1 ring-critical/20",
        exiting && "scale-[0.98] opacity-0",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent",
          isCritical ? "from-critical/8" : isFixToday ? "from-primary/8" : "from-primary/5",
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
              isCritical
                ? "bg-critical-soft text-critical"
                : isFixToday
                  ? "bg-primary-soft text-primary"
                  : "bg-surface text-foreground/65",
            )}
          >
            {isCritical && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-critical" />
              </span>
            )}
            {urgencyChipLabel}
          </span>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {shortDue(item.dueAt)}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full p-1 text-muted-foreground/70 hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => handle(() => snooze(item.id, 24), "We will bring this back tomorrow")}
            >
              <Bell className="mr-2 h-4 w-4" /> Remind me tomorrow
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                if (await registerReminder(item.id)) {
                  toast.success("Another reminder added");
                }
              }}
            >
              <BellPlus className="mr-2 h-4 w-4" /> Add another reminder
              {!isPremium && <Lock className="ml-auto h-3 w-3 text-muted-foreground" strokeWidth={2} />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handle(() => setStatus(item.id, "archived"), "Archived")}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h3
        className={cn(
          "mt-3 font-display leading-[1.15] text-foreground text-balance",
          isCritical ? "text-[24px]" : "text-[21px]",
        )}
      >
        {item.title}
      </h3>

      {item.detail && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          {item.detail}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <CategoryBadge category={item.category} />
        {item.amount && (
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] tabular-nums",
              isCritical ? "bg-critical-soft text-critical" : "bg-surface text-foreground/60",
            )}
          >
            {isCritical ? "Save " : ""}
            {item.amount}
          </span>
        )}
      </div>

      {showReminderPlan && (
        <div className="mt-3">
          <ReminderPlan category={item.category} dueAt={item.dueAt} remindAt={item.remindAt} />
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => handle(() => setStatus(item.id, "done"), "Caught in time.")}
          className={cn(
            "group inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all active:scale-[0.98]",
            isCritical
              ? "bg-critical text-critical-foreground hover:bg-critical/90"
              : "bg-foreground text-background hover:bg-foreground/90",
          )}
        >
          {primaryActionLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </button>
        <button
          onClick={() => handle(() => snooze(item.id, 24), "We will bring this back tomorrow")}
          aria-label="Snooze"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground/65 transition-colors hover:text-foreground"
        >
          <Clock className="h-4 w-4" strokeWidth={1.7} />
        </button>
        <button
          onClick={() => handle(() => setStatus(item.id, "done"), "Marked done")}
          aria-label="Done"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground/65 transition-colors hover:text-foreground"
        >
          <Check className="h-4 w-4" strokeWidth={1.7} />
        </button>
      </div>
    </article>
  );
}
