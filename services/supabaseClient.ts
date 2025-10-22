// Lightweight wrapper to avoid importing Supabase until configured
export interface SupabaseEnvConfig {
  url?: string;
  anonKey?: string;
}

export function getSupabaseEnv(): SupabaseEnvConfig {
  return {
    url: (import.meta as any).env?.VITE_SUPABASE_URL,
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
  };
}



