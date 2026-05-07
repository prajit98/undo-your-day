import { Category, UndoItem } from "./undo-data";
import { detailForDisplay, titleForDisplay } from "./item-copy";

export type CandidateStatus = "pending" | "kept" | "dismissed";

export interface CandidatePatch {
  title?: string;
  category?: Category;
  dueAt?: string;
  amountValue?: number | null;
  currency?: string;
}

export interface Candidate {
  id: string;
  source?: string;
  sourceMessageId?: string;
  title: string;
  detail?: string;
  category: Category;
  dueAt: string;
  amountValue?: number;
  amount?: string;
  merchant?: string;
  currency?: string;
  status?: CandidateStatus;
  urgent?: boolean;
}

export function candidateToItem(c: Candidate): Omit<UndoItem, "id" | "status"> {
  return {
    title: titleForDisplay(c),
    detail: detailForDisplay(c),
    category: c.category,
    sourceType: "auto",
    dueAt: c.dueAt,
    amountValue: c.amountValue,
    amount: c.amount,
    merchantName: c.merchant ?? c.source,
    source: c.merchant ?? c.source,
  };
}
