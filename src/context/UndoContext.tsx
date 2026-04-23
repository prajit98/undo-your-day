import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { appRepository } from "@/lib/persistence";
import { autoCategories } from "@/lib/onboarding";
import { policyFor } from "@/lib/reminders";
import {
  Category,
  CreateReminderInput,
  CreateUndoItemInput,
  GmailConnection,
  ItemStatus,
  UndoItem,
  UndoPreferences,
  UndoProfile,
  UndoReminder,
  UndoUpload,
  createDefaultPreferences,
  isActiveUndoItem,
} from "@/lib/undo-data";

interface UndoContextValue {
  ready: boolean;
  profile: UndoProfile | null;
  preferences: UndoPreferences | null;
  gmailConnection: GmailConnection | null;
  items: UndoItem[];
  reminders: UndoReminder[];
  uploads: UndoUpload[];
  refresh: () => Promise<void>;
  setStatus: (id: string, status: ItemStatus) => Promise<void>;
  snooze: (id: string, hours: number) => Promise<void>;
  addItem: (item: CreateUndoItemInput) => Promise<UndoItem | null>;
  addExtraReminder: (itemId: string) => Promise<boolean>;
  byCategory: (cat: Category) => UndoItem[];
  active: UndoItem[];
  updatePreferences: (patch: Partial<UndoPreferences>) => Promise<void>;
  onboarding: {
    isComplete: boolean;
    hasFirstCapture: boolean;
    gmailConnected: boolean;
    pickedCategories: Category[];
    complete: () => Promise<void>;
    reset: () => Promise<void>;
    savePrefs: (cats: Category[]) => Promise<void>;
    setGmailConnected: (value: boolean) => Promise<void>;
    markFirstCapture: () => Promise<void>;
  };
}

const Ctx = createContext<UndoContextValue | null>(null);

function sortByDateAsc<T extends { remindAt: string }>(values: T[]) {
  return [...values].sort((left, right) => +new Date(left.remindAt) - +new Date(right.remindAt));
}

function mergeItemReminderState(items: UndoItem[], reminders: UndoReminder[]) {
  return items.map((item) => {
    const scheduled = sortByDateAsc(
      reminders.filter((reminder) => reminder.undoItemId === item.id && reminder.status === "scheduled"),
    );
    return {
      ...item,
      remindAt: scheduled[0]?.remindAt,
    };
  });
}

function reminderInputsForItem(item: UndoItem, planTier: UndoPreferences["planTier"]): CreateReminderInput[] {
  if (item.status !== "active") {
    return [];
  }

  const policy = policyFor(item.category);
  const offsets = planTier === "premium" ? policy.premium.offsetsHrs : policy.free.offsetsHrs;
  const dueAtMs = new Date(item.dueAt).getTime();

  const remindTimes = offsets
    .map((offset, index) => ({
      remindAt: new Date(dueAtMs - offset * 36e5).toISOString(),
      reminderType: index === 0 ? "default" : "premium",
      status: "scheduled" as const,
      channel: "in_app" as const,
    }))
    .filter((reminder, index, current) =>
      current.findIndex((candidate) => candidate.remindAt === reminder.remindAt) === index,
    );

  if (remindTimes.length > 0) {
    return remindTimes;
  }

  return [
    {
      remindAt: new Date(Math.max(Date.now() + 36e5, dueAtMs - 36e5)).toISOString(),
      reminderType: "default",
      status: "scheduled",
      channel: "in_app",
    },
  ];
}

