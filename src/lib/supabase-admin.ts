import "server-only";

import { createClient } from "@supabase/supabase-js";

function required(name: string, value: string | undefined): string {
  const v = value?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

/**
 * Server-only Supabase client using the service-role key.
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return createClient(
    required("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", url),
    required("SUPABASE_SERVICE_ROLE_KEY", key)
  );
}
