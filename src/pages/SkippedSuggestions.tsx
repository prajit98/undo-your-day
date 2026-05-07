import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { MobileShell } from "@/components/MobileShell";
import { Candidate } from "@/lib/candidates";
import { dedupeObligations } from "@/lib/obligations";
import { titleForDisplay } from "@/lib/item-copy";
import { appRepository } from "@/lib/persistence";
import { shortDue } from "@/lib/urgency";
import { toast } from "sonner";

export default function SkippedSuggestions() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    appRepository.gmail.listSkippedCandidates()
      .then((nextCandidates) => {
        if (cancelled) return;
        setCandidates(nextCandidates);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Undo could not load skipped suggestions.";
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCandidates = useMemo(
    () => dedupeObligations(candidates),
    [candidates],
  );

  const restoreSuggestion = async (candidate: Candidate) => {
    setRestoringId(candidate.id);
    try {
      await appRepository.gmail.updateCandidateStatus(candidate.id, "pending");
      toast.success("Suggestion restored.");
      navigate("/onboarding");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo could not restore that suggestion.";
      toast.error(message);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-12">
        <button
          onClick={() => navigate("/settings")}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.9} />
          Settings
        </button>
        <p className="mt-7 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Gmail
        </p>
        <h1 className="mt-3 max-w-[11ch] font-display text-[38px] leading-[1.04] tracking-snug text-foreground">
          Skipped suggestions
        </h1>
        <p className="mt-3 max-w-[28rem] text-[13px] leading-relaxed text-muted-foreground text-balance">
          Things you skipped from Gmail review.
        </p>
      </header>

      <main className="mt-6 space-y-3 px-5">
        {loading && (
          <div className="rounded-[28px] bg-card/80 p-6 shadow-soft ring-1 ring-border/40">
            <p className="text-[13px] text-muted-foreground">Loading skipped suggestions.</p>
          </div>
        )}

        {!loading && visibleCandidates.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-border bg-card/70 p-7 text-center shadow-soft">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Check className="h-4 w-4" strokeWidth={2.1} />
            </div>
            <p className="mt-4 font-display text-[22px] leading-tight text-foreground">
              Nothing skipped.
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Skipped Gmail suggestions will appear here.
            </p>
          </div>
        )}

        {visibleCandidates.map((candidate) => (
          <article
            key={candidate.id}
            className="rounded-[28px] bg-card/95 p-5 shadow-soft ring-1 ring-border/40"
          >
            <div className="flex items-start justify-between gap-3">
              <CategoryBadge category={candidate.category} />
              <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {shortDue(candidate.dueAt)}
              </span>
            </div>
            <h2 className="mt-3 font-display text-[21px] leading-[1.12] text-foreground text-balance">
              {titleForDisplay(candidate)}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
              {candidate.amount && (
                <span className="rounded-full bg-surface px-2.5 py-1 font-medium tabular-nums text-foreground/70">
                  {candidate.amount}
                </span>
              )}
              {(candidate.merchant ?? candidate.source) && (
                <span className="truncate rounded-full bg-surface px-2.5 py-1">
                  {candidate.merchant ?? candidate.source}
                </span>
              )}
            </div>

            <button
              onClick={() => void restoreSuggestion(candidate)}
              disabled={restoringId === candidate.id}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-[13px] font-medium text-background shadow-soft transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} />
              {restoringId === candidate.id ? "Restoring..." : "Restore"}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </article>
        ))}
      </main>
    </MobileShell>
  );
}
