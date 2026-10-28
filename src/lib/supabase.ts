import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Only browser-safe keys are read here. The service-role key and AI provider
// secrets live exclusively in Edge Function secrets and are never imported into
// the client bundle.
const url = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL
) as string | undefined;

const anonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_ANON_KEY
) as string | undefined;

/** True when the client is configured to talk to a real Supabase project. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * A single shared client instance for the whole app. When Supabase is not yet
 * configured we export `null` and the UI shows a setup message rather than
 * faking success.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Narrowing helper for call sites that require a live client. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}
