import { Sparkles, RotateCcw, PackageOpen, Receipt, MessageCircle, LucideIcon } from "lucide-react";
import { Category, categoryMeta } from "@/lib/undo-data";
import { cn } from "@/lib/utils";

const icons: Record<Category, LucideIcon> = {
  trial: Sparkles,
  renewal: RotateCcw,
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
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        meta.soft,
        meta.fg,
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}

export function CategoryIconCircle({ category, className }: { category: Category; className?: string }) {
  const meta = categoryMeta[category];
  const Icon = icons[category];
  return (
    <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl", meta.soft, meta.fg, className)}>
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}
