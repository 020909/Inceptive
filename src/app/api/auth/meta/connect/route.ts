import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";

const APP_ID = process.env.META_APP_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`;

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
  if (!APP_ID) {
    return NextResponse.json({ error: "Meta OAuth not configured. Add META_APP_ID to .env" }, { status: 503 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const redirectTo = url.searchParams.get("redirect_to") || "/social";

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  const state = createOAuthState(user.id, redirectTo);
  const params = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: "code",
    state,
  });

  return NextResponse.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
}
