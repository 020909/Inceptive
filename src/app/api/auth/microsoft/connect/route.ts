import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sanitizeOAuthRedirectPath } from "@/lib/safe-redirect";

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const TENANT = process.env.MICROSOFT_TENANT_ID || "common";
const SCOPES = "offline_access User.Read Mail.Send Mail.ReadWrite";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/microsoft/callback`;
  const redirectTo = sanitizeOAuthRedirectPath(url.searchParams.get("redirect_to"), "/social");

  const userId = await getAuthenticatedUserIdFromRequest(request, true);
  if (!userId) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  if (!CLIENT_ID) {
    console.error(`[OAuth] MICROSOFT_CLIENT_ID missing in production.`);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=config_missing&provider=microsoft`);
  }

  const state = createOAuthState(userId, redirectTo);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
    state,
  });

  return NextResponse.redirect(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${params.toString()}`);
}
