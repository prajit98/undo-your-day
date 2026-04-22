import { useNavigate } from "react-router-dom";
import {
  Bell, Mail, ChevronRight, Sparkles, PlayCircle, ShieldCheck, Check, Lock, LogOut, UserRound,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { Switch } from "@/components/ui/switch";
import { CategoryIconCircle } from "@/components/CategoryBadge";
import { useAuth } from "@/context/AuthContext";
import { usePremium, FREE_ITEM_LIMIT } from "@/context/PremiumContext";
import { useUndo } from "@/context/UndoContext";
import { autoCategories } from "@/lib/onboarding";
import { reminderPolicy } from "@/lib/reminders";
import { categoryMeta, Category } from "@/lib/undo-data";
import { toast } from "sonner";

const cats: Category[] = ["trial", "renewal", "return", "bill", "followup"];

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isPremium } = usePremium();
  const { active, preferences, onboarding, updatePreferences } = useUndo();

  if (!preferences) {
    return null;
  }

  const accountName = user?.name?.trim() || user?.email?.trim() || "Signed in";
  const accountMeta = user?.name?.trim() ? user?.email?.trim() ?? null : null;
  const watchedByGmail = onboarding.pickedCategories.length > 0 ? onboarding.pickedCategories : autoCategories;
  const enabledCats = preferences.enabledCategories;

  const toggleCategory = async (category: Category, enabled: boolean) => {
    const next = enabled
      ? Array.from(new Set([...enabledCats, category]))
      : enabledCats.filter((entry) => entry !== category);

    await updatePreferences({ enabledCategories: next });
  };

  const disconnectGmail = async () => {
    await onboarding.setGmailConnected(false);
    toast.success("Gmail flow turned off.", {
      duration: 2400,
    });
  };

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Preferences
        </p>
        <h1 className="mt-3 font-display text-[36px] leading-[1.05] tracking-snug">Tune Undo.</h1>
      </header>

      <div className="mt-6 space-y-6 px-5">
        <section className="rounded-3xl bg-card p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-foreground/70">
              <UserRound className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{accountName}</p>
              {accountMeta && (
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {accountMeta}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={async () => {
              await signOut();
              toast.success("Signed out.");
              navigate("/auth", { replace: true });
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-[13px] font-medium text-background shadow-soft transition-transform active:scale-[0.99]"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.9} />
            Log out
          </button>
        </section>

        <section className="rounded-3xl bg-card p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Mail className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {onboarding.gmailConnected ? "Gmail flow on" : "Gmail flow off"}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {onboarding.gmailConnected
                      ? "A narrow, review-first Gmail flow."
                      : "See how Gmail fits into Undo."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                  {onboarding.gmailConnected ? "Review-first" : "Off"}
                </span>
              </div>

              <div className="mt-3 rounded-2xl bg-surface/70 px-3 py-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Gmail scope
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">
                  {formatCategoryList(watchedByGmail)}
                </p>
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {onboarding.gmailConnected
                  ? "Automatic Gmail detection is not live yet. Undo keeps the scope narrow and review-first."
                  : "Undo stays focused on those categories — and still waits for your review before anything is kept."}
              </p>
            </div>
          </div>

          <button
            onClick={() => (onboarding.gmailConnected ? disconnectGmail() : navigate("/onboarding"))}
            className="mt-4 w-full rounded-full bg-foreground py-3.5 text-[13px] font-medium text-background shadow-soft transition-transform active:scale-[0.99]"
          >
            {onboarding.gmailConnected ? "Turn off Gmail flow" : "See Gmail flow"}
          </button>
        </section>

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
          <section className="w-full rounded-3xl bg-card p-4 text-left shadow-soft">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Free protection</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Up to 5 active items, with one calm reminder per item.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-surface/70 px-3 py-2 text-[11px]">
              <span className="text-muted-foreground">Active items</span>
              <span className="tabular-nums font-medium text-foreground">
                {active.length} / {FREE_ITEM_LIMIT}
              </span>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reminder delivery
          </h2>
          <div className="rounded-3xl bg-card p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-foreground/70">
                <Bell className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">In-app reminders</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  Undo keeps reminder timing calm and category-aware in the app.
                </p>

                <div className="mt-3 rounded-2xl bg-surface/70 px-3 py-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Delivery channels
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/80">
                    Push and email delivery are not live yet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-end justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reminder rhythm
            </h2>
            <span className="text-[10.5px] text-muted-foreground">
              {isPremium ? "Premium" : "Free"}
            </span>
          </div>
          <div className="divide-y divide-border/60 rounded-3xl bg-card shadow-soft">
            {cats.map((category) => {
              const policy = reminderPolicy[category];
              const schedule = isPremium ? policy.premium : policy.free;

              return (
                <div key={category} className="flex items-start gap-3 p-3.5">
                  <CategoryIconCircle category={category} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium leading-tight text-foreground">
                      {categoryMeta[category].label}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                      {policy.principle}
                    </p>
                    <p className="mt-1 text-[10.5px] text-muted-foreground/80">
                      {schedule.cadence}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground">
            {isPremium
              ? "Undo times reminders by category and keeps a last-chance in-app nudge for tighter deadlines."
              : "Undo picks one calm in-app reminder by category. Premium adds earlier nudges and a last-chance reminder when timing gets tight."}
          </p>
        </section>

        <section>
          <div className="mb-2 px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What you want to catch
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Gmail stays focused on Trials, Renewals, Returns, and Bills. Follow-ups stay manual for now.
            </p>
          </div>
          <div className="divide-y divide-border/60 rounded-3xl bg-card shadow-soft">
            {cats.map((category) => (
              <div key={category} className="flex items-center gap-3 p-3">
                <CategoryIconCircle category={category} />
                <span className="flex-1 text-sm font-medium">{categoryMeta[category].label}</span>
                <Switch
                  checked={enabledCats.includes(category)}
                  onCheckedChange={(value) => void toggleCategory(category, value)}
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
                Undo only surfaces reminders when there is still time to fix something. Never just to prove it’s paying attention.
              </p>
            </div>
          </div>
        </section>

        <button
          onClick={async () => {
            await onboarding.reset();
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

        <p className="pt-2 text-center text-[11px] text-muted-foreground">Undo / v1.0</p>
      </div>
    </MobileShell>
  );
};

function formatCategoryList(categories: Category[]) {
  const labels = categories.map((category) => `${categoryMeta[category].label}s`);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export default Settings;
