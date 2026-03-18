import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptToken } from "@/lib/token-crypto";

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/linkedin/callback`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return NextResponse.redirect(`${APP_URL}/social?error=${errorParam}`);
  if (!code || !state) return NextResponse.redirect(`${APP_URL}/social?error=missing_params`);

  const stateData = verifyOAuthState(state);
  if (!stateData) return NextResponse.redirect(`${APP_URL}/social?error=invalid_state`);

  const { userId, redirectTo } = stateData;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Fetch LinkedIn profile using OpenID
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await admin.from("connected_accounts").upsert({
      user_id: userId,
      provider: "linkedin",
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      token_expiry: expiry,
      account_email: profile.email,
      account_name: profile.name,
      account_id: profile.sub,
      scope: tokens.scope,
      metadata: { picture: profile.picture },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    return NextResponse.redirect(`${APP_URL}${redirectTo}?connected=linkedin`);
  } catch (err: any) {
    console.error("[LinkedIn OAuth callback]", err.message);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=${encodeURIComponent(err.message)}`);
  }
}
