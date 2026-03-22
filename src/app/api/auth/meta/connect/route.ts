import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sanitizeOAuthRedirectPath } from "@/lib/safe-redirect";

const APP_ID = process.env.META_APP_ID!;

// Scopes for Instagram + Facebook posting
const SCOPES = [
  "email",
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "publish_to_groups",
].join(",");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`;

  const redirectTo = sanitizeOAuthRedirectPath(url.searchParams.get("redirect_to"), "/social");

  const userId = await getAuthenticatedUserIdFromRequest(request, true);
  if (!userId) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  if (!APP_ID) {
    console.error(`[OAuth] META_APP_ID missing in production.`);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=config_missing&provider=meta`);
  }

  const state = createOAuthState(userId, redirectTo);
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: "code",
    state,
  });

  return NextResponse.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
}
