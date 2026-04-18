import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Image as ImageIcon, ClipboardPaste, Calendar } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { useUndo } from "@/context/UndoContext";
import { Category, categoryMeta } from "@/lib/undo-data";
import { CategoryIconCircle } from "@/components/CategoryBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const cats: Category[] = ["trial", "renewal", "return", "bill", "followup"];

const AddItem = () => {
  const navigate = useNavigate();
  const { addItem } = useUndo();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<Category>("trial");
  const [due, setDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });

  const submit = () => {
    if (!title.trim()) {
      toast.error("Give it a short title");
      return;
    }
    addItem({
      title: title.trim(),
      category,
      dueAt: new Date(due + "T09:00:00").toISOString(),
      note: note.trim() || undefined,
    });
    toast.success("Added to your Undo Feed");
    navigate("/");
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTitle(text.slice(0, 120));
        toast.success("Pasted from clipboard");
      }
    } catch {
      toast.error("Couldn't read clipboard");
    }
  };

  return (
    <MobileShell>
      <header className="flex items-center justify-between px-5 pb-2 pt-10">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg">New undo</h1>
        <div className="w-10" />
      </header>

      <div className="space-y-6 px-5 pt-4">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What might slip?
          </label>
          <textarea
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Cancel Audible trial before Sunday"
            rows={3}
            className="mt-2 w-full resize-none rounded-2xl border-0 bg-card p-4 font-display text-lg leading-snug shadow-soft placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={paste}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
            >
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste text
            </button>
            <button
              onClick={() => toast("Screenshot upload (demo)")}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Screenshot
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Category
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {cats.map((c) => {
              const meta = categoryMeta[c];
              const active = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all",
                    active
                      ? "border-primary/40 ring-2 ring-primary/20"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <CategoryIconCircle category={c} />
                  <span className="text-sm font-medium">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Due date
          </label>
          <div className="relative mt-2">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full rounded-2xl border-0 bg-card py-4 pl-11 pr-4 text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything you'll want to remember"
            className="mt-2 w-full resize-none rounded-2xl border-0 bg-card p-4 text-sm shadow-soft placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <button
          onClick={submit}
          className="w-full rounded-full bg-primary py-4 font-medium text-primary-foreground shadow-card transition-transform active:scale-[0.98]"
        >
          Add to Undo Feed
        </button>
      </div>
    </MobileShell>
  );
};

export default AddItem;
