import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onboarding } from "@/lib/onboarding";

/**
 * Sends new users to /onboarding on their first visit. Runs once per route change.
 */
export function OnboardingGate() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === "/onboarding" || pathname === "/landing" || pathname === "/showcase") return;
    if (!onboarding.isComplete()) {
      navigate("/onboarding", { replace: true });
    }
  }, [pathname, navigate]);

  return null;
}
