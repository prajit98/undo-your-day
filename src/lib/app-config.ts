export type AppBackendMode = "supabase" | "local" | "unconfigured";

function readFlag(value: string | undefined) {
  return value === "true";
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
const allowLocalAdapter = import.meta.env.DEV || readFlag(import.meta.env.VITE_USE_LOCAL_ADAPTER);

export const appConfig = {
  appName: "Undo",
  bundleId: "com.undoyourday.app",
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL?.trim() || "support@undo.app",
  publicAppUrl: import.meta.env.VITE_PUBLIC_APP_URL?.trim() || "",
  privacyPolicyUrl: import.meta.env.VITE_PRIVACY_POLICY_URL?.trim() || "",
  accountDeletionUrl: import.meta.env.VITE_ACCOUNT_DELETION_URL?.trim() || "",
  supabaseUrl,
  supabaseAnonKey,
  hasSupabaseConfig,
  allowLocalAdapter,
  backendMode: hasSupabaseConfig
    ? "supabase"
    : allowLocalAdapter
      ? "local"
      : "unconfigured" as AppBackendMode,
};

export function backendSetupMessage(mode: AppBackendMode) {
  if (mode === "supabase") {
    return "Backed by your Undo account.";
  }

  if (mode === "local") {
    return "Running in local app mode until Supabase keys are added.";
  }

  return "Production backend setup is still required before launch.";
}

export function backendSetupError() {
  return "Undo needs its production backend configured before account access can go live.";
}
