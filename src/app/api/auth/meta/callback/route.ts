import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptToken } from "@/lib/token-crypto";

const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`;
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
    // Exchange code for long-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: REDIRECT_URI, code })
    );
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error.message);

    // Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: APP_ID,
        client_secret: APP_SECRET,
        fb_exchange_token: tokens.access_token,
      })
    );
    const longLived = await longLivedRes.json();
    const finalToken = longLived.access_token || tokens.access_token;

    // Fetch user profile
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${finalToken}`
    );
    const profile = await profileRes.json();

    // Save Facebook connection
    await admin.from("connected_accounts").upsert({
      user_id: userId,
      provider: "facebook",
      access_token: encryptToken(finalToken),
      token_expiry: longLived.expires_in
        ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
        : null,
      account_email: profile.email,
      account_name: profile.name,
      account_id: profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });

    // Try to fetch connected Instagram Business account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${finalToken}`
    );
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    if (pages.length > 0) {
      const page = pages[0];
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igRes.json();
      if (igData.instagram_business_account?.id) {
        await admin.from("connected_accounts").upsert({
          user_id: userId,
          provider: "instagram",
          access_token: encryptToken(page.access_token),
          account_name: page.name,
          account_id: igData.instagram_business_account.id,
          metadata: { page_id: page.id, page_access_token: page.access_token },
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,provider" });
      }
    }

    return NextResponse.redirect(`${APP_URL}${redirectTo}?connected=facebook`);
  } catch (err: any) {
    console.error("[Meta OAuth callback]", err.message);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=${encodeURIComponent(err.message)}`);
  }
}
