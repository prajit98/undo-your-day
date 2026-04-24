import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUndo } from "@/context/UndoContext";

const PUBLIC_PATHS = new Set(["/", "/landing", "/early-access-confirmed", "/auth"]);

export function OnboardingGate() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, ready: authReady } = useAuth();
  const { ready: appReady, onboarding } = useUndo();

  const isBooting = !authReady || (Boolean(user) && !appReady);

  useEffect(() => {
    if (isBooting) return;

    if (!user) {
      if (!PUBLIC_PATHS.has(pathname)) {
        navigate("/auth", { replace: true, state: { redirectTo: pathname } });
      }
      return;
    }

    if (pathname === "/auth") {
      navigate("/app", { replace: true });
      return;
    }

    if (pathname === "/landing") {
      navigate("/", { replace: true });
      return;
    }

    if (!onboarding.isComplete && pathname !== "/onboarding") {
      navigate("/onboarding", { replace: true });
      return;
    }

  }, [isBooting, user, pathname, onboarding.isComplete, navigate]);

  if (!isBooting || PUBLIC_PATHS.has(pathname)) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/96 backdrop-blur-sm">
      <div className="mx-6 max-w-xs text-center">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Undo
        </p>
        <h1 className="mt-4 font-display text-[30px] leading-[1.08] tracking-snug text-foreground">
          Getting your protection ready.
        </h1>
        <div className="mx-auto mt-6 h-[2px] w-32 overflow-hidden rounded-full bg-surface">
          <div className="shimmer h-full w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
