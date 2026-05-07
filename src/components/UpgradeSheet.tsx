import { ShieldCheck, Bell, Clock4, Sparkles, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { usePremium, UpgradeReason } from "@/context/PremiumContext";
import { toast } from "sonner";

const COPY: Record<Exclude<UpgradeReason, null>, { kicker: string; title: string; body: string }> = {
  limit: {
    kicker: "Free limit",
    title: "Upgrade for stronger protection.",
    body: "More room for everything Undo is watching.",
  },
  reminders: {
    kicker: "Reminders",
    title: "Upgrade for stronger protection.",
    body: "Smarter timing and last-chance nudges.",
  },
  recap: {
    kicker: "Recap",
    title: "Upgrade for stronger protection.",
    body: "A fuller history of what Undo helped you catch.",
  },
  history: {
    kicker: "History",
    title: "Upgrade for stronger protection.",
    body: "See more of what Undo helped you catch.",
  },
};

const INCLUDED = [
  { icon: ShieldCheck, label: "Unlimited active items" },
  { icon: Bell, label: "More reminders" },
  { icon: Clock4, label: "Last-chance nudges" },
  { icon: Sparkles, label: "Fuller history" },
];

export function UpgradeSheet() {
  const { upgradeReason, closeUpgrade, setPremium } = usePremium();
  const open = upgradeReason !== null;
  const copy = upgradeReason ? COPY[upgradeReason] : null;

  const handleUpgrade = async () => {
    await setPremium(true);
    closeUpgrade();
    toast.success("Welcome to Undo Premium. Stronger protection, on.", { duration: 2400 });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeUpgrade()}>
      <SheetContent
        side="bottom"
        className="rounded-t-[32px] border-0 bg-card p-0 shadow-card sm:mx-auto sm:max-w-md"
      >
        <div className="px-7 pb-9 pt-7">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />

          {copy && (
            <SheetHeader className="mt-6 text-left">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
                <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                Undo Premium
              </div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
                {copy.kicker}
              </p>
              <SheetTitle className="mt-2 font-display text-[26px] leading-[1.15] tracking-snug text-foreground text-balance">
                {copy.title}
              </SheetTitle>
              <SheetDescription className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                {copy.body}
              </SheetDescription>
            </SheetHeader>
          )}

          <div className="mt-6 rounded-[28px] bg-primary-soft/55 p-4 ring-1 ring-primary/10">
            <p className="text-[12.5px] leading-relaxed text-foreground/80">
              More room, smarter reminders, and a fuller history of what Undo helped you catch.
            </p>
          </div>

          <ul className="mt-4 space-y-2.5 rounded-2xl bg-surface/70 p-4 ring-1 ring-border/40">
            {INCLUDED.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-[13px] text-foreground/85">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                </span>
                <span className="flex-1">{label}</span>
                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
              </li>
            ))}
          </ul>

          <button
            onClick={handleUpgrade}
            className="mt-6 w-full rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-soft transition-transform active:scale-[0.99]"
          >
            Upgrade for stronger protection
          </button>
          <button
            onClick={closeUpgrade}
            className="mt-2 w-full rounded-full py-3 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </button>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Cancel anytime. Calm by design.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
