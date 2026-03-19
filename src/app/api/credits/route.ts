import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getOrInitCredits } from "@/lib/credits";

const admin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/credits — returns current credits + plan for the logged-in user
export async function GET(req: NextRequest) {
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

    return NextResponse.json({
      credits: {
        remaining: credits?.credits_remaining ?? 0,
        total: credits?.credits_total ?? 0,
        period_end: credits?.period_end,
      },
      plan: userData.data?.plan ?? "free",
      subscription_status: userData.data?.subscription_status ?? "inactive",
      subscription_period_end: userData.data?.subscription_period_end,
      recent_transactions: transactions.data || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
