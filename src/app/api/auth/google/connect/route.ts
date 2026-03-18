import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

// Gmail send + read, YouTube upload, user profile
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");

export async function GET(request: Request) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID to .env" }, { status: 503 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const redirectTo = url.searchParams.get("redirect_to") || "/email";

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  const state = createOAuthState(user.id, redirectTo);
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
