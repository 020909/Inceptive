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

export type CreditCheckResult =
  | { allowed: true; remaining: number; plan: PlanId; unlimited: boolean }
  | { allowed: false; reason: string; remaining: number; plan: PlanId; unlimited: boolean };

/** BYOK basic, or paid Pro/Unlimited with active/trialing Stripe status — no Inceptive credit burn. */
export async function hasUnlimitedInceptiveCredits(userId: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin
    .from("users")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();
  if (!data) return false;
  if (data.plan === "basic") return true;
  const activeLike =
    data.subscription_status === "active" || data.subscription_status === "trialing";
  if ((data.plan === "pro" || data.plan === "unlimited") && activeLike) return true;
  return false;
}

function subscriberFlagForPlan(plan: PlanId): boolean {
  return plan === "basic" || plan === "pro" || plan === "unlimited";
}

export async function getOrInitCredits(userId: string) {
  const admin = getAdmin();

  const { data, error } = await admin
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!error && data) {
    const now = new Date();
    if (new Date(data.period_end) < now) {
      return await resetCredits(userId, data.plan as PlanId);
    }
    const unlimited = await hasUnlimitedInceptiveCredits(userId);
    const { error: syncErr } = await admin
      .from("user_credits")
      .update({
        is_subscriber: unlimited,
        daily_reset_at: data.period_end,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);
    if (syncErr) {
      /* is_subscriber / daily_reset_at require migration 010 */
    }
    return { ...data, is_subscriber: unlimited, daily_reset_at: data.period_end };
  }

  const inserted = await admin
    .from("user_credits")
    .insert({
      user_id: userId,
      plan: "free",
      credits_remaining: 100,
      credits_total: 100,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 86_400_000).toISOString(),
      is_subscriber: false,
      daily_reset_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .select()
    .single();

  return inserted.data;
}

export async function resetCredits(userId: string, plan: PlanId) {
  const admin = getAdmin();
  const planDef = PLANS[plan];
  const now = new Date();

  const total =
    plan === "basic"
      ? 999_999
      : planDef.credits;

  const periodEnd =
    plan === "free"
      ? new Date(now.getTime() + 86_400_000)
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const isSub = subscriberFlagForPlan(plan);

  const { data } = await admin
    .from("user_credits")
    .update({
      plan,
      credits_remaining: total,
      credits_total: total,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      daily_reset_at: periodEnd.toISOString(),
      is_subscriber: isSub,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();

  return data;
}

export async function checkCredits(
  userId: string,
  action: CreditAction
): Promise<CreditCheckResult> {
  const unlimited = await hasUnlimitedInceptiveCredits(userId);
  if (unlimited) {
    const plan = await getUserPlan(userId);
    return { allowed: true, remaining: 999_999, plan, unlimited: true };
  }

  const credits = await getOrInitCredits(userId);
  if (!credits) {
    return {
      allowed: false,
      reason: "Could not load credits",
      remaining: 0,
      plan: "free",
      unlimited: false,
    };
  }

  const plan = credits.plan as PlanId;
  const cost = CREDIT_COSTS[action];
  if (credits.credits_remaining < cost) {
    const limitMsg =
      plan === "free"
        ? "You're out of free credits for today. Upgrade for unlimited usage, or wait until your daily reset."
        : `Not enough credits (need ${cost}, have ${credits.credits_remaining}). Consider upgrading your plan.`;
    return {
      allowed: false,
      reason: limitMsg,
      remaining: credits.credits_remaining,
      plan,
      unlimited: false,
    };
  }

  return { allowed: true, remaining: credits.credits_remaining, plan, unlimited: false };
}

export async function deductCredits(
  userId: string,
  action: CreditAction,
  description?: string
): Promise<void> {
  if (await hasUnlimitedInceptiveCredits(userId)) return;

  const admin = getAdmin();
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

export async function getUserPlan(userId: string): Promise<PlanId> {
  const admin = getAdmin();
  const { data } = await admin
    .from("users")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();

  if (!data) return "free";

  const activeLike =
    data.subscription_status === "active" || data.subscription_status === "trialing";
  if (data.plan !== "free" && !activeLike) {
    return "free";
  }
  return (data.plan as PlanId) || "free";
}
