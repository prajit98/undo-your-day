import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useUndo } from "@/context/UndoContext";

export const FREE_ITEM_LIMIT = 5;
export const FREE_REMINDERS_PER_ITEM = 1;

export type UpgradeReason = "limit" | "reminders" | "recap" | "history" | null;

interface PremiumContextValue {
  isPremium: boolean;
  setPremium: (value: boolean) => Promise<void>;
  upgradeReason: UpgradeReason;
  showUpgrade: (reason: Exclude<UpgradeReason, null>) => void;
  closeUpgrade: () => void;
  activeItemCount: number;
  availableActiveSlots: number;
  canCreateActiveItems: (count?: number) => boolean;
  reminderCounts: Record<string, number>;
  registerReminder: (itemId: string) => Promise<boolean>;
  removeReminder: (itemId: string) => void;
}

const Ctx = createContext<PremiumContextValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { active, reminders, preferences, addExtraReminder, updatePreferences } = useUndo();
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason>(null);

  const isPremium = preferences?.planTier === "premium";
  const activeItemCount = active.length;
  const availableActiveSlots = isPremium
    ? Number.POSITIVE_INFINITY
    : Math.max(0, FREE_ITEM_LIMIT - activeItemCount);

  const reminderCounts = useMemo<Record<string, number>>(
    () =>
      reminders.reduce<Record<string, number>>((counts, reminder) => {
        if (reminder.status !== "scheduled") return counts;
        counts[reminder.undoItemId] = (counts[reminder.undoItemId] ?? 0) + 1;
        return counts;
      }, {}),
    [reminders],
  );

  const showUpgrade = useCallback((reason: Exclude<UpgradeReason, null>) => {
    setUpgradeReason(reason);
  }, []);

  const closeUpgrade = useCallback(() => setUpgradeReason(null), []);

  const canCreateActiveItems = useCallback(
    (count = 1) => {
      if (isPremium || activeItemCount + count <= FREE_ITEM_LIMIT) {
        return true;
      }
      setUpgradeReason("limit");
      return false;
    },
    [isPremium, activeItemCount],
  );

  const setPremium = useCallback(
    async (value: boolean) => {
      await updatePreferences({ planTier: value ? "premium" : "free" });
    },
    [updatePreferences],
  );

  const registerReminder = useCallback(
    async (itemId: string) => {
      const current = reminderCounts[itemId] ?? 0;

      if (!isPremium && current >= FREE_REMINDERS_PER_ITEM) {
        setUpgradeReason("reminders");
        return false;
      }

      return addExtraReminder(itemId);
    },
    [isPremium, reminderCounts, addExtraReminder],
  );

  const removeReminder = useCallback(() => {
    // Reminder removal is not exposed in V1 yet.
  }, []);

  const value = useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      setPremium,
      upgradeReason,
      showUpgrade,
      closeUpgrade,
      activeItemCount,
      availableActiveSlots,
      canCreateActiveItems,
      reminderCounts,
      registerReminder,
      removeReminder,
    }),
    [
      isPremium,
      setPremium,
      upgradeReason,
      showUpgrade,
      closeUpgrade,
      activeItemCount,
      availableActiveSlots,
      canCreateActiveItems,
      reminderCounts,
      registerReminder,
      removeReminder,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePremium() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePremium must be used inside PremiumProvider");
  return ctx;
}
