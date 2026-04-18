import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { seedItems, UndoItem, ItemStatus, Category } from "@/lib/undo-data";

interface UndoContextValue {
  items: UndoItem[];
  setStatus: (id: string, status: ItemStatus) => void;
  snooze: (id: string, hours: number) => void;
  addItem: (item: Omit<UndoItem, "id" | "status">) => void;
  byCategory: (cat: Category) => UndoItem[];
  active: UndoItem[];
}

const Ctx = createContext<UndoContextValue | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UndoItem[]>(seedItems);

  const value = useMemo<UndoContextValue>(() => ({
    items,
    setStatus: (id, status) =>
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i))),
    snooze: (id, hours) =>
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;
          const d = new Date(i.dueAt);
          d.setHours(d.getHours() + hours);
          return { ...i, dueAt: d.toISOString(), status: "active" };
        })
      ),
    addItem: (item) =>
      setItems((prev) => [
        { ...item, id: crypto.randomUUID(), status: "active" },
        ...prev,
      ]),
    byCategory: (cat) => items.filter((i) => i.category === cat && i.status !== "archived"),
    active: items.filter((i) => i.status === "active"),
  }), [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUndo() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUndo must be used inside UndoProvider");
  return ctx;
}
