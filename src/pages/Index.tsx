import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Mail, ShieldCheck } from "lucide-react";
import { useUndo } from "@/context/UndoContext";
import { UndoCard } from "@/components/UndoCard";
import { MobileShell } from "@/components/MobileShell";
import { FeedSummary } from "@/components/FeedSummary";
import { WeeklyRecap } from "@/components/WeeklyRecap";
import { feedTimingFor } from "@/lib/urgency";

const Index = () => {
  const { items, active, onboarding } = useUndo();
  const gmailConnected = onboarding.gmailConnected;

  const { critical, fixToday, upcoming } = useMemo(() => {
    const sorted = [...active].sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    const critical = sorted.filter((i) => feedTimingFor(i.dueAt).level === "overdue");
    const fixToday = sorted.filter((i) => feedTimingFor(i.dueAt).level === "today");
    const upcoming = sorted.filter((i) => !["overdue", "today"].includes(feedTimingFor(i.dueAt).level));
    return { critical, fixToday, upcoming };
  }, [active]);

  const fixTodayItems = [...critical, ...fixToday];
  const todayCount = fixTodayItems.length;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const headline =
    todayCount > 0
      ? `${todayCount} thing${todayCount > 1 ? "s need" : " needs"} attention today.`
      : "Nothing urgent. Undo is keeping a quiet eye on things.";

  return (
    <MobileShell>
      <header className="px-5 pb-2 pt-12">
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {today}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground shadow-soft ring-1 ring-border/40">
            <span className="relative flex h-1.5 w-1.5">
              {gmailConnected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            {gmailConnected ? "Starts with Gmail" : "Undo"}
          </span>
        </div>
        <h1 className="mt-4 max-w-[11ch] whitespace-pre-line font-display text-[40px] leading-[1.03] tracking-snug text-foreground">
          {todayCount > 0 ? "A few things\nneed attention." : "Quiet today.\nNicely done."}
        </h1>
        <p className="mt-3 max-w-[31rem] text-[14px] leading-relaxed text-muted-foreground text-balance">
          {headline}
        </p>
      </header>

      {active.length > 0 && <FeedSummary items={items} />}
      <WeeklyRecap />

      {fixTodayItems.length > 0 && (
        <section className="mt-6 px-5">
          <SectionHeader
            kicker="Needs attention"
            sub={
              critical.length > 0
                ? "Some deadlines have already arrived. Review these first."
                : "Due today. Review these before the window closes."
            }
          />
          <div className="mt-3 space-y-3">
            {fixTodayItems.map((item) => (
              <UndoCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-7 px-5">
          <SectionHeader
            kicker="Coming up"
            sub="Still plenty of time. Undo keeps a quiet eye on these."
          />
          <div className="mt-3 space-y-3">
            {upcoming.map((item) => (
              <UndoCard key={item.id} item={item} emphasis="calm" />
            ))}
          </div>
        </section>
      )}

      {/* Manual backup - secondary to the automatic-first story */}
      {active.length > 0 && (
        <Link
          to="/add"
          className="group mx-5 mt-7 flex items-center gap-3 rounded-[24px] border border-border/70 bg-card/55 p-4 shadow-soft transition-colors hover:bg-card active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-foreground/65">
            <Plus className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-foreground/85">Add something Undo missed</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Paste, screenshot, or type it</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
        </Link>
      )}

      {active.length === 0 && (
        <div className="mx-5 mt-10 rounded-[30px] border border-dashed border-border bg-card/70 p-9 text-center shadow-soft animate-fade-up">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <p className="mt-4 font-display text-[24px] leading-tight text-foreground">
            Nothing to fix right now.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground text-balance">
            {gmailConnected
              ? "Undo keeps review first, and you stay in control."
              : "Connect Gmail to let Undo look for likely trials, renewals, returns, and bills. You still review everything first."}
          </p>
          {!gmailConnected ? (
            <div className="mt-5 flex flex-col items-center gap-2">
              <Link
                to="/trust"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[12.5px] font-medium text-background"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.9} />
                Connect Gmail
              </Link>
              <p className="text-[10.5px] text-muted-foreground">
                See how Undo handles Gmail first · Read-only access
              </p>
            </div>
          ) : (
            <Link
              to="/add"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-[12.5px] font-medium text-background"
            >
              Add something yourself
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          )}
        </div>
      )}
    </MobileShell>
  );
};

function SectionHeader({ kicker, sub }: { kicker: string; sub: string }) {
  return (
    <div className="px-1">
      <h2 className="font-display text-[23px] leading-tight text-foreground">{kicker}</h2>
      <p className="mt-1.5 max-w-[28rem] text-[12.5px] leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

export default Index;
