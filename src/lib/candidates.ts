import { Category, UndoItem } from "./undo-data";

export interface Candidate {
  id: string;
  title: string;          // consequence-led headline
  detail?: string;        // small supporting line
  category: Category;
  dueAt: string;
  amountValue?: number;
  amount?: string;
  source?: string;        // merchant / sender
  urgent?: boolean;       // refined coral treatment
}

const day = (offset: number, h = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

// Realistic, high-confidence demo detections from a typical Gmail inbox.
// Order roughly by urgency so the review screen leads with what matters.
const ALL: Candidate[] = [
  {
    id: "c1",
    title: "Save $19.99 if you cancel today",
    detail: "Notion AI free trial ends tonight at 6pm.",
    category: "trial",
    dueAt: day(0, 18),
    amountValue: 19.99,
    amount: "$19.99/mo",
    source: "Notion",
    urgent: true,
  },
  {
    id: "c2",
    title: "Last 2 days to return the Adidas runners",
    detail: "Order #A-3814 — $128 back to your card.",
    category: "return",
    dueAt: day(2, 23),
    amountValue: 128,
    amount: "$128",
    source: "Adidas",
    urgent: true,
  },
  {
    id: "c3",
    title: "Spotify Family renews tomorrow",
    detail: "$167.88 will hit the card on file.",
    category: "renewal",
    dueAt: day(1, 8),
    amountValue: 167.88,
    amount: "$167.88",
    source: "Spotify",
  },
  {
    id: "c4",
    title: "ConEd bill hits a late fee in 3 days",
    detail: "Auto-pay is off — $84.20 due Thursday.",
    category: "bill",
    dueAt: day(3, 17),
    amountValue: 84.20,
    amount: "$84.20",
    source: "ConEd",
  },
  {
    id: "c5",
    title: "Equinox auto-renews Monday for $245",
    detail: "Pause or cancel before then — still refundable.",
    category: "renewal",
    dueAt: day(5, 9),
    amountValue: 245,
    amount: "$245",
    source: "Equinox",
  },
  {
    id: "c6",
    title: "Aesop return window closes Sunday",
    detail: "Drop at any UPS by 5pm to recover $62.",
    category: "return",
    dueAt: day(4, 17),
    amountValue: 62,
    amount: "$62",
    source: "Aesop",
  },
];

export function generateCandidates(allowed: Category[]): Candidate[] {
  // Always show 3–6 cards based on chosen categories
  const filtered = ALL.filter((c) => allowed.includes(c.category));
  return filtered.slice(0, 6);
}

export function candidateToItem(c: Candidate): Omit<UndoItem, "id" | "status"> {
  return {
    title: c.title,
    detail: c.detail,
    category: c.category,
    sourceType: "auto",
    dueAt: c.dueAt,
    amountValue: c.amountValue,
    amount: c.amount,
    merchantName: c.source,
    source: c.source,
  };
}
