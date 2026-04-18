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

const today = new Date();
const day = (offset: number, h = 9, m = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const seedItems: UndoItem[] = [
  {
    id: "1",
    title: "Notion AI converts to paid tomorrow",
    detail: "Cancel before 6pm and you keep the $10/month.",
    category: "trial", dueAt: day(1, 18), amountValue: 10, amount: "$10/mo", source: "Notion", status: "active",
  },
  {
    id: "2",
    title: "Last 3 days to return the Adidas runners",
    detail: "After Friday at midnight, the $128 is yours forever.",
    category: "return", dueAt: day(3, 23, 59), amountValue: 128, amount: "$128", source: "Adidas.com", status: "active",
  },
  {
    id: "3",
    title: "ConEd bill hits a late fee in 3 days",
    detail: "Auto-pay is off — pay before Thursday to avoid $15.",
    category: "bill", dueAt: day(3, 17), amountValue: 84.20, amount: "$84.20", source: "ConEd", status: "active",
  },
  {
    id: "4",
    title: "Reply to Maya before it gets awkward",
    detail: "She asked about Lisbon four days ago.",
    category: "followup", dueAt: day(2, 19), source: "Messages", status: "active",
  },
  {
    id: "5",
    title: "Equinox auto-renews Monday for $245",
    detail: "Pause or cancel before then — still fully refundable.",
    category: "renewal", dueAt: day(5, 9), amountValue: 245, amount: "$245", source: "Equinox", status: "active",
  },
  {
    id: "6",
    title: "Spotify Family annual charge in a week",
    detail: "$167.88 hits the card next Wednesday.",
    category: "renewal", dueAt: day(7, 8), amountValue: 167.88, amount: "$167.88", source: "Spotify", status: "active",
  },
  {
    id: "7",
    title: "Aesop return window closes Sunday",
    detail: "Drop it at any UPS by 5pm to recover $62.",
    category: "return", dueAt: day(4, 23), amountValue: 62, amount: "$62", source: "Aesop", status: "active",
  },
  {
    id: "8",
    title: "Daniel is waiting on your offer reply",
    detail: "He asked Tuesday — a one-line yes or no is plenty.",
    category: "followup", dueAt: day(1, 12), source: "Gmail", status: "active",
  },
  {
    id: "9",
    title: "Verizon bill due next Wednesday",
    detail: "Pay on time, skip the $10 reconnection fee.",
    category: "bill", dueAt: day(8, 12), amountValue: 59.99, amount: "$59.99", source: "Verizon", status: "active",
  },
  {
    id: "10",
    title: "Headspace charges $69.99 in 4 days",
    detail: "Trial converts Sunday morning unless you cancel.",
    category: "trial", dueAt: day(4, 7), amountValue: 69.99, amount: "$69.99/yr", source: "Headspace", status: "active",
  },
  {
    id: "11",
    title: "Send Priya a thank-you this week",
    detail: "It's been six days since dinner — small note, big save.",
    category: "followup", dueAt: day(6, 10), source: "Notes", status: "active",
  },
  {
    id: "12",
    title: "NYT renews in 10 days at $25/mo",
    detail: "Switch to the $4 student rate before it charges.",
    category: "renewal", dueAt: day(10, 6), amountValue: 25, amount: "$25/mo", source: "NYT", status: "active",
  },
  // Recently prevented (for the "saved" stat)
  {
    id: "p1", title: "Cancelled Audible before charge", category: "trial",
    dueAt: day(-1, 10), amountValue: 14.95, amount: "$14.95", source: "Audible", status: "done",
  },
  {
    id: "p2", title: "Returned the Uniqlo coat", category: "return",
    dueAt: day(-2, 10), amountValue: 89, amount: "$89", source: "Uniqlo", status: "done",
  },
  {
    id: "p3", title: "Replied to Sam about brunch", category: "followup",
    dueAt: day(-3, 10), source: "Messages", status: "done",
  },
];
