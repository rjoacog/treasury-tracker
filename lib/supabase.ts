import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = any;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL for Supabase client.");
  }
  return url;
}

function assertServerContext(forClient: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${forClient} must not be used in the browser.`);
  }
}

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  const url = getSupabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for browser Supabase client.");
  }

  return createClient<Database>(url, key);
}

export function createServerSupabaseClient(): SupabaseClient<Database> {
  assertServerContext("createServerSupabaseClient");

  const url = getSupabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for server Supabase client.");
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false
    }
  });
}

export function createServiceSupabaseClient(): SupabaseClient<Database> {
  assertServerContext("createServiceSupabaseClient");

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for service Supabase client.");
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false
    }
  });
}

