import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptToken } from "@/lib/token-crypto";

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;
const TENANT = process.env.MICROSOFT_TENANT_ID || "common";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/microsoft/callback`;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return NextResponse.redirect(`${APP_URL}/email?error=${errorParam}`);
  if (!code || !state) return NextResponse.redirect(`${APP_URL}/email?error=missing_params`);

  const stateData = verifyOAuthState(state);
  if (!stateData) return NextResponse.redirect(`${APP_URL}/email?error=invalid_state`);

  const { userId, redirectTo } = stateData;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await admin.from("connected_accounts").upsert({
      user_id: userId,
      provider: "outlook",
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      token_expiry: expiry,
      account_email: profile.mail || profile.userPrincipalName,
      account_name: profile.displayName,
      account_id: profile.id,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    return NextResponse.redirect(`${APP_URL}${redirectTo}?connected=outlook`);
  } catch (err: any) {
    console.error("[Microsoft OAuth callback]", err.message);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=${encodeURIComponent(err.message)}`);
  }
}
