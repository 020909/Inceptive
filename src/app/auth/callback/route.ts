import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth code exchange for Supabase (Google / Facebook login).
 * Configure redirect URL in Supabase Dashboard: https://<host>/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = searchParams.get("next") || "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              /* ignore in non-mutable contexts */
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if this is a first-time user → create user row + 100 free credits
      const { data: { user } } = await supabase.auth.getUser();
      let isNewUser = false;

      if (user) {
        const admin = createAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: existingUser } = await admin
          .from("users")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!existingUser) {
          isNewUser = true;

          // Create user row
          await admin.from("users").insert({
            id: user.id,
            email: user.email,
            plan: "free",
            subscription_status: "inactive",
            memory_enabled: true,
          });

          // Give 100 free credits
          await admin.from("user_credits").upsert({
            user_id: user.id,
            plan: "free",
            credits_remaining: 500,
            credits_total: 500,
            period_start: new Date().toISOString(),
            period_end: new Date(Date.now() + 86_400_000).toISOString(),
            is_subscriber: false,
            daily_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
          });

          // Log the welcome bonus
          await admin.from("credit_transactions").insert({
            user_id: user.id,
            amount: 500,
            action: "chat_message",
            description: "Welcome bonus — 500 free credits 🎉",

          });
        }
      }

      const redirectPath = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
      const welcomeParam = isNewUser ? (redirectPath.includes("?") ? "&welcome=true" : "?welcome=true") : "";
      return NextResponse.redirect(`${origin}${redirectPath}${welcomeParam}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
