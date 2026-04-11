import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createAdminClient(url, key);
}

export async function trackEvent(
  orgId: string,
  userId: string,
  eventName: string,
  properties?: object
) {
  try {
    const supabase = getAdmin();
    void supabase.from("analytics_events").insert({
      organization_id: orgId,
      user_id: userId,
      event_name: eventName,
      properties: properties ?? {},
    });
  } catch {
    // Analytics should never block the caller.
  }
}

export function trackClientEvent(
  orgId: string,
  userId: string,
  eventName: string,
  properties?: object
) {
  try {
    const supabase = createBrowserClient();
    void supabase.from("analytics_events").insert({
      organization_id: orgId,
      user_id: userId,
      event_name: eventName,
      properties: properties ?? {},
    });
  } catch {
    // Analytics should never block the UI.
  }
}
