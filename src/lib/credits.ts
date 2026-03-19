/**
 * Server-side credit management helpers.
 * All functions use the Supabase service-role client (admin).
 */

import { createClient } from "@supabase/supabase-js";
import { CREDIT_COSTS, PLANS, type CreditAction, type PlanId } from "./stripe";

const getAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// ── Types ────────────────────────────────────────────────────────────────────
export type CreditCheckResult =
  | { allowed: true; remaining: number; plan: PlanId }
  | { allowed: false; reason: string; remaining: number; plan: PlanId };

// ── Get or initialise credits row ─────────────────────────────────────────────
export async function getOrInitCredits(userId: string) {
  const admin = getAdmin();

  // First try fetching existing row
  const { data, error } = await admin
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!error && data) {
    // If period has expired, reset credits based on current plan
    const now = new Date();
    if (new Date(data.period_end) < now) {
      return await resetCredits(userId, data.plan as PlanId);
    }
    return data;
  }

  // No row — create free tier default
  const inserted = await admin
    .from("user_credits")
    .insert({
      user_id: userId,
      plan: "free",
      credits_remaining: 100,
      credits_total: 100,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 86_400_000).toISOString(), // +1 day
    })
    .select()
    .single();

  return inserted.data;
}

// ── Reset credits for a new period ────────────────────────────────────────────
export async function resetCredits(userId: string, plan: PlanId) {
  const admin = getAdmin();
  const planDef = PLANS[plan];
  const now = new Date();

  const total =
    plan === "basic"
      ? 999_999  // BYOK — effectively unlimited (we don't charge credits)
      : planDef.credits;

  const periodEnd =
    plan === "free"
      ? new Date(now.getTime() + 86_400_000)        // +1 day
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()); // +1 month

  const { data } = await admin
    .from("user_credits")
    .update({
      credits_remaining: total,
      credits_total: total,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  return data;
}

// ── Check if user can afford an action ────────────────────────────────────────
export async function checkCredits(
  userId: string,
  action: CreditAction
): Promise<CreditCheckResult> {
  const credits = await getOrInitCredits(userId);
  if (!credits) {
    return { allowed: false, reason: "Could not load credits", remaining: 0, plan: "free" };
  }

  const plan = credits.plan as PlanId;

  // Basic plan ($9) is BYOK — never charge credits
  if (plan === "basic") {
    return { allowed: true, remaining: credits.credits_remaining, plan };
  }

  const cost = CREDIT_COSTS[action];
  if (credits.credits_remaining < cost) {
    const limitMsg =
      plan === "free"
        ? `You've used your 100 free daily credits. Upgrade to Pro for 5,000 credits/month.`
        : `Not enough credits (need ${cost}, have ${credits.credits_remaining}). Consider upgrading your plan.`;
    return {
      allowed: false,
      reason: limitMsg,
      remaining: credits.credits_remaining,
      plan,
    };
  }

  return { allowed: true, remaining: credits.credits_remaining, plan };
}

// ── Deduct credits after an action ────────────────────────────────────────────
export async function deductCredits(
  userId: string,
  action: CreditAction,
  description?: string
): Promise<void> {
  const admin = getAdmin();
  const plan = await getUserPlan(userId);

  // Basic plan — never charge
  if (plan === "basic") return;

  const cost = CREDIT_COSTS[action];

  await admin.rpc("decrement_credits", {
    p_user_id: userId,
    p_amount: cost,
  });

  await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: -cost,
    action,
    description: description || action,
  });
}

// ── Get user's current plan from DB ───────────────────────────────────────────
export async function getUserPlan(userId: string): Promise<PlanId> {
  const admin = getAdmin();
  const { data } = await admin
    .from("users")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();

  if (!data) return "free";

  // Treat canceled/past_due as free
  if (data.plan !== "free" && data.subscription_status !== "active") {
    return "free";
  }
  return (data.plan as PlanId) || "free";
}
