import { ShieldCheck, Bell, Clock4, Sparkles, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { usePremium, UpgradeReason } from "@/context/PremiumContext";
import { toast } from "sonner";

const COPY: Record<Exclude<UpgradeReason, null>, { kicker: string; title: string; body: string }> = {
  limit: {
    kicker: "You've reached 5 active items",
    title: "You're using Undo like it's meant to be used.",
    body: "Upgrade for unlimited protection — keep watching every trial, renewal, return, and bill without choosing what to drop.",
  },
  reminders: {
    kicker: "More than one reminder",
    title: "Get stronger reminders for things you really don't want to miss.",
    body: "Multiple reminders, smarter timing by category, and a last-chance nudge before each window closes.",
  },
  recap: {
    kicker: "Richer recap",
    title: "See the bigger picture, calmly.",
    body: "Premium recap shows everything caught in time, money protected, and patterns worth noticing — without ever feeling like a dashboard.",
  },
  history: {
    kicker: "Caught-in-time history",
    title: "See everything you caught in time with Undo Premium.",
    body: "Your full protection history — every trial cancelled, return made, bill avoided. Quietly, kept forever.",
  },
};

const INCLUDED = [
  { icon: ShieldCheck, label: "Unlimited active Undo items" },
  { icon: Bell, label: "Multiple reminders per item" },
  { icon: Clock4, label: "Smarter timing + last-chance nudges" },
  { icon: Sparkles, label: "Smarter capture & richer weekly recap" },
];

export function UpgradeSheet() {
  const { upgradeReason, closeUpgrade, setPremium } = usePremium();
  const open = upgradeReason !== null;
  const copy = upgradeReason ? COPY[upgradeReason] : null;

  const handleUpgrade = () => {
    setPremium(true);
    closeUpgrade();
    toast.success("Welcome to Undo Premium. Stronger protection, on.", { duration: 2400 });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeUpgrade()}>
      <SheetContent
        side="bottom"
        className="rounded-t-[32px] border-0 bg-card p-0 shadow-card sm:max-w-md sm:mx-auto"
      >
        <div className="px-7 pt-7 pb-9">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />

          {copy && (
            <SheetHeader className="mt-6 text-left">
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

          <ul className="mt-6 space-y-2.5 rounded-2xl bg-surface/60 p-4">
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
            Upgrade to Premium
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
