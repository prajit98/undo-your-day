import { useState } from "react";
import { Check, Clock, Bell, BellPlus, Archive, ArrowRight, MoreHorizontal, Lock } from "lucide-react";
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

  const handle = (action: () => void, label: string) => {
    setExiting(true);
    setTimeout(() => {
      action();
      toast.success(label, { duration: 1800 });
    }, 180);
  };

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl bg-card p-5 shadow-card transition-all duration-200 animate-fade-up",
        isCritical && "ring-1 ring-critical/20",
        exiting && "scale-[0.98] opacity-0"
      )}
    >
      {/* Top meta row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCritical && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-critical" />
            </span>
          )}
          <span
            className={cn(
              "text-[10.5px] font-semibold uppercase tracking-[0.16em]",
              isCritical ? "text-critical" : "text-muted-foreground"
            )}
          >
            {urgency.label} · {shortDue(item.dueAt)}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full p-1 text-muted-foreground/70 hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handle(() => snooze(item.id, 24), "Reminder set for tomorrow")}>
              <Bell className="mr-2 h-4 w-4" /> Remind me later
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (registerReminder(item.id)) {
                  toast.success("Extra reminder added");
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

      {/* Headline */}
      <h3
        className={cn(
          "mt-3 font-display leading-[1.15] text-foreground text-balance",
          isCritical ? "text-[24px]" : "text-[21px]"
        )}
      >
        {item.title}
      </h3>

      {item.detail && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          {item.detail}
        </p>
      )}

      {/* Meta */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <CategoryBadge category={item.category} />
        {item.amount && (
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider tabular-nums",
              isCritical ? "text-critical" : "text-foreground/55"
            )}
          >
            {isCritical ? "Save " : ""}{item.amount}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={() => handle(() => setStatus(item.id, "done"), "Nicely caught.")}
          className={cn(
            "group inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all active:scale-[0.98]",
            isCritical
              ? "bg-critical text-critical-foreground hover:bg-critical/90"
              : "bg-foreground text-background hover:bg-foreground/90"
          )}
        >
          {isCritical ? "Fix now" : "Undo now"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
        </button>
        <button
          onClick={() => handle(() => snooze(item.id, 24), "Snoozed")}
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
