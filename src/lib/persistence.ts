import { createClient, type User } from "@supabase/supabase-js";
import {
  AppSnapshot,
  Category,
  CreateReminderInput,
  CreateUndoItemInput,
  GmailConnection,
  UndoItem,
  UndoPreferences,
  UndoProfile,
  UndoReminder,
  UndoUpload,
  createDefaultPreferences,
} from "./undo-data";
import type { Candidate } from "./candidates";
import { appConfig, backendSetupError, type AppBackendMode } from "./app-config";
import { urgencyFor } from "./urgency";

const LOCAL_DB_KEY = "undo.app.db.v1";
const PASSWORD_HASH_PREFIX = "sha256:";

type AuthResult = {
  user: UndoProfile;
  requiresEmailConfirmation?: boolean;
};

type StoredUser = UndoProfile & { password: string };

interface LocalDb {
  users: StoredUser[];
  currentUserId: string | null;
  undoItems: UndoItem[];
  reminders: UndoReminder[];
  uploads: UndoUpload[];
  preferences: UndoPreferences[];
}

export interface AppRepository {
  backend: AppBackendMode;
  auth: {
    getCurrentUser: () => Promise<UndoProfile | null>;
    onAuthStateChange: (callback: (user: UndoProfile | null) => void) => () => void;
    signUp: (input: { email: string; password: string; name: string }) => Promise<AuthResult>;
    signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
    signOut: () => Promise<void>;
  };
  loadSnapshot: (user: UndoProfile) => Promise<AppSnapshot>;
  updatePreferences: (userId: string, patch: Partial<UndoPreferences>) => Promise<UndoPreferences>;
  createUndoItem: (userId: string, input: CreateUndoItemInput) => Promise<UndoItem>;
  updateUndoItem: (userId: string, itemId: string, patch: Partial<UndoItem>) => Promise<UndoItem>;
  replaceReminders: (
    userId: string,
    itemId: string,
    reminders: CreateReminderInput[],
  ) => Promise<UndoReminder[]>;
  createUpload: (
    userId: string,
    input: { fileType: UndoUpload["fileType"]; extractedText?: string },
  ) => Promise<UndoUpload>;
  gmail: {
    getAuthorizationUrl: (input: { returnTo: "/onboarding" | "/settings" }) => Promise<string>;
    syncCandidates: () => Promise<Candidate[]>;
    disconnect: () => Promise<void>;
  };
}

const subscribers = new Set<(user: UndoProfile | null) => void>();

function emptyLocalDb(): LocalDb {
  return {
    users: [],
    currentUserId: null,
    undoItems: [],
    reminders: [],
    uploads: [],
    preferences: [],
  };
}

function emitAuthChange(user: UndoProfile | null) {
  subscribers.forEach((callback) => callback(user));
}

function readLocalDb(): LocalDb {
  if (typeof window === "undefined") {
    return emptyLocalDb();
  }

  const raw = window.localStorage.getItem(LOCAL_DB_KEY);
  if (!raw) {
    return emptyLocalDb();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      currentUserId: typeof parsed.currentUserId === "string" ? parsed.currentUserId : null,
      undoItems: Array.isArray(parsed.undoItems) ? parsed.undoItems : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
    };
  } catch {
    return emptyLocalDb();
  }
}

function writeLocalDb(db: LocalDb) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

function stripPassword(user: StoredUser): UndoProfile {
  const { password: _password, ...rest } = user;
  return rest;
}

async function hashLocalPassword(password: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return password;
  }

  const bytes = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return `${PASSWORD_HASH_PREFIX}${hex}`;
}

function normalizePreferences(preferences: UndoPreferences): UndoPreferences {
  const defaults = createDefaultPreferences(preferences.userId);
  const validCategories = new Set<Category>(defaults.enabledCategories);
  const enabledCategories = Array.isArray(preferences.enabledCategories)
    ? preferences.enabledCategories.filter((category): category is Category =>
        typeof category === "string" && validCategories.has(category as Category),
      )
    : defaults.enabledCategories;

  return {
    ...defaults,
    ...preferences,
    notificationTime: preferences.notificationTime ?? defaults.notificationTime,
    enabledCategories: enabledCategories.length > 0
      ? Array.from(new Set(enabledCategories))
      : defaults.enabledCategories,
    onboardingCompleted: Boolean(preferences.onboardingCompleted),
    gmailConnected: Boolean(preferences.gmailConnected),
    planTier: preferences.planTier === "premium" ? "premium" : "free",
    pushEnabled: preferences.pushEnabled ?? defaults.pushEnabled,
    emailDigestEnabled: preferences.emailDigestEnabled ?? defaults.emailDigestEnabled,
    quietHoursEnabled: preferences.quietHoursEnabled ?? defaults.quietHoursEnabled,
    firstCaptureCompleted: Boolean(preferences.firstCaptureCompleted),
    createdAt: preferences.createdAt ?? defaults.createdAt,
    updatedAt: preferences.updatedAt ?? defaults.updatedAt,
  };
}

