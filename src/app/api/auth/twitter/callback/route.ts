import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptToken } from "@/lib/token-crypto";

const CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/twitter/callback`;

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
    // Retrieve code_verifier stored during connect
    const { data: pending } = await admin
      .from("connected_accounts")
      .select("metadata")
      .eq("user_id", userId)
      .eq("provider", "twitter_pending")
      .single();

    const codeVerifier = pending?.metadata?.code_verifier;
    if (!codeVerifier) throw new Error("Missing code_verifier. Please try connecting again.");

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Fetch Twitter user info
    const profileRes = await fetch("https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profileData = await profileRes.json();
    const profile = profileData.data || {};

    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await admin.from("connected_accounts").upsert({
      user_id: userId,
      provider: "twitter",
      access_token: encryptToken(tokens.access_token),
      refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      token_expiry: expiry,
      account_name: profile.name || profile.username,
      account_id: profile.id,
      scope: tokens.scope,
      metadata: { username: profile.username, picture: profile.profile_image_url },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    // Clean up pending entry
    await admin.from("connected_accounts").delete().eq("user_id", userId).eq("provider", "twitter_pending");

    return NextResponse.redirect(`${APP_URL}${redirectTo}?connected=twitter`);
  } catch (err: any) {
    console.error("[Twitter OAuth callback]", err.message);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=${encodeURIComponent(err.message)}`);
  }
}
