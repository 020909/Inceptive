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

/** Founder / internal account: higher daily free-pool on the free plan only (set FOUNDER_DAILY_CREDITS_EMAIL in env to override). */
const FOUNDER_DAILY_CREDITS_EMAIL =
  (process.env.FOUNDER_DAILY_CREDITS_EMAIL || "alymaknojiya@icloud.com").toLowerCase().trim();
const FOUNDER_DAILY_CREDITS_AMOUNT = Math.max(
  1,
  Number.parseInt(process.env.FOUNDER_DAILY_CREDITS_AMOUNT || "1000", 10) || 1000
);

async function isFounderDailyGrant(userId: string): Promise<boolean> {
  if (!FOUNDER_DAILY_CREDITS_EMAIL) return false;
  const admin = getAdmin();
  const { data } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
  const em = (data?.email as string | undefined)?.toLowerCase().trim();
  return !!em && em === FOUNDER_DAILY_CREDITS_EMAIL;
}

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
    // One-time / ongoing sync: founder gets a 1000/day pool on free instead of 100
    if ((data.plan as PlanId) === "free" && (await isFounderDailyGrant(userId))) {
      const cap = FOUNDER_DAILY_CREDITS_AMOUNT;
      if (Number(data.credits_total) < cap) {
        const prevTotal = Number(data.credits_total) || 0;
        const prevRem = Number(data.credits_remaining) || 0;
        const bump = cap - prevTotal;
        const nextRem = Math.min(cap, prevRem + Math.max(0, bump));
        await admin
          .from("user_credits")
          .update({
            credits_total: cap,
            credits_remaining: nextRem,
            updated_at: now.toISOString(),
          })
          .eq("user_id", userId);
        const { data: fresh } = await admin.from("user_credits").select("*").eq("user_id", userId).single();
        if (fresh) {
          const unlimited = await hasUnlimitedInceptiveCredits(userId);
          return { ...fresh, is_subscriber: unlimited, daily_reset_at: fresh.period_end };
        }
      }
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

  const founderFree = (await isFounderDailyGrant(userId)) ? FOUNDER_DAILY_CREDITS_AMOUNT : 100;

  const inserted = await admin
    .from("user_credits")
    .insert({
      user_id: userId,
      plan: "free",
      credits_remaining: founderFree,
      credits_total: founderFree,
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

  let total =
    plan === "basic"
      ? 999_999
      : planDef.credits;
  if (plan === "free" && (await isFounderDailyGrant(userId))) {
    total = FOUNDER_DAILY_CREDITS_AMOUNT;
  }

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
