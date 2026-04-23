import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const EarlyAccessConfirmed = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1000px 520px at 50% -10%, hsl(var(--primary) / 0.10), transparent 60%), radial-gradient(760px 420px at -10% 25%, hsl(var(--primary-glow) / 0.08), transparent 60%)",
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="rounded-[34px] border border-border/70 bg-card/95 p-8 shadow-card sm:p-10">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-soft">
            <CheckCircle2 className="h-5 w-5" strokeWidth={1.8} />
          </span>

          <p className="mt-6 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Early access
          </p>
          <h1 className="mt-3 font-display text-[40px] leading-[1.02] tracking-snug text-balance">
            You&apos;re on the list.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            We&apos;ll email you when Undo opens up.
          </p>
          <p className="mt-3 text-[12.5px] text-muted-foreground">
            Coming soon on iOS and Android.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-[14px] font-medium text-background shadow-soft transition-transform hover:-translate-y-px"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back to Undo
            </Link>
            <Link
              to="/auth"
              className="text-center text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EarlyAccessConfirmed;
