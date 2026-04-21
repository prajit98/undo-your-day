import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

export const FREE_ITEM_LIMIT = 5;
export const FREE_REMINDERS_PER_ITEM = 1;

export type UpgradeReason = "limit" | "reminders" | "recap" | "history" | null;

interface PremiumContextValue {
  isPremium: boolean;
  setPremium: (v: boolean) => void;
  upgradeReason: UpgradeReason;
  showUpgrade: (reason: Exclude<UpgradeReason, null>) => void;
  closeUpgrade: () => void;
  reminderCounts: Record<string, number>;
  registerReminder: (itemId: string) => boolean; // returns true if allowed
  removeReminder: (itemId: string) => void;
}

const Ctx = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>(null);
  const [reminderCounts, setReminderCounts] = useState<Record<string, number>>({});

  const showUpgrade = useCallback((reason: Exclude<UpgradeReason, null>) => {
    setUpgradeReason(reason);
  }, []);

  const closeUpgrade = useCallback(() => setUpgradeReason(null), []);

  const registerReminder = useCallback(
    (itemId: string) => {
      const current = reminderCounts[itemId] ?? 1; // default reminder is on
      if (!isPremium && current >= FREE_REMINDERS_PER_ITEM) {
        setUpgradeReason("reminders");
        return false;
      }
      setReminderCounts((p) => ({ ...p, [itemId]: current + 1 }));
      return true;
    },
    [isPremium, reminderCounts],
  );

  const removeReminder = useCallback((itemId: string) => {
    setReminderCounts((p) => {
      const next = { ...p };
      const c = (next[itemId] ?? 1) - 1;
      if (c <= 0) delete next[itemId];
      else next[itemId] = c;
      return next;
    });
  }, []);

  const value = useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      setPremium: setIsPremium,
      upgradeReason,
      showUpgrade,
      closeUpgrade,
      reminderCounts,
      registerReminder,
      removeReminder,
    }),
    [isPremium, upgradeReason, showUpgrade, closeUpgrade, reminderCounts, registerReminder, removeReminder],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePremium() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePremium must be used inside PremiumProvider");
  return ctx;
}
