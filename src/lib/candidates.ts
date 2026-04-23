import { Category, UndoItem } from "./undo-data";

export interface Candidate {
  id: string;
  title: string;
  detail?: string;
  category: Category;
  dueAt: string;
  amountValue?: number;
  amount?: string;
  source?: string;
  urgent?: boolean;
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
