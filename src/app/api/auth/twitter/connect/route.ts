import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sanitizeOAuthRedirectPath } from "@/lib/safe-redirect";
import crypto from "crypto";

const CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const SCOPES = "tweet.read tweet.write users.read offline.access";

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const REDIRECT_URI = `${APP_URL}/api/auth/twitter/callback`;
  const redirectTo = sanitizeOAuthRedirectPath(url.searchParams.get("redirect_to"), "/social");

  const userId = await getAuthenticatedUserIdFromRequest(request, true);
  if (!userId) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  if (!CLIENT_ID) {
    console.error(`[OAuth] TWITTER_CLIENT_ID missing in production.`);
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=config_missing&provider=twitter`);
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = createOAuthState(userId, redirectTo);

  // Store code_verifier in connected_accounts as a pending entry so callback can retrieve it
  await admin.from("connected_accounts").upsert({
    user_id: userId,
    provider: "twitter_pending",
    metadata: { code_verifier: codeVerifier, state },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
}
