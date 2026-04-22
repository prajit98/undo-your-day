import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { appRepository } from "@/lib/persistence";
import type { AppBackendMode } from "@/lib/app-config";
import { UndoProfile } from "@/lib/undo-data";

interface AuthContextValue {
  user: UndoProfile | null;
  ready: boolean;
  backend: AppBackendMode;
  signUp: (input: { email: string; password: string; name: string }) => Promise<{ requiresEmailConfirmation: boolean }>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UndoProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    appRepository.auth.getCurrentUser()
      .then((nextUser) => {
        if (!mounted) return;
        setUser(nextUser);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setReady(true);
      });

    const unsubscribe = appRepository.auth.onAuthStateChange((nextUser) => {
      setUser(nextUser);
      setReady(true);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      backend: appRepository.backend,
      async signUp(input) {
        const result = await appRepository.auth.signUp(input);
        if (!result.requiresEmailConfirmation) {
          setUser(result.user);
        }
        return { requiresEmailConfirmation: Boolean(result.requiresEmailConfirmation) };
      },
      async signIn(input) {
        const result = await appRepository.auth.signIn(input);
        setUser(result.user);
      },
      async signOut() {
        await appRepository.auth.signOut();
        setUser(null);
      },
    }),
    [user, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
