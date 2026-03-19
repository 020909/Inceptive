import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, PLANS, type PlanId } from "@/lib/stripe";
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
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

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
        const session = event.data.object as Stripe.CheckoutSession;
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
        if (!invoice.subscription) break;

        const sub = await getStripe().subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata?.supabase_user_id;
        const planId = sub.metadata?.plan as PlanId;
        if (!userId || !planId) break;

        // Only reset on renewal (not on first payment — subscription.created handles that)
        if ((invoice as any).billing_reason === "subscription_cycle") {
          await resetCredits(userId, planId);
        }
        break;
      }
    }
  } catch (err: any) {
    console.error("Webhook handler error:", err.message, err);
    // Return 200 so Stripe doesn't retry — log the error for investigation
  }

  return NextResponse.json({ received: true });
}
