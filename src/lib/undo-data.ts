export type Category = "trial" | "renewal" | "return" | "bill" | "followup";
export type ItemStatus = "active" | "snoozed" | "done" | "archived";
export type SourceType = "manual" | "text" | "screenshot" | "auto";
export type PlanTier = "free" | "premium";
export type ReminderType = "default" | "premium" | "manual" | "snooze";
export type ReminderStatus = "scheduled" | "sent" | "cancelled";
export type ReminderChannel = "in_app";
export type UploadFileType = "text" | "screenshot";

export interface UndoProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UndoItem {
  id: string;
  userId?: string;
  title: string;
  detail?: string;
  category: Category;
  sourceType: SourceType;
  dueAt: string;
  urgency?: string;
  remindAt?: string;
  amountValue?: number;
  amount?: string;
  merchantName?: string;
  source?: string;
  note?: string;
  status: ItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface UndoReminder {
  id: string;
  undoItemId: string;
  remindAt: string;
  reminderType: ReminderType;
  status: ReminderStatus;
  channel: ReminderChannel;
  createdAt: string;
}

export interface UndoUpload {
  id: string;
  userId: string;
  fileType: UploadFileType;
  extractedText?: string;
  createdAt: string;
}

export interface UndoPreferences {
  id: string;
  userId: string;
  notificationTime: string;
  enabledCategories: Category[];
  onboardingCompleted: boolean;
  gmailConnected: boolean;
  planTier: PlanTier;
  pushEnabled: boolean;
  emailDigestEnabled: boolean;
  quietHoursEnabled: boolean;
  firstCaptureCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUndoItemInput {
  title: string;
  detail?: string;
  category: Category;
  dueAt: string;
  amountValue?: number;
  amount?: string;
  source?: string;
  sourceType?: SourceType;
  merchantName?: string;
  note?: string;
  remindAt?: string;
  upload?: {
    fileType: UploadFileType;
    extractedText?: string;
  };
}

export interface CreateReminderInput {
  remindAt: string;
  reminderType: ReminderType;
  status?: ReminderStatus;
  channel?: ReminderChannel;
}

export interface AppSnapshot {
  profile: UndoProfile;
  preferences: UndoPreferences;
  items: UndoItem[];
  reminders: UndoReminder[];
  uploads: UndoUpload[];
}

export const DEFAULT_NOTIFICATION_TIME = "09:00";

export function createDefaultPreferences(userId: string): UndoPreferences {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    notificationTime: DEFAULT_NOTIFICATION_TIME,
    enabledCategories: ["trial", "renewal", "return", "bill", "followup"],
    onboardingCompleted: false,
    gmailConnected: false,
    planTier: "free",
    pushEnabled: true,
    emailDigestEnabled: false,
    quietHoursEnabled: true,
    firstCaptureCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function isActiveUndoItem(item: Pick<UndoItem, "status">) {
  return item.status !== "done" && item.status !== "archived";
}

export const categoryMeta: Record<Category, { label: string; icon: string; description: string }> = {
  trial: { label: "Trial", icon: "Sparkles", description: "Free trials about to convert" },
  renewal: { label: "Renewal", icon: "RefreshCw", description: "Subscriptions renewing soon" },
  return: { label: "Return", icon: "PackageOpen", description: "Items you can still send back" },
  bill: { label: "Bill", icon: "Receipt", description: "Payments and deadlines" },
  followup: { label: "Follow-up", icon: "MessageCircle", description: "People you said you'd get back to" },
};

export const seedItems: UndoItem[] = [];
