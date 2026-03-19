/**
 * ONE-TIME setup route — creates Stripe products & prices for all plans.
 * Call this ONCE at: POST /api/stripe/setup
 * It will log the price IDs — copy them into your Vercel env vars.
 *
 * Protected by STRIPE_SETUP_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  // Protect with a secret so this can't be called by anyone
  const { secret } = await req.json().catch(() => ({}));
  if (secret !== process.env.STRIPE_SETUP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stripe = getStripe();
    const results: Record<string, string> = {};

    const plans = [
      { id: "basic",     name: "Inceptive Basic",     amount: 900,  description: "Full app access, BYOK, no credit burn" },
      { id: "pro",       name: "Inceptive Pro",        amount: 2900, description: "5,000 credits/month + hosted AI" },
      { id: "unlimited", name: "Inceptive Unlimited",  amount: 4900, description: "12,000 credits/month + all features" },
    ];

    for (const plan of plans) {
      // Check if product already exists
      const existing = await stripe.products.search({ query: `metadata["plan_id"]:"${plan.id}"` });

      let productId: string;
      if (existing.data.length > 0) {
        productId = existing.data[0].id;
        console.log(`[setup] Reusing existing product for ${plan.id}: ${productId}`);
      } else {
        const product = await stripe.products.create({
          name: plan.name,
          description: plan.description,
          metadata: { plan_id: plan.id },
        });
        productId = product.id;
        console.log(`[setup] Created product for ${plan.id}: ${productId}`);
      }

      // Check if price already exists for this product
      const existingPrices = await stripe.prices.list({ product: productId, active: true });
      if (existingPrices.data.length > 0) {
        results[plan.id] = existingPrices.data[0].id;
        console.log(`[setup] Reusing existing price for ${plan.id}: ${results[plan.id]}`);
      } else {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: plan.amount,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { plan_id: plan.id },
        });
        results[plan.id] = price.id;
        console.log(`[setup] Created price for ${plan.id}: ${price.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Copy these price IDs into your Vercel environment variables",
      env_vars: {
        STRIPE_PRICE_BASIC:     results.basic,
        STRIPE_PRICE_PRO:       results.pro,
        STRIPE_PRICE_UNLIMITED: results.unlimited,
      },
    });
  } catch (err: any) {
    console.error("Stripe setup error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
