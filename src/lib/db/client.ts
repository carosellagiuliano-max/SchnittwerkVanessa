import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Lazy-initialized clients to avoid build-time errors
let _supabaseClient: SupabaseClient<Database> | null = null;

// Client-side Supabase client (uses anon key, respects RLS)
export function getSupabaseClient(): SupabaseClient<Database> {
  if (_supabaseClient) return _supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  _supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return _supabaseClient;
}

// Legacy export for backwards compatibility
// Note: This will throw if env vars are not set at import time
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return Reflect.get(getSupabaseClient(), prop);
  },
});

// Server-side Supabase client (uses service role key, bypasses RLS)
// Only use this for admin operations and background jobs
// Returns null if env vars are not available (e.g., during build)
export function createServerClient(): SupabaseClient<Database> | null {
  // Use internal URL for Docker (server-side), fall back to public URL
  const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  // Return null if env vars are not available (safe for build time)
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Type export for convenience
export type SupabaseClientType = ReturnType<typeof getSupabaseClient>;
