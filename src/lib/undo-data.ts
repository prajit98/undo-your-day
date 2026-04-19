export type Category = "trial" | "renewal" | "return" | "bill" | "followup";
export type ItemStatus = "active" | "snoozed" | "done" | "archived";

export interface UndoItem {
  id: string;
  title: string;          // What might go wrong (consequence-led)
  detail?: string;        // What can still be saved
  category: Category;
  dueAt: string;          // ISO
  amountValue?: number;   // numeric for "money at risk"
  amount?: string;        // display
  source?: string;
  note?: string;
  status: ItemStatus;
}

export const categoryMeta: Record<Category, { label: string; icon: string; description: string }> = {
  trial: { label: "Trial", icon: "Sparkles", description: "Free trials about to convert" },
  renewal: { label: "Renewal", icon: "RefreshCw", description: "Subscriptions renewing soon" },
  return: { label: "Return", icon: "PackageOpen", description: "Items you can still send back" },
  bill: { label: "Bill", icon: "Receipt", description: "Payments and deadlines" },
  followup: { label: "Follow-up", icon: "MessageCircle", description: "People you said you'd get back to" },
};

// Feed starts empty — items are populated by Gmail onboarding (or manual add).
export const seedItems: UndoItem[] = [];
