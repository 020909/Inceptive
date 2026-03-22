import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sanitizeOAuthRedirectPath } from "@/lib/safe-redirect";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

// Gmail send + read, YouTube upload, user profile
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;
  const redirectTo = sanitizeOAuthRedirectPath(url.searchParams.get("redirect_to"), "/social");

  const userId = await getAuthenticatedUserIdFromRequest(request, true);
  if (!userId) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  if (!CLIENT_ID) {
    console.error(`[OAuth] GOOGLE_CLIENT_ID missing in production.`);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=config_missing&provider=google`);
  }

  const state = createOAuthState(userId, redirectTo);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/auth?${params.toString()}`);
}
