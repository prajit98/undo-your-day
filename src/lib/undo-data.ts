export type Category = "trial" | "renewal" | "return" | "bill" | "followup";
export type ItemStatus = "active" | "snoozed" | "done" | "archived";

export interface UndoItem {
  id: string;
  title: string;
  detail?: string;
  category: Category;
  dueAt: string; // ISO
  amount?: string;
  source?: string;
  note?: string;
  status: ItemStatus;
}

export const categoryMeta: Record<Category, { label: string; soft: string; fg: string; icon: string; description: string }> = {
  trial: { label: "Trial ending", soft: "bg-cat-trial-soft", fg: "text-cat-trial", icon: "Sparkles", description: "Free trials about to convert" },
  renewal: { label: "Renewal", soft: "bg-cat-renewal-soft", fg: "text-cat-renewal", icon: "RotateCcw", description: "Subscriptions renewing soon" },
  return: { label: "Return window", soft: "bg-cat-return-soft", fg: "text-cat-return", icon: "PackageOpen", description: "Items you can still send back" },
  bill: { label: "Bill due", soft: "bg-cat-bill-soft", fg: "text-cat-bill", icon: "Receipt", description: "Payments and deadlines" },
  followup: { label: "Follow-up", soft: "bg-cat-followup-soft", fg: "text-cat-followup", icon: "MessageCircle", description: "People you said you'd get back to" },
};

const today = new Date();
const day = (offset: number, h = 9, m = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const seedItems: UndoItem[] = [
  { id: "1", title: "Your Notion AI free trial ends tomorrow", detail: "Converts to $10/month if you don't cancel", category: "trial", dueAt: day(1, 18), amount: "$10/mo", source: "Notion", status: "active" },
  { id: "2", title: "You can still return those Adidas runners", detail: "Window closes Friday at midnight", category: "return", dueAt: day(3, 23, 59), amount: "$128", source: "Adidas.com", status: "active" },
  { id: "3", title: "Electricity bill due in 3 days", detail: "ConEd · auto-pay is off", category: "bill", dueAt: day(3, 17), amount: "$84.20", source: "ConEd", status: "active" },
  { id: "4", title: "You said you'd reply to Maya this week", detail: "About the Lisbon trip in June", category: "followup", dueAt: day(2, 19), source: "Messages", status: "active" },
  { id: "5", title: "Equinox membership renews Monday", detail: "$245 will be charged to your Visa", category: "renewal", dueAt: day(5, 9), amount: "$245", source: "Equinox", status: "active" },
  { id: "6", title: "Spotify Family plan renews next week", detail: "Annual charge", category: "renewal", dueAt: day(7, 8), amount: "$167.88", source: "Spotify", status: "active" },
  { id: "7", title: "Return window for Aesop order ends Sunday", category: "return", dueAt: day(4, 23), amount: "$62", source: "Aesop", status: "active" },
  { id: "8", title: "Reply to Daniel about the offer letter", detail: "He asked Tuesday", category: "followup", dueAt: day(1, 12), source: "Gmail", status: "active" },
  { id: "9", title: "Internet bill due next Wednesday", category: "bill", dueAt: day(8, 12), amount: "$59.99", source: "Verizon", status: "active" },
  { id: "10", title: "Headspace trial ends in 4 days", category: "trial", dueAt: day(4, 7), amount: "$69.99/yr", source: "Headspace", status: "active" },
  { id: "11", title: "Send thank-you note to Priya", detail: "From the dinner last Saturday", category: "followup", dueAt: day(6, 10), status: "active" },
  { id: "12", title: "NYT subscription renews in 10 days", category: "renewal", dueAt: day(10, 6), amount: "$25/mo", source: "NYT", status: "active" },
];
