import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

/**
 * Resolve the authenticated Supabase user id.
 * - If `Authorization: Bearer <jwt>` is present, only that token is used (must be valid).
 * - Otherwise uses the session cookie (SSR client).
 * - If `allowQueryToken` is true (OAuth connect flows only), falls back to `?token=` as last resort.
 */
export async function getAuthenticatedUserIdFromRequest(
  request: Request,
  allowQueryToken = false
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7).trim();
    if (!jwt) return null;
    const { data, error } = await getServiceClient().auth.getUser(jwt);
    if (error || !data.user?.id) return null;
    return data.user.id;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user: cookieUser },
    error: cookieErr,
  } = await supabase.auth.getUser();
  if (!cookieErr && cookieUser?.id) return cookieUser.id;

  if (allowQueryToken) {
    const url = new URL(request.url);
    const qp = url.searchParams.get("token")?.trim();
    if (qp) {
      const { data, error } = await getServiceClient().auth.getUser(qp);
      if (!error && data.user?.id) return data.user.id;
    }
  }

  return null;
}
