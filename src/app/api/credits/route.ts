import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getOrInitCredits } from "@/lib/credits";

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/credits — returns current credits + plan for the logged-in user
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [credits, userData] = await Promise.all([
      getOrInitCredits(user.id),
      admin.from("users").select("plan, subscription_status, subscription_period_end").eq("id", user.id).single(),
    ]);

    const transactions = await admin
      .from("credit_transactions")
      .select("amount, action, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const unlimited =
      (userData.data?.plan === "basic") ||
      ((userData.data?.plan === "pro" || userData.data?.plan === "unlimited") &&
        (userData.data?.subscription_status === "active" ||
          userData.data?.subscription_status === "trialing"));

    return NextResponse.json({
      credits: {
        remaining: credits?.credits_remaining ?? 0,
        total: credits?.credits_total ?? 0,
        period_end: credits?.period_end,
        daily_reset_at: (credits as { daily_reset_at?: string })?.daily_reset_at ?? credits?.period_end,
        is_subscriber: (credits as { is_subscriber?: boolean })?.is_subscriber ?? false,
      },
      unlimited,
      plan: userData.data?.plan ?? "free",
      subscription_status: userData.data?.subscription_status ?? "inactive",
      subscription_period_end: userData.data?.subscription_period_end,
      recent_transactions: transactions.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
