import { Sparkles, RefreshCw, PackageOpen, Receipt, MessageCircle, LucideIcon } from "lucide-react";
import { Category, categoryMeta } from "@/lib/undo-data";
import { cn } from "@/lib/utils";

const icons: Record<Category, LucideIcon> = {
  trial: Sparkles,
  renewal: RefreshCw,
  return: PackageOpen,
  bill: Receipt,
  followup: MessageCircle,
};

export function CategoryBadge({ category, size = "sm" }: { category: Category; size?: "sm" | "md" }) {
  const meta = categoryMeta[category];
  const Icon = icons[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-chip text-chip-foreground font-medium",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={1.8} />
      {meta.label}
    </span>
  );
}

export function CategoryIconCircle({ category, className }: { category: Category; className?: string }) {
  const Icon = icons[category];
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-foreground/75 ring-1 ring-border/60",
        className
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
    </span>
  );
}

export function CategoryIconRound({ category, active = false }: { category: Category; active?: boolean }) {
  const Icon = icons[category];
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-surface text-foreground/70 ring-1 ring-border/60"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.7} />
    </span>
  );
}
