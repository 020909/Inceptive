import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PlanId } from "@/lib/stripe";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { AGENT_CHAINS } from "@/lib/council/config";

export const runtime = "nodejs";
export const maxDuration = 60;

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

/** Aligns with app billing: basic always uses basic chain; pro/unlimited need active subscription. */
function effectiveCouncilPlan(row: { plan: string | null; subscription_status: string | null }): string {
  const p = (row.plan || "free") as PlanId;
  const active =
    row.subscription_status === "active" || row.subscription_status === "trialing";
  if (p === "basic") return "basic";
  if (p === "pro" && active) return "pro";
  if (p === "unlimited" && active) return "unlimited";
  return "free";
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.prompt || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data: userData, error: userError } = await admin
    .from("users")
    .select("plan, subscription_status")
    .eq("id", userId)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ error: "Could not load user plan" }, { status: 500 });
  }

  const plan = effectiveCouncilPlan(userData);
  const chain = AGENT_CHAINS[plan] ?? AGENT_CHAINS.free;
  const firstAgent = chain[0];
  if (!firstAgent) {
    return NextResponse.json({ error: "Invalid agent chain" }, { status: 500 });
  }

  const { data: session, error: insertError } = await admin
    .from("council_sessions")
    .insert({
      user_id: userId,
      prompt: body.prompt.trim(),
      plan,
      status: "pending",
      current_agent: firstAgent,
      agents_completed: [],
      outputs: {},
    })
    .select("id")
    .single();

  if (insertError || !session) {
    console.error("[council/start]", insertError);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({
    session_id: session.id,
    plan,
    chain,
    first_agent: firstAgent,
  });
}
