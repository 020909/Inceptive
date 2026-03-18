import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const TENANT = process.env.MICROSOFT_TENANT_ID || "common";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/microsoft/callback`;
const SCOPES = "offline_access User.Read Mail.Send Mail.ReadWrite";

export async function GET(request: Request) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "Microsoft OAuth not configured. Add MICROSOFT_CLIENT_ID to .env" }, { status: 503 });
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
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
    state,
  });

  return NextResponse.redirect(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${params.toString()}`);
}
