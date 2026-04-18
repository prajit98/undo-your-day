import { useState } from "react";
import { Check, Clock, Bell, Archive, Undo2, MoreHorizontal } from "lucide-react";
import { UndoItem } from "@/lib/undo-data";
import { useUndo } from "@/context/UndoContext";
import { CategoryBadge } from "./CategoryBadge";
import { relativeDue } from "@/lib/utils-time";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function UndoCard({ item }: { item: UndoItem }) {
  const { setStatus, snooze } = useUndo();
  const [exiting, setExiting] = useState(false);
  const due = relativeDue(item.dueAt);

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
        "group rounded-3xl bg-card p-5 shadow-card transition-all duration-200",
        "animate-fade-up",
        exiting && "scale-[0.98] opacity-0"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <CategoryBadge category={item.category} />
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-medium", due.urgent ? "text-destructive" : "text-muted-foreground")}>
            {due.label}
          </span>
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
      </div>

      <h3 className="mt-3 font-display text-[19px] leading-snug text-foreground">
        {item.title}
      </h3>
      {item.detail && (
        <p className="mt-1.5 text-sm text-muted-foreground">{item.detail}</p>
      )}

      {(item.amount || item.source) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {item.source && <span>{item.source}</span>}
          {item.amount && item.source && <span className="opacity-40">·</span>}
          {item.amount && <span className="font-medium text-foreground/70">{item.amount}</span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => handle(() => setStatus(item.id, "done"), "Undo done — nicely caught")}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-transform active:scale-95"
        >
          <Undo2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          Undo now
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
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
          Done
        </button>
      </div>
    </article>
  );
}
