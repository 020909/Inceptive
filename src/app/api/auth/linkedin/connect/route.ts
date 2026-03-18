import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/linkedin/callback`;
const SCOPES = "openid profile email w_member_social";

export async function GET(request: Request) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "LinkedIn OAuth not configured. Add LINKEDIN_CLIENT_ID to .env" }, { status: 503 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const redirectTo = url.searchParams.get("redirect_to") || "/social";

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  const state = createOAuthState(user.id, redirectTo);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    scope: SCOPES,
  });

  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
}
