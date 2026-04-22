import { useEffect, useState } from "react";

/**
 * Brand splash / loading state.
 * Calm, premium — designed to be screenshot-worthy on its own.
 *
 * Self-dismissing after `duration` ms, or controllable via `open`.
 */
export function Splash({
  duration = 1600,
  onDone,
  open: openProp,
}: {
  duration?: number;
  onDone?: () => void;
  open?: boolean;
}) {
  const [open, setOpen] = useState(openProp ?? true);

  useEffect(() => {
    if (openProp !== undefined) {
      setOpen(openProp);
      return;
    }
    const t = setTimeout(() => {
      setOpen(false);
      onDone?.();
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone, openProp]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background animate-fade-in">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, hsl(var(--primary) / 0.10) 0%, transparent 70%)",
        }}
      />

      <SplashMark />

      <p className="relative mt-9 font-display text-[34px] leading-none tracking-snug text-foreground">
        Undo
      </p>
      <p className="relative mt-3 text-[12px] tracking-[0.18em] uppercase text-muted-foreground">
        Quietly watching
      </p>
    </div>
  );
}

/** The brand mark — circular undo arrow inside a soft sage tile. */
export function SplashMark({ size = 96 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-[28px] bg-gradient-to-b from-card to-primary-soft shadow-card animate-scale-in"
      style={{ height: size, width: size }}
    >
      {/* gentle ring pulse */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-[28px] ring-1 ring-primary/15"
      />
      <span
        aria-hidden
        className="absolute -inset-2 rounded-[36px] bg-primary/[0.04] animate-soft-pulse"
      />
      <svg
        viewBox="0 0 64 64"
        width={size * 0.52}
        height={size * 0.52}
        fill="none"
        className="relative text-primary"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* counter-clockwise arc */}
        <path
          d="M48 32a16 16 0 1 1-4.7-11.3"
          stroke="currentColor"
          strokeWidth="3.2"
        />
        {/* arrowhead */}
        <path
          d="M44 13v9h-9"
          stroke="currentColor"
          strokeWidth="3.2"
        />
      </svg>
    </div>
  );
}
