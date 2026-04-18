import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Image as ImageIcon, ClipboardPaste, Sparkles, Wand2,
  Check, ChevronRight, RotateCcw,
} from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { useUndo } from "@/context/UndoContext";
import { Category, categoryMeta } from "@/lib/undo-data";
import { CategoryIconRound } from "@/components/CategoryBadge";
import { extractFromText, extractFromScreenshot, ExtractionResult } from "@/lib/extract";
import { onboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const cats: Category[] = ["trial", "renewal", "return", "bill", "followup"];

const PLACEHOLDERS = [
  "Your free trial converts on May 2",
  "Return by Friday for full refund",
  "I'll reply next week",
  "Bill due on the 18th",
];

type Stage = "input" | "extracting" | "review";

const AddItem = () => {
  const navigate = useNavigate();
  const { addItem } = useUndo();

  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const [draft, setDraft] = useState<ExtractionResult | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const runExtract = (input: string, source: "text" | "screenshot") => {
    if (source === "text" && !input.trim()) {
      toast.error("Paste or type something first");
      return;
    }
    setStage("extracting");
    setTimeout(() => {
      const result = source === "text" ? extractFromText(input) : extractFromScreenshot();
      if (source === "screenshot" && !text) setText("Screenshot · " + result.title);
      setDraft(result);
      setStage("review");
    }, 1100);
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) { toast.error("Clipboard is empty"); return; }
      setText(t);
      runExtract(t, "text");
    } catch {
      // fallback demo
      const demo = "Your Spotify Family renews on the 18th — $167.88 will be charged.";
      setText(demo);
      runExtract(demo, "text");
    }
  };

  const confirm = () => {
    if (!draft) return;
    addItem({
      title: draft.title,
      detail: draft.detail,
      category: draft.category,
      dueAt: draft.dueAt,
      amount: draft.amount,
      amountValue: draft.amountValue,
      source: draft.source,
    });
    const firstEver = !onboarding.hasFirstCapture();
    onboarding.markFirstCapture();
    toast.success(
      firstEver ? "First undo saved. We've got it from here." : "Added — we'll catch it in time.",
      { duration: firstEver ? 2600 : 1800 }
    );
    navigate("/");
  };

  return (
    <MobileShell>
      <header className="flex items-center justify-between px-5 pb-2 pt-10">
        <button
          onClick={() => (stage === "review" ? setStage("input") : navigate(-1))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft text-foreground/70"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
          <h1 className="font-display text-[19px]">Smart capture</h1>
        </div>
        <div className="w-10" />
      </header>

      {stage === "input" && (
        <InputStage
          text={text}
          setText={setText}
          placeholder={placeholder}
          onExtract={() => runExtract(text, "text")}
          onPaste={paste}
          onScreenshot={() => runExtract("", "screenshot")}
        />
      )}

      {stage === "extracting" && <ExtractingStage text={text} />}

      {stage === "review" && draft && (
        <ReviewStage
          draft={draft}
          setDraft={setDraft}
          editingTitle={editingTitle}
          setEditingTitle={setEditingTitle}
          onConfirm={confirm}
          onRetry={() => setStage("input")}
        />
      )}
    </MobileShell>
  );
};

/* --------------------------------- Input --------------------------------- */

function InputStage({
  text, setText, placeholder, onExtract, onPaste, onScreenshot,
}: {
  text: string; setText: (s: string) => void; placeholder: string;
  onExtract: () => void; onPaste: () => void; onScreenshot: () => void;
}) {
  return (
    <div className="space-y-6 px-5 pt-6 animate-fade-up">
      <div>
        <p className="font-display text-[26px] leading-[1.15] text-foreground text-balance">
          Paste anything. We'll figure out the rest.
        </p>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          A receipt, a chat, an email, a screenshot — Undo extracts the date, amount, and what's at stake.
        </p>
      </div>

      <div className="rounded-[24px] bg-card p-4 shadow-card">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-none border-0 bg-transparent font-display text-[20px] leading-snug placeholder:text-muted-foreground/45 focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
          <button
            onClick={onPaste}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11.5px] font-medium text-foreground/75 hover:text-foreground"
          >
            <ClipboardPaste className="h-3.5 w-3.5" strokeWidth={1.8} /> Paste
          </button>
          <button
            onClick={onScreenshot}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11.5px] font-medium text-foreground/75 hover:text-foreground"
          >
            <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.8} /> Screenshot
          </button>
          <button
            onClick={onExtract}
            disabled={!text.trim()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <Wand2 className="h-3.5 w-3.5" strokeWidth={2} /> Extract
          </button>
        </div>
      </div>

      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Try one
        </p>
        <div className="mt-3 space-y-2">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p}
              onClick={() => { setText(p); }}
              className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left text-[13.5px] text-foreground/80 shadow-soft transition-colors hover:text-foreground"
            >
              <span>{p}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Extracting ------------------------------ */

