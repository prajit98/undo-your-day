import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileShell } from "@/components/MobileShell";
import { Switch } from "@/components/ui/switch";
import { Bell, Moon, Mail, ChevronRight, Sparkles, PlayCircle, ShieldCheck, Check } from "lucide-react";
import { categoryMeta, Category } from "@/lib/undo-data";
import { CategoryIconCircle } from "@/components/CategoryBadge";
import { onboarding } from "@/lib/onboarding";
import { usePremium, FREE_ITEM_LIMIT } from "@/context/PremiumContext";
import { useUndo } from "@/context/UndoContext";

const cats: Category[] = ["trial", "renewal", "return", "bill", "followup"];

const Settings = () => {
  const navigate = useNavigate();
  const { isPremium, showUpgrade } = usePremium();
  const { active } = useUndo();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [quiet, setQuiet] = useState(true);
  const [enabledCats, setEnabledCats] = useState<Record<Category, boolean>>({
    trial: true,
    renewal: true,
    return: true,
    bill: true,
    followup: true,
  });
  const [timing, setTiming] = useState<"morning" | "afternoon" | "evening">("morning");

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Preferences
        </p>
        <h1 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug">Tune Undo.</h1>
      </header>

      <div className="mt-6 space-y-6 px-5">
        {/* Account */}
        <section className="rounded-3xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft font-display text-lg text-primary">
              A
            </div>
            <div className="flex-1">
              <p className="font-medium">Alex Morgan</p>
              <p className="text-xs text-muted-foreground">alex@undoapp.com</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </section>

        {/* Premium status */}
        {isPremium ? (
          <section className="rounded-3xl border border-primary/20 bg-primary-soft/60 p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Undo Premium</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Unlimited protection. Stronger reminders. Richer recap.
                </p>
              </div>
              <Check className="h-4 w-4 text-primary" strokeWidth={2.2} />
            </div>
          </section>
        ) : (
          <button
            onClick={() => showUpgrade(active.length >= FREE_ITEM_LIMIT ? "limit" : "recap")}
            className="w-full rounded-3xl bg-card p-4 text-left shadow-soft transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Upgrade to Premium</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Unlimited items, stronger reminders, richer recap.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface/70 px-3 py-2 text-[11px]">
              <span className="text-muted-foreground">Active items</span>
              <span className="tabular-nums font-medium text-foreground">
                {active.length} / {FREE_ITEM_LIMIT}
              </span>
            </div>
          </button>
        )}

        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reminders
          </h2>
          <div className="divide-y divide-border/60 rounded-3xl bg-card shadow-soft">
            <Row icon={<Bell className="h-4 w-4" />} label="Push notifications" right={<Switch checked={push} onCheckedChange={setPush} />} />
            <Row icon={<Mail className="h-4 w-4" />} label="Email digest" right={<Switch checked={email} onCheckedChange={setEmail} />} />
            <Row icon={<Moon className="h-4 w-4" />} label="Quiet hours (9pm – 8am)" right={<Switch checked={quiet} onCheckedChange={setQuiet} />} />
          </div>
        </section>

        {/* Timing */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            When to nudge
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {(["morning", "afternoon", "evening"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTiming(t)}
                className={`rounded-2xl bg-card py-3 text-sm font-medium capitalize shadow-soft transition-all ${
                  timing === t ? "ring-2 ring-primary/30 text-primary" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What you want to catch
          </h2>
          <div className="divide-y divide-border/60 rounded-3xl bg-card shadow-soft">
            {cats.map((c) => (
              <div key={c} className="flex items-center gap-3 p-3">
                <CategoryIconCircle category={c} />
                <span className="flex-1 text-sm font-medium">{categoryMeta[c].label}</span>
                <Switch
                  checked={enabledCats[c]}
                  onCheckedChange={(v) => setEnabledCats((p) => ({ ...p, [c]: v }))}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-primary-soft p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-base text-foreground">Undo, calmly</p>
              <p className="mt-1 text-xs text-foreground/70">
                We'll only nudge you when there's still time to fix something. Never just to remind you that you exist.
              </p>
            </div>
          </div>
        </section>

        <button
          onClick={() => {
            onboarding.reset();
            navigate("/onboarding");
          }}
          className="flex w-full items-center gap-3 rounded-3xl bg-card p-4 text-left shadow-soft transition-all active:scale-[0.99]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground/70">
            <PlayCircle className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Replay the intro</p>
            <p className="text-[11.5px] text-muted-foreground">See how Undo works again, in 30 seconds.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <p className="pt-2 text-center text-[11px] text-muted-foreground">Undo · v1.0</p>
      </div>
    </MobileShell>
  );
};

function Row({ icon, label, right }: { icon: React.ReactNode; label: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground/70">
        {icon}
      </span>
      <span className="flex-1 text-sm">{label}</span>
      {right}
    </div>
  );
}

export default Settings;
