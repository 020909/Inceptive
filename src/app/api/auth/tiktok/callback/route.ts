import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptToken } from "@/lib/token-crypto";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY!;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET!;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/tiktok/callback`;
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";
  const errorParam = url.searchParams.get("error");

  if (errorParam) return NextResponse.redirect(`${APP_URL}/social?error=${errorParam}`);
  if (!code || !stateRaw) return NextResponse.redirect(`${APP_URL}/social?error=missing_params`);

  // State format: {oauthState}.{csrfState}
  const state = stateRaw.split(".").slice(0, -1).join(".");
  const stateData = verifyOAuthState(state);
  if (!stateData) return NextResponse.redirect(`${APP_URL}/social?error=invalid_state`);

  const { userId, redirectTo } = stateData;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await admin.from("connected_accounts").upsert({
      user_id: userId,
      provider: "tiktok",
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      token_expiry: expiry,
      account_name: tokens.open_id,
      account_id: tokens.open_id,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    return NextResponse.redirect(`${APP_URL}${redirectTo}?connected=tiktok`);
  } catch (err: any) {
    console.error("[TikTok OAuth callback]", err.message);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=${encodeURIComponent(err.message)}`);
  }
}
