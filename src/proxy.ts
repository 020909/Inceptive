import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "1; mode=block",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function withSecurityHeaders(response: NextResponse) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function hasValidCronAuthorization(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET || process.env.INNGEST_SIGNING_KEY;
  const header = request.headers.get("authorization")?.trim();

  if (!configuredSecret || !header) {
    return false;
  }

  return header === `Bearer ${configuredSecret}`;
}

export async function proxy(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 1024 * 1024) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Request too large." }, { status: 413 })
    );
  }

  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  if (
    process.env.NODE_ENV === "production" &&
    (userAgent.includes("curl") || userAgent.includes("python-requests"))
  ) {
    console.warn("[proxy] Suspicious user agent", {
      path: request.nextUrl.pathname,
      userAgent,
    });
  }

  if (
    request.nextUrl.pathname === "/api/run-agents" ||
    request.nextUrl.pathname === "/api/test-slack"
  ) {
    const fromVercelCron = Boolean(request.headers.get("x-vercel-cron")?.trim());

    if (!fromVercelCron && !hasValidCronAuthorization(request)) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* App routes are browsable without a session; sign-in is enforced client-side for credit/API actions. */

  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const url = request.nextUrl.clone();
    const nextPath = url.searchParams.get("next");
    if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      return withSecurityHeaders(NextResponse.redirect(new URL(nextPath, url.origin)));
    }
    url.pathname = "/dashboard";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
