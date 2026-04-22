/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_USE_LOCAL_ADAPTER?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_PRIVACY_POLICY_URL?: string;
  readonly VITE_ACCOUNT_DELETION_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
