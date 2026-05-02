import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export function getBearerJwtFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7).trim();
    return jwt || null;
  }
  return null;
}

function decodeJwtPayload(jwt: string): any {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1]!;
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

export function getTenantIdFromRequest(request: Request): string | null {
  const jwt = getBearerJwtFromRequest(request);
  if (!jwt) return null;
  try {
    const payload = decodeJwtPayload(jwt);
    const tenantId = (payload?.tenant_id || payload?.tenantId || payload?.["https://inceptive.ai/tenant_id"]) as
      | string
      | undefined;
    return typeof tenantId === "string" && tenantId.trim().length > 0 ? tenantId.trim() : null;
  } catch {
    return null;
  }
}

export async function getTenantIdFromRequestWithDbFallback(request: Request, userId: string): Promise<string | null> {
  const fromJwt = getTenantIdFromRequest(request);
  if (fromJwt) return fromJwt;

  const supabase = await createServerSupabaseClient();
  const { data: userProfile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  return userProfile?.tenant_id || null;
}

export function getIpAddressFromRequest(request: Request): string | null {
  const xfwd = request.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}