function ExtractingStage({ text }: { text: string }) {
  return (
    <div className="px-5 pt-10 animate-fade-in">
      <div className="rounded-[28px] bg-card p-6 shadow-card">
        <div className="flex items-center gap-2.5 text-primary">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Reading</span>
        </div>
        <p className="mt-4 font-display text-[22px] leading-snug text-foreground/85">
          {text ? `"${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"` : "Looking at your screenshot…"}
        </p>
        <div className="mt-6 space-y-2.5">
          <Bar label="Detecting category" />
          <Bar label="Pulling out dates and amounts" delay="0.15s" />
          <Bar label="Writing the consequence" delay="0.3s" />
        </div>
      </div>
    </div>
  );
}

function Bar({ label, delay = "0s" }: { label: string; delay?: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] text-muted-foreground">{label}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="shimmer h-full w-full rounded-full" style={{ animationDelay: delay }} />
      </div>
    </div>
  );
}

/* --------------------------------- Review -------------------------------- */

function ReviewStage({
  draft, setDraft, editingTitle, setEditingTitle, onConfirm, onRetry,
}: {
  draft: ExtractionResult;
  setDraft: (d: ExtractionResult) => void;
  editingTitle: boolean;
  setEditingTitle: (b: boolean) => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const dueLocal = new Date(draft.dueAt).toISOString().slice(0, 10);

  return (
    <div className="space-y-5 px-5 pt-4 animate-fade-up">
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em]">
          Captured · {Math.round(draft.confidence * 100)}% sure
        </span>
        <button
          onClick={onRetry}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={1.8} /> Redo
        </button>
      </div>

      {/* Suggested headline */}
      <div className="rounded-[24px] bg-card p-5 shadow-card">
        {editingTitle ? (
          <textarea
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            rows={2}
            className="w-full resize-none border-0 bg-transparent font-display text-[22px] leading-snug focus:outline-none"
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="text-left">
            <h2 className="font-display text-[24px] leading-[1.15] text-foreground text-balance">
              {draft.title}
            </h2>
          </button>
        )}
        {draft.detail && (
          <p className="mt-2 text-[13px] text-muted-foreground">{draft.detail}</p>
        )}

        <div className="mt-4 space-y-1.5">
          {draft.signals.map((s) => (
            <div key={s} className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
              <Check className="h-3 w-3 text-primary" strokeWidth={2.2} />
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Category */}
      <Field label="Category">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {cats.map((c) => {
            const active = c === draft.category;
            return (
              <button
                key={c}
                onClick={() => setDraft({ ...draft, category: c })}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-[12px] transition-colors",
                  active
                    ? "border-primary/40 bg-primary-soft text-foreground"
                    : "border-border bg-card text-foreground/70"
                )}
              >
                <CategoryIconRound category={c} active={active} />
                <span className="font-medium">{categoryMeta[c].label}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Date + amount */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="When">
          <input
            type="date"
            value={dueLocal}
            onChange={(e) => {
              const d = new Date(e.target.value + "T09:00:00");
              setDraft({ ...draft, dueAt: d.toISOString() });
            }}
            className="w-full rounded-2xl border-0 bg-card px-3 py-3 text-[13px] shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Amount">
          <input
            type="text"
            value={draft.amount ?? ""}
            placeholder="optional"
            onChange={(e) => setDraft({ ...draft, amount: e.target.value || undefined })}
            className="w-full rounded-2xl border-0 bg-card px-3 py-3 text-[13px] shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </div>

      <button
        onClick={onConfirm}
        className="mt-2 w-full rounded-full bg-primary py-4 text-[14px] font-medium text-primary-foreground shadow-glow transition-transform active:scale-[0.99]"
      >
        Add to Undo Feed
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

export default AddItem;
