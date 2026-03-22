import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, type PlanId } from "@/lib/stripe";
import { resetCredits } from "@/lib/credits";
import Stripe from "stripe";

export const runtime = "nodejs";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Subscription created or updated ──────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        const planId = (sub.metadata?.plan as PlanId) || "free";
        const status = sub.status; // 'active' | 'trialing' | 'past_due' | etc.
        // billing_cycle_anchor is the next renewal date in Stripe v20+
        const periodEnd = sub.billing_cycle_anchor
          ? new Date(sub.billing_cycle_anchor * 1000).toISOString()
          : null;

        await admin.from("users").update({
          plan: planId,
          stripe_subscription_id: sub.id,
          subscription_status: status,
          subscription_period_end: periodEnd,
        }).eq("id", userId);

        // Reset credits to new plan amount
        if (status === "active" || status === "trialing") {
          await resetCredits(userId, planId);
        }
        break;
      }

      // ── Subscription cancelled ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        await admin.from("users").update({
          plan: "free",
          subscription_status: "canceled",
          stripe_subscription_id: null,
          subscription_period_end: null,
        }).eq("id", userId);

        await resetCredits(userId, "free");
        break;
      }

      // ── Payment failed ────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: userData } = await admin
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (userData) {
          await admin.from("users").update({
            subscription_status: "past_due",
          }).eq("id", userData.id);
        }
        break;
      }

      // ── Checkout completed ────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const planId = session.metadata?.plan as PlanId;
        if (!userId || !planId) break;

        // The subscription.created event handles the actual update,
        // but we do a quick customer ID sync here just in case
        if (session.customer) {
          await admin.from("users").update({
            stripe_customer_id: session.customer as string,
          }).eq("id", userId);
        }
        break;
      }

      // ── Monthly credits reset (invoice paid = new billing period) ─────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // In Stripe v20+, subscription info is in invoice.parent
        const subscriptionId = (invoice as any).parent?.subscription_details?.subscription
          ?? (invoice as any).subscription;
        if (!subscriptionId) break;

        const sub = await getStripe().subscriptions.retrieve(subscriptionId as string);
        const userId = sub.metadata?.supabase_user_id;
        const planId = sub.metadata?.plan as PlanId;
        if (!userId || !planId) break;

        // Only reset on renewal (not on first payment — subscription.created handles that)
        const billingReason = (invoice as any).billing_reason ?? "";
        if (billingReason === "subscription_cycle") {
          await resetCredits(userId, planId);
        }
        break;
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Webhook handler error:", message, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
