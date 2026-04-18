import { useState } from "react";
import { Check, Clock, Bell, Archive, Undo2, MoreHorizontal, ShieldAlert } from "lucide-react";
import { UndoItem } from "@/lib/undo-data";
import { useUndo } from "@/context/UndoContext";
import { CategoryBadge } from "./CategoryBadge";
import { urgencyFor, shortDue } from "@/lib/urgency";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function UndoCard({ item, emphasis = "auto" }: { item: UndoItem; emphasis?: "auto" | "calm" }) {
  const { setStatus, snooze } = useUndo();
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
        "relative overflow-hidden rounded-3xl p-5 transition-all duration-200 animate-fade-up",
        isCritical
          ? "bg-card shadow-card ring-1 ring-critical/25"
          : "bg-card shadow-card",
        exiting && "scale-[0.98] opacity-0"
      )}
    >
      {isCritical && (
        <span className="absolute inset-y-0 left-0 w-1 bg-critical" aria-hidden />
      )}

      {/* Urgency line */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isCritical && <ShieldAlert className="h-3.5 w-3.5 text-critical" strokeWidth={2.4} />}
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.12em]",
              urgency.level === "critical" && "text-critical",
              urgency.level === "soon" && "text-foreground/75",
              urgency.level === "later" && "text-muted-foreground"
            )}
          >
            {urgency.label} · {shortDue(item.dueAt)}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handle(() => snooze(item.id, 24), "Reminder set for tomorrow")}>
              <Bell className="mr-2 h-4 w-4" /> Remind me later
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handle(() => setStatus(item.id, "archived"), "Archived")}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Headline = consequence */}
      <h3
        className={cn(
          "mt-2.5 font-display leading-snug text-foreground",
          isCritical ? "text-[21px]" : "text-[18px]"
        )}
      >
        {item.title}
      </h3>

      {/* What can still be saved */}
      {item.detail && (
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          {item.detail}
        </p>
      )}

      {/* Meta row */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <CategoryBadge category={item.category} />
        {item.amount && (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              isCritical ? "text-critical" : "text-foreground/70"
            )}
          >
            {isCritical ? "Avoid losing " : ""}{item.amount}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => handle(() => setStatus(item.id, "done"), "Nicely caught.")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-transform active:scale-95",
            isCritical
              ? "bg-critical text-destructive-foreground"
              : "bg-primary text-primary-foreground"
          )}
        >
          <Undo2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          {isCritical ? "Fix now" : "Undo now"}
        </button>
        <button
          onClick={() => handle(() => snooze(item.id, 24), "Snoozed for a day")}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/70"
        >
          <Clock className="h-3.5 w-3.5" strokeWidth={2} />
          Snooze
        </button>
        <button
          onClick={() => handle(() => setStatus(item.id, "done"), "Marked as done")}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
          Done
        </button>
      </div>
    </article>
  );
}
