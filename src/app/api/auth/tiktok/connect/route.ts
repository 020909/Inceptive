import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sanitizeOAuthRedirectPath } from "@/lib/safe-redirect";
import crypto from "crypto";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!;
const SCOPES = "user.info.basic,video.publish,video.upload";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/tiktok/callback`;

  const redirectTo = sanitizeOAuthRedirectPath(url.searchParams.get("redirect_to"), "/social");

  const userId = await getAuthenticatedUserIdFromRequest(request, true);
  if (!userId) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  if (!CLIENT_KEY) {
    console.error(`[OAuth] TIKTOK_CLIENT_KEY missing in production.`);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=config_missing&provider=tiktok`);
  }

  const state = createOAuthState(userId, redirectTo);
  const csrfState = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state: `${state}.${csrfState}`,
  });

  return NextResponse.redirect(`https://www.tiktok.com/v2/auth/authorize?${params.toString()}`);
}