function mapItem(item: UndoItem): UndoItem {
  return {
    ...item,
    merchantName: item.merchantName ?? item.source,
    source: item.source ?? item.merchantName,
  };
}

function buildLocalRepository(): AppRepository {
  return {
    backend: "local",
    auth: {
      async getCurrentUser() {
        const db = readLocalDb();
        const current = db.users.find((user) => user.id === db.currentUserId);
        return current ? stripPassword(current) : null;
      },
      onAuthStateChange(callback) {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
      async signUp({ email, password, name }) {
        const normalizedEmail = email.trim().toLowerCase();
        const db = readLocalDb();

        if (db.users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
          throw new Error("That email already has an Undo account.");
        }

        const user: StoredUser = {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          name: name.trim() || normalizedEmail.split("@")[0],
          createdAt: new Date().toISOString(),
          password: await hashLocalPassword(password),
        };

        db.users.push(user);
        db.currentUserId = user.id;
        db.preferences.push(createDefaultPreferences(user.id));
        writeLocalDb(db);
        emitAuthChange(stripPassword(user));

        return { user: stripPassword(user), requiresEmailConfirmation: false };
      },
      async signIn({ email, password }) {
        const normalizedEmail = email.trim().toLowerCase();
        const db = readLocalDb();
        const user = db.users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);

        if (!user) {
          throw new Error("That email and password do not match.");
        }

        const hashedPassword = await hashLocalPassword(password);
        const isLegacyPlainTextMatch = user.password === password;
        const isHashedMatch = user.password === hashedPassword;

        if (!isLegacyPlainTextMatch && !isHashedMatch) {
          throw new Error("That email and password do not match.");
        }

        if (isLegacyPlainTextMatch && user.password !== hashedPassword) {
          user.password = hashedPassword;
        }

        db.currentUserId = user.id;
        writeLocalDb(db);
        emitAuthChange(stripPassword(user));
        return { user: stripPassword(user) };
      },
      async signOut() {
        const db = readLocalDb();
        db.currentUserId = null;
        writeLocalDb(db);
        emitAuthChange(null);
      },
    },
    async loadSnapshot(user) {
      const db = readLocalDb();
      let preferences = db.preferences.find((entry) => entry.userId === user.id);

      if (!preferences) {
        preferences = createDefaultPreferences(user.id);
        db.preferences.push(preferences);
        writeLocalDb(db);
      }

      const normalizedPreferences = normalizePreferences(preferences);
      if (JSON.stringify(normalizedPreferences) !== JSON.stringify(preferences)) {
        db.preferences = db.preferences
          .filter((entry) => entry.userId !== user.id)
          .concat(normalizedPreferences);
        writeLocalDb(db);
      }

      return {
        profile: user,
        preferences: normalizedPreferences,
        items: db.undoItems.filter((item) => item.userId === user.id).map(mapItem),
        reminders: db.reminders.filter((reminder) =>
          db.undoItems.some((item) => item.id === reminder.undoItemId && item.userId === user.id)
        ),
        uploads: db.uploads.filter((upload) => upload.userId === user.id),
        gmailConnection: null,
      };
    },
    async updatePreferences(userId, patch) {
      const db = readLocalDb();
      const current = db.preferences.find((entry) => entry.userId === userId) ?? createDefaultPreferences(userId);
      const next = normalizePreferences({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });

      db.preferences = db.preferences.filter((entry) => entry.userId !== userId).concat(next);
      writeLocalDb(db);
      return next;
    },
    async createUndoItem(userId, input) {
      const now = new Date().toISOString();
      const item: UndoItem = mapItem({
        id: crypto.randomUUID(),
        userId,
        title: input.title,
        detail: input.detail,
        category: input.category,
        sourceType: input.sourceType ?? "manual",
        dueAt: input.dueAt,
        urgency: urgencyFor(input.category, input.dueAt).level,
        remindAt: input.remindAt,
        amountValue: input.amountValue,
        amount: input.amount,
        merchantName: input.merchantName ?? input.source,
        source: input.source ?? input.merchantName,
        note: input.note,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const db = readLocalDb();
      db.undoItems.unshift(item);
      writeLocalDb(db);
      return item;
    },
    async updateUndoItem(userId, itemId, patch) {
      const db = readLocalDb();
      const current = db.undoItems.find((item) => item.id === itemId && item.userId === userId);
      if (!current) {
        throw new Error("We could not find that Undo item.");
      }

      const next = mapItem({
        ...current,
        ...patch,
        urgency: urgencyFor(
          patch.category ?? current.category,
          patch.dueAt ?? current.dueAt,
        ).level,
        updatedAt: new Date().toISOString(),
      });

      db.undoItems = db.undoItems.map((item) => (item.id === itemId ? next : item));
      writeLocalDb(db);
      return next;
    },
    async replaceReminders(userId, itemId, reminders) {
      const db = readLocalDb();
      const ownsItem = db.undoItems.some((item) => item.id === itemId && item.userId === userId);
      if (!ownsItem) {
        throw new Error("We could not update reminders for that item.");
      }

      const createdAt = new Date().toISOString();
      const next = reminders.map((reminder) => ({
        id: crypto.randomUUID(),
        undoItemId: itemId,
        remindAt: reminder.remindAt,
        reminderType: reminder.reminderType,
        status: reminder.status ?? "scheduled",
        channel: reminder.channel ?? "in_app",
        createdAt,
      }));

      db.reminders = db.reminders.filter((reminder) => reminder.undoItemId !== itemId).concat(next);
      writeLocalDb(db);
      return next;
    },
    async createUpload(userId, input) {
      const upload: UndoUpload = {
        id: crypto.randomUUID(),
        userId,
        fileType: input.fileType,
        extractedText: input.extractedText,
        createdAt: new Date().toISOString(),
      };

      const db = readLocalDb();
      db.uploads.unshift(upload);
      writeLocalDb(db);
      return upload;
    },
    gmail: {
      async getAuthorizationUrl() {
        throw new Error("Real Gmail connection needs Supabase.");
      },
      async syncCandidates() {
        throw new Error("Real Gmail sync needs Supabase.");
      },
      async disconnect() {
        throw new Error("Real Gmail connection needs Supabase.");
      },
    },
  };
}

const supabaseUrl = appConfig.supabaseUrl;
const supabaseAnonKey = appConfig.supabaseAnonKey;
const hasSupabaseConfig = appConfig.hasSupabaseConfig;
const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

async function invokeSupabaseFunction<TResponse>(
  name: string,
  body?: Record<string, unknown>,
): Promise<TResponse> {
  if (!supabase || !supabaseUrl) {
    throw new Error("Supabase is not configured.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Please sign in again to continue.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message = typeof payload.error === "string"
      ? payload.error
      : `Undo could not complete ${name}.`;
    throw new Error(message);
  }

  return payload as TResponse;
}

function normalizeSupabaseUser(user: User): UndoProfile {
  return {
    id: user.id,
    email: user.email ?? "",
    name:
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
      (user.email?.split("@")[0] ?? "Undo user"),
    createdAt: user.created_at,
  };
}

function toSupabasePreferences(record: Record<string, unknown>): UndoPreferences {
  return normalizePreferences({
    id: String(record.id),
    userId: String(record.user_id),
    notificationTime: String(record.notification_time ?? "09:00"),
    enabledCategories: Array.isArray(record.enabled_categories)
      ? (record.enabled_categories as UndoPreferences["enabledCategories"])
      : ["trial", "renewal", "return", "bill", "followup"],
    onboardingCompleted: Boolean(record.onboarding_completed),
    gmailConnected: Boolean(record.gmail_connected),
    planTier: record.plan_tier === "premium" ? "premium" : "free",
    pushEnabled: record.push_enabled !== false,
    emailDigestEnabled: Boolean(record.email_digest_enabled),
    quietHoursEnabled: record.quiet_hours_enabled !== false,
    firstCaptureCompleted: Boolean(record.first_capture_completed),
    createdAt: String(record.created_at ?? new Date().toISOString()),
    updatedAt: String(record.updated_at ?? new Date().toISOString()),
  });
}

function toSupabaseItem(record: Record<string, unknown>): UndoItem {
  return mapItem({
    id: String(record.id),
    userId: String(record.user_id),
    title: String(record.title),
    detail: typeof record.detail === "string" ? record.detail : undefined,
    category: record.category as UndoItem["category"],
    sourceType: (record.source_type as UndoItem["sourceType"]) ?? "manual",
    dueAt: String(record.due_date),
    urgency: typeof record.urgency === "string" ? record.urgency : undefined,
    remindAt: typeof record.remind_at === "string" ? record.remind_at : undefined,
    amountValue: typeof record.amount === "number" ? record.amount : undefined,
    amount: typeof record.amount_display === "string" ? record.amount_display : undefined,
    merchantName: typeof record.merchant_name === "string" ? record.merchant_name : undefined,
    source: typeof record.source_label === "string" ? record.source_label : undefined,
    note: typeof record.notes === "string" ? record.notes : undefined,
    status: record.status as UndoItem["status"],
    createdAt: typeof record.created_at === "string" ? record.created_at : undefined,
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : undefined,
  });
}

function toSupabaseReminder(record: Record<string, unknown>): UndoReminder {
  return {
    id: String(record.id),
    undoItemId: String(record.undo_item_id),
    remindAt: String(record.remind_at),
    reminderType: record.reminder_type as UndoReminder["reminderType"],
    status: record.status as UndoReminder["status"],
    channel: record.channel as UndoReminder["channel"],
    createdAt: String(record.created_at),
  };
}

function toSupabaseUpload(record: Record<string, unknown>): UndoUpload {
  return {
    id: String(record.id),
    userId: String(record.user_id),
    fileType: record.file_type as UndoUpload["fileType"],
    extractedText: typeof record.extracted_text === "string" ? record.extracted_text : undefined,
    createdAt: String(record.created_at),
  };
}

function toSupabaseGmailConnection(record: Record<string, unknown>): GmailConnection {
  return {
    userId: String(record.user_id),
    email: String(record.gmail_email),
    scope: Array.isArray(record.scope)
      ? record.scope.filter((entry): entry is string => typeof entry === "string")
      : [],
    connectedAt: String(record.connected_at),
    lastSyncedAt: typeof record.last_synced_at === "string" ? record.last_synced_at : undefined,
    lastSyncStatus: record.last_sync_status === "error"
      ? "error"
      : record.last_sync_status === "synced"
        ? "synced"
        : "connected",
    lastSyncError: typeof record.last_sync_error === "string" ? record.last_sync_error : undefined,
    createdAt: String(record.created_at ?? record.connected_at ?? new Date().toISOString()),
    updatedAt: String(record.updated_at ?? record.connected_at ?? new Date().toISOString()),
  };
}

async function ensureSupabaseProfile(user: UndoProfile) {
  if (!supabase) return;

  const { data: existingPreferences, error: preferenceError } = await supabase
    .from("preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (preferenceError) {
    throw new Error(preferenceError.message);
  }

  if (!existingPreferences) {
    const preferences = createDefaultPreferences(user.id);
    const { error: insertError } = await supabase.from("preferences").insert({
      id: preferences.id,
      user_id: preferences.userId,
      notification_time: preferences.notificationTime,
      enabled_categories: preferences.enabledCategories,
      onboarding_completed: preferences.onboardingCompleted,
      gmail_connected: preferences.gmailConnected,
      plan_tier: preferences.planTier,
      push_enabled: preferences.pushEnabled,
      email_digest_enabled: preferences.emailDigestEnabled,
      quiet_hours_enabled: preferences.quietHoursEnabled,
      first_capture_completed: preferences.firstCaptureCompleted,
      created_at: preferences.createdAt,
      updated_at: preferences.updatedAt,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

function buildSupabaseRepository(): AppRepository {
  return {
    backend: "supabase",
    auth: {
      async getCurrentUser() {
        if (!supabase) return null;
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          throw new Error(error.message);
        }
        return data.user ? normalizeSupabaseUser(data.user) : null;
      },
      onAuthStateChange(callback) {
        if (!supabase) return () => undefined;
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          callback(session?.user ? normalizeSupabaseUser(session.user) : null);
        });

        return () => subscription.unsubscribe();
      },
      async signUp({ email, password, name }) {
        if (!supabase) {
          throw new Error("Supabase is not configured.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });

        if (error || !data.user) {
          throw new Error(error?.message ?? "We could not create that Undo account.");
        }

        const user = normalizeSupabaseUser(data.user);
        if (data.session) {
          await ensureSupabaseProfile(user);
        }
        return { user, requiresEmailConfirmation: !data.session };
      },
      async signIn({ email, password }) {
        if (!supabase) {
          throw new Error("Supabase is not configured.");
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          throw new Error(error?.message ?? "We could not log you in.");
        }

        const user = normalizeSupabaseUser(data.user);
        await ensureSupabaseProfile(user);
        return { user };
      },
      async signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error(error.message);
        }
      },
    },
    async loadSnapshot(user) {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      await ensureSupabaseProfile(user);

      const [{ data: preferencesData, error: preferencesError }, { data: itemsData, error: itemsError }, { data: uploadsData, error: uploadsError }, { data: gmailConnectionData, error: gmailConnectionError }] = await Promise.all([
        supabase.from("preferences").select("*").eq("user_id", user.id).single(),
        supabase.from("undo_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("uploads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("gmail_connections").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (preferencesError) throw new Error(preferencesError.message);
      if (itemsError) throw new Error(itemsError.message);
      if (uploadsError) throw new Error(uploadsError.message);
      if (gmailConnectionError) throw new Error(gmailConnectionError.message);

      const itemIds = (itemsData ?? []).map((item) => item.id as string);
      const { data: reminderData, error: reminderError } = itemIds.length
        ? await supabase.from("reminders").select("*").in("undo_item_id", itemIds).order("created_at", { ascending: false })
        : { data: [], error: null };

      if (reminderError) throw new Error(reminderError.message);

      const gmailConnection = gmailConnectionData
        ? toSupabaseGmailConnection(gmailConnectionData as Record<string, unknown>)
        : null;
      const preferences = toSupabasePreferences({
        ...(preferencesData as Record<string, unknown>),
        gmail_connected: Boolean(gmailConnection),
      });

      return {
        profile: user,
        preferences,
        items: (itemsData ?? []).map((item) => toSupabaseItem(item as Record<string, unknown>)),
        reminders: (reminderData ?? []).map((reminder) => toSupabaseReminder(reminder as Record<string, unknown>)),
        uploads: (uploadsData ?? []).map((upload) => toSupabaseUpload(upload as Record<string, unknown>)),
        gmailConnection,
      };
    },
    async updatePreferences(userId, patch) {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data: current, error: currentError } = await supabase
        .from("preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (currentError) {
        throw new Error(currentError.message);
      }

      const next = toSupabasePreferences({
        ...current,
        ...("notificationTime" in patch ? { notification_time: patch.notificationTime } : {}),
        ...("enabledCategories" in patch ? { enabled_categories: patch.enabledCategories } : {}),
        ...("onboardingCompleted" in patch ? { onboarding_completed: patch.onboardingCompleted } : {}),
        ...("gmailConnected" in patch ? { gmail_connected: patch.gmailConnected } : {}),
        ...("planTier" in patch ? { plan_tier: patch.planTier } : {}),
        ...("pushEnabled" in patch ? { push_enabled: patch.pushEnabled } : {}),
        ...("emailDigestEnabled" in patch ? { email_digest_enabled: patch.emailDigestEnabled } : {}),
        ...("quietHoursEnabled" in patch ? { quiet_hours_enabled: patch.quietHoursEnabled } : {}),
        ...("firstCaptureCompleted" in patch ? { first_capture_completed: patch.firstCaptureCompleted } : {}),
        updated_at: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from("preferences")
        .update({
          notification_time: next.notificationTime,
          enabled_categories: next.enabledCategories,
          onboarding_completed: next.onboardingCompleted,
          gmail_connected: next.gmailConnected,
          plan_tier: next.planTier,
          push_enabled: next.pushEnabled,
          email_digest_enabled: next.emailDigestEnabled,
          quiet_hours_enabled: next.quietHoursEnabled,
          first_capture_completed: next.firstCaptureCompleted,
          updated_at: next.updatedAt,
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return toSupabasePreferences(data as Record<string, unknown>);
    },
    async createUndoItem(userId, input) {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data, error } = await supabase
        .from("undo_items")
        .insert({
          user_id: userId,
          title: input.title,
          detail: input.detail,
          category: input.category,
          source_type: input.sourceType ?? "manual",
          due_date: input.dueAt,
          urgency: urgencyFor(input.category, input.dueAt).level,
          amount: input.amountValue,
          amount_display: input.amount,
          merchant_name: input.merchantName ?? input.source,
          source_label: input.source ?? input.merchantName,
          status: "active",
          notes: input.note,
          remind_at: input.remindAt,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return toSupabaseItem(data as Record<string, unknown>);
    },
    async updateUndoItem(userId, itemId, patch) {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (!("urgency" in patch) && ("category" in patch || "dueAt" in patch)) {
        const { data: currentItem, error: currentError } = await supabase
          .from("undo_items")
          .select("category, due_date")
          .eq("id", itemId)
          .eq("user_id", userId)
          .single();

        if (currentError) {
          throw new Error(currentError.message);
        }

        updatePayload.urgency = urgencyFor(
          (patch.category ?? currentItem.category) as UndoItem["category"],
          String(patch.dueAt ?? currentItem.due_date),
        ).level;
      }

      if ("title" in patch) updatePayload.title = patch.title;
      if ("detail" in patch) updatePayload.detail = patch.detail ?? null;
      if ("category" in patch) updatePayload.category = patch.category;
      if ("sourceType" in patch) updatePayload.source_type = patch.sourceType;
      if ("dueAt" in patch) updatePayload.due_date = patch.dueAt;
      if ("urgency" in patch) updatePayload.urgency = patch.urgency ?? null;
      if ("remindAt" in patch) updatePayload.remind_at = patch.remindAt ?? null;
      if ("amountValue" in patch) updatePayload.amount = patch.amountValue ?? null;
      if ("amount" in patch) updatePayload.amount_display = patch.amount ?? null;
      if ("merchantName" in patch) updatePayload.merchant_name = patch.merchantName ?? null;
      if ("source" in patch) updatePayload.source_label = patch.source ?? null;
      if ("status" in patch) updatePayload.status = patch.status;
      if ("note" in patch) updatePayload.notes = patch.note ?? null;

      const { data, error } = await supabase
        .from("undo_items")
        .update(updatePayload)
        .eq("id", itemId)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return toSupabaseItem(data as Record<string, unknown>);
    },
    async replaceReminders(userId, itemId, reminders) {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data: item, error: itemError } = await supabase
        .from("undo_items")
        .select("id")
        .eq("id", itemId)
        .eq("user_id", userId)
        .maybeSingle();

      if (itemError || !item) {
        throw new Error(itemError?.message ?? "We could not update reminders for that item.");
      }

      const { error: deleteError } = await supabase
        .from("reminders")
        .delete()
        .eq("undo_item_id", itemId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (reminders.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("reminders")
        .insert(
          reminders.map((reminder) => ({
            undo_item_id: itemId,
            remind_at: reminder.remindAt,
            reminder_type: reminder.reminderType,
            status: reminder.status ?? "scheduled",
            channel: reminder.channel ?? "in_app",
          })),
        )
        .select("*");

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map((reminder) => toSupabaseReminder(reminder as Record<string, unknown>));
    },
    async createUpload(userId, input) {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data, error } = await supabase
        .from("uploads")
        .insert({
          user_id: userId,
          file_type: input.fileType,
          extracted_text: input.extractedText,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return toSupabaseUpload(data as Record<string, unknown>);
    },
    gmail: {
      async getAuthorizationUrl({ returnTo }) {
        const data = await invokeSupabaseFunction<{ url?: string }>("gmail-authorize", { returnTo });
        if (!data.url) {
          throw new Error("Undo could not start Gmail connection.");
        }
        return data.url;
      },
      async syncCandidates() {
        const data = await invokeSupabaseFunction<{ candidates?: Candidate[] }>("gmail-sync");
        return Array.isArray(data.candidates) ? data.candidates : [];
      },
      async disconnect() {
        await invokeSupabaseFunction("gmail-disconnect");
      },
    },
  };
}

function buildUnconfiguredRepository(): AppRepository {
  const fail = async () => {
    throw new Error(backendSetupError());
  };

  return {
    backend: "unconfigured",
    auth: {
      async getCurrentUser() {
        return null;
      },
      onAuthStateChange() {
        return () => undefined;
      },
      async signUp() {
        return fail();
      },
      async signIn() {
        return fail();
      },
      async signOut() {
        return fail();
      },
    },
    async loadSnapshot() {
      return fail();
    },
    async updatePreferences() {
      return fail();
    },
    async createUndoItem() {
      return fail();
    },
    async updateUndoItem() {
      return fail();
    },
    async replaceReminders() {
      return fail();
    },
    async createUpload() {
      return fail();
    },
    gmail: {
      async getAuthorizationUrl() {
        return fail();
      },
      async syncCandidates() {
        return fail();
      },
      async disconnect() {
        return fail();
      },
    },
  };
}

export const appRepository: AppRepository = hasSupabaseConfig
  ? buildSupabaseRepository()
  : appConfig.allowLocalAdapter
    ? buildLocalRepository()
    : buildUnconfiguredRepository();
