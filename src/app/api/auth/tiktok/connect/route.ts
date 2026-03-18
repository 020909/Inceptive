import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import crypto from "crypto";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/tiktok/callback`;
const SCOPES = "user.info.basic,video.publish,video.upload";

export async function GET(request: Request) {
  if (!CLIENT_KEY) {
    return NextResponse.json({ error: "TikTok OAuth not configured. Add TIKTOK_CLIENT_KEY to .env" }, { status: 503 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const redirectTo = url.searchParams.get("redirect_to") || "/social";

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  const state = createOAuthState(user.id, redirectTo);
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
