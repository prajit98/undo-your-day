import { useState } from "react";
import { MobileShell } from "@/components/MobileShell";
import { useUndo } from "@/context/UndoContext";
import { Category, categoryMeta } from "@/lib/undo-data";
import { CategoryIconCircle } from "@/components/CategoryBadge";
import { UndoCard } from "@/components/UndoCard";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const cats: Category[] = ["trial", "renewal", "return", "bill", "followup"];

const Categories = () => {
  const { byCategory } = useUndo();
  const [open, setOpen] = useState<Category | null>(null);

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Five quiet categories
        </p>
        <h1 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug">Where life slips.</h1>
      </header>

      <div className="mt-6 space-y-2 px-5">
        {cats.map((c) => {
          const meta = categoryMeta[c];
          const items = byCategory(c);
          const isOpen = open === c;
          return (
            <div key={c} className="overflow-hidden rounded-3xl bg-card shadow-soft">
              <button
                onClick={() => setOpen(isOpen ? null : c)}
                className="flex w-full items-center gap-4 p-4 text-left"
              >
                <CategoryIconCircle category={c} />
                <div className="flex-1">
                  <p className="font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {items.length}
                </span>
                <ChevronRight
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                />
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-border/60 bg-background/60 p-3">
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      Nothing here. Quiet is good.
                    </p>
                  ) : (
                    items.map((i) => <UndoCard key={i.id} item={i} />)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </MobileShell>
  );
};

export default Categories;
