import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import crypto from "crypto";

const CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";
const REDIRECT_URI = `${APP_URL}/api/auth/twitter/callback`;
const SCOPES = "tweet.read tweet.write users.read offline.access";

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request) {
  if (!CLIENT_ID) {
    return NextResponse.json({ error: "Twitter OAuth not configured. Add TWITTER_CLIENT_ID to .env" }, { status: 503 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const redirectTo = url.searchParams.get("redirect_to") || "/social";

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = createOAuthState(user.id, redirectTo);

  // Store code_verifier in connected_accounts as a pending entry so callback can retrieve it
  await admin.from("connected_accounts").upsert({
    user_id: user.id,
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
