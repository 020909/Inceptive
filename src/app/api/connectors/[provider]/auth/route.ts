import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { sanitizeOAuthRedirectPath } from "@/lib/safe-redirect";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const url = new URL(request.url);
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const redirectTo = sanitizeOAuthRedirectPath(url.searchParams.get("redirect_to"), "/social");
  const { provider } = await params;

  try {
    const userId = await getAuthenticatedUserIdFromRequest(request, true);
    if (!userId) {
      return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unauthorized`);
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);



    // Otherwise, redirect to the real OAuth route if it exists
    const realOAuthPaths: Record<string, string> = {
      twitter: "/api/auth/twitter/connect",
      linkedin: "/api/auth/linkedin/connect",
      facebook: "/api/auth/meta/connect",
      instagram: "/api/auth/meta/connect",
      tiktok: "/api/auth/tiktok/connect",
      google: "/api/auth/google/connect",
      microsoft: "/api/auth/microsoft/connect",
    };

    const targetPath = realOAuthPaths[provider];
    if (!targetPath) {
      return NextResponse.redirect(`${APP_URL}${redirectTo}?error=unsupported_provider`);
    }

    return NextResponse.redirect(`${APP_URL}${targetPath}?redirect_to=${encodeURIComponent(redirectTo)}&token=${url.searchParams.get("token") || ""}`);

  } catch (err: any) {
    return NextResponse.redirect(`${APP_URL}${redirectTo}?error=${encodeURIComponent(err.message)}`);
  }
}