function nextExtraReminderForItem(item: UndoItem, existing: UndoReminder[]): CreateReminderInput {
  const policy = policyFor(item.category);
  const dueAtMs = new Date(item.dueAt).getTime();
  const existingTimes = new Set(
    existing
      .filter((reminder) => reminder.status === "scheduled")
      .map((reminder) => new Date(reminder.remindAt).toISOString()),
  );

  const nextPolicyTime = policy.premium.offsetsHrs
    .map((offset) => new Date(dueAtMs - offset * 36e5).toISOString())
    .find((iso) => !existingTimes.has(iso) && new Date(iso).getTime() > Date.now());

  if (nextPolicyTime) {
    return {
      remindAt: nextPolicyTime,
      reminderType: "premium",
      status: "scheduled",
      channel: "in_app",
    };
  }

  return {
    remindAt: new Date(Math.max(Date.now() + 36e5, Math.min(dueAtMs - 36e5, Date.now() + 12 * 36e5))).toISOString(),
    reminderType: "manual",
    status: "scheduled",
    channel: "in_app",
  };
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UndoProfile | null>(null);
  const [preferences, setPreferences] = useState<UndoPreferences | null>(null);
  const [gmailConnection, setGmailConnection] = useState<GmailConnection | null>(null);
  const [storedItems, setStoredItems] = useState<UndoItem[]>([]);
  const [reminders, setReminders] = useState<UndoReminder[]>([]);
  const [uploads, setUploads] = useState<UndoUpload[]>([]);

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof appRepository.loadSnapshot>>) => {
    setProfile(snapshot.profile);
    setPreferences(snapshot.preferences);
    setGmailConnection(snapshot.gmailConnection);
    setStoredItems(snapshot.items);
    setReminders(snapshot.reminders);
    setUploads(snapshot.uploads);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!authReady) {
      return;
    }

    if (!user) {
      setProfile(null);
      setPreferences(null);
      setGmailConnection(null);
      setStoredItems([]);
      setReminders([]);
      setUploads([]);
      setReady(true);
      return;
    }

    setReady(false);

    appRepository.loadSnapshot(user)
      .then((snapshot) => {
        if (cancelled) return;
        applySnapshot(snapshot);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(user);
        setPreferences(createDefaultPreferences(user.id));
        setGmailConnection(null);
        setStoredItems([]);
        setReminders([]);
        setUploads([]);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authReady, applySnapshot]);

  const items = useMemo(
    () => mergeItemReminderState(storedItems, reminders),
    [storedItems, reminders],
  );

  const active = useMemo(() => items.filter(isActiveUndoItem), [items]);

  const byCategory = useCallback(
    (category: Category) => items.filter((item) => item.category === category && isActiveUndoItem(item)),
    [items],
  );

  const updatePreferences = useCallback(
    async (patch: Partial<UndoPreferences>) => {
      if (!user || !preferences) return;
      const next = await appRepository.updatePreferences(user.id, patch);
      setPreferences(next);
    },
    [user, preferences],
  );

  const replaceItemReminders = useCallback(
    async (itemId: string, nextReminders: CreateReminderInput[]) => {
      if (!user) return { reminders: [] as UndoReminder[], item: null as UndoItem | null };

      const savedReminders = await appRepository.replaceReminders(user.id, itemId, nextReminders);
      setReminders((current) => current.filter((reminder) => reminder.undoItemId !== itemId).concat(savedReminders));

      const nextRemindAt = sortByDateAsc(savedReminders)[0]?.remindAt;
      setStoredItems((current) => current.map((item) => (
        item.id === itemId ? { ...item, remindAt: nextRemindAt } : item
      )));

      try {
        const savedItem = await appRepository.updateUndoItem(user.id, itemId, {
          remindAt: nextRemindAt,
        });
        setStoredItems((current) => current.map((item) => (item.id === itemId ? savedItem : item)));
        return { reminders: savedReminders, item: savedItem };
      } catch {
        return { reminders: savedReminders, item: null };
      }
    },
    [user],
  );

  const setStatus = useCallback(
    async (id: string, status: ItemStatus) => {
      if (!user) return;
      const nextItem = await appRepository.updateUndoItem(user.id, id, {
        status,
        remindAt: undefined,
      });
      setStoredItems((current) => current.map((item) => (item.id === id ? nextItem : item)));

      if (status !== "active") {
        await replaceItemReminders(id, []);
      }
    },
    [user, replaceItemReminders],
  );

  const snooze = useCallback(
    async (id: string, hours: number) => {
      if (!user) return;
      const currentItem = items.find((item) => item.id === id);
      if (!currentItem) return;

      const remindAt = new Date(Date.now() + hours * 36e5).toISOString();
      const nextItem = await appRepository.updateUndoItem(user.id, id, {
        status: "active",
        remindAt,
      });
      setStoredItems((current) => current.map((item) => (item.id === id ? nextItem : item)));
      await replaceItemReminders(id, [
        {
          remindAt,
          reminderType: "snooze",
          status: "scheduled",
          channel: "in_app",
        },
      ]);
    },
    [user, items, replaceItemReminders],
  );

  const addItem = useCallback(
    async (input: CreateUndoItemInput) => {
      if (!user || !preferences) return null;

      const createdItem = await appRepository.createUndoItem(user.id, input);
      setStoredItems((current) => [createdItem, ...current]);
      const reminderInputs = input.remindAt
        ? [{
            remindAt: input.remindAt,
            reminderType: "manual" as const,
            status: "scheduled" as const,
            channel: "in_app" as const,
          }]
        : reminderInputsForItem(createdItem, preferences.planTier);
      const { item: syncedItem } = await replaceItemReminders(createdItem.id, reminderInputs);

      if (input.upload) {
        try {
          const upload = await appRepository.createUpload(user.id, input.upload);
          setUploads((current) => [upload, ...current]);
        } catch {
          // Upload logs support the product, but the saved item itself is the source of truth.
        }
      }

      return syncedItem ?? createdItem;
    },
    [user, preferences, replaceItemReminders],
  );

  const addExtraReminder = useCallback(
    async (itemId: string) => {
      if (!user) return false;
      const item = items.find((entry) => entry.id === itemId);
      if (!item) return false;

      const existing = reminders.filter((reminder) => reminder.undoItemId === itemId);
      const nextReminder = nextExtraReminderForItem(item, existing);
      await replaceItemReminders(
        itemId,
        existing
          .filter((reminder) => reminder.status === "scheduled")
          .map((reminder) => ({
            remindAt: reminder.remindAt,
            reminderType: reminder.reminderType,
            status: reminder.status,
            channel: reminder.channel,
          }))
          .concat(nextReminder),
      );
      return true;
    },
    [user, items, reminders, replaceItemReminders],
  );

  const onboarding = useMemo(
    () => ({
      isComplete: Boolean(preferences?.onboardingCompleted),
      hasFirstCapture: Boolean(preferences?.firstCaptureCompleted),
      gmailConnected: Boolean(gmailConnection),
      pickedCategories: (() => {
        const picked = preferences?.enabledCategories.filter((category) => autoCategories.includes(category));
        return picked && picked.length > 0 ? picked : autoCategories;
      })(),
      complete: async () => {
        await updatePreferences({ onboardingCompleted: true });
      },
      reset: async () => {
        await updatePreferences({
          onboardingCompleted: false,
          firstCaptureCompleted: false,
        });
      },
      savePrefs: async (cats: Category[]) => {
        if (!preferences) return;
        const followupEnabled = preferences.enabledCategories.includes("followup");
        const enabledCategories = followupEnabled ? [...cats, "followup"] : cats;
        await updatePreferences({ enabledCategories });
      },
      setGmailConnected: async (value: boolean) => {
        await updatePreferences({ gmailConnected: value });
      },
      markFirstCapture: async () => {
        await updatePreferences({ firstCaptureCompleted: true });
      },
    }),
    [preferences, gmailConnection, updatePreferences],
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    const snapshot = await appRepository.loadSnapshot(user);
    applySnapshot(snapshot);
  }, [user, applySnapshot]);

  const value = useMemo<UndoContextValue>(
    () => ({
      ready,
      profile,
      preferences,
      gmailConnection,
      items,
      reminders,
      uploads,
      refresh,
      setStatus,
      snooze,
      addItem,
      addExtraReminder,
      byCategory,
      active,
      updatePreferences,
      onboarding,
    }),
    [
      ready,
      profile,
      preferences,
      gmailConnection,
      items,
      reminders,
      uploads,
      refresh,
      setStatus,
      snooze,
      addItem,
      addExtraReminder,
      byCategory,
      active,
      updatePreferences,
      onboarding,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUndo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUndo must be used inside UndoProvider");
  return ctx;
}
