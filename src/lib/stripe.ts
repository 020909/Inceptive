import Stripe from "stripe";

// Lazy singleton — only instantiated on the server
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

// ── Plan definitions ──────────────────────────────────────────────────────────
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    credits: 100,          // per day
    creditPeriod: "day" as const,
    stripePriceId: null,
    features: [
      "100 AI credits / day",
      "Dashboard chat",
      "All feature pages (read-only)",
      "Bring Your Own API Key",
    ],
  },
  basic: {
    id: "basic",
    name: "Basic",
    price: 9,
    credits: 0,            // BYOK — no Inceptive credits consumed
    creditPeriod: "month" as const,
    stripePriceId: process.env.STRIPE_PRICE_BASIC,
    features: [
      "Full app access",
      "Unlimited BYOK usage (no credit burn)",
      "Email Autopilot",
      "Research engine",
      "Social Media Manager",
      "Goal tracking",
      "Weekly reports",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 29,
    credits: 5000,         // per month
    creditPeriod: "month" as const,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    features: [
      "5,000 Inceptive credits / month",
      "Everything in Basic",
      "Inceptive-hosted AI (no API key needed)",
      "Overnight autonomous tasks",
      "Human approval gates",
      "Priority support",
    ],
  },
  unlimited: {
    id: "unlimited",
    name: "Unlimited",
    price: 49,
    credits: 12000,        // per month
    creditPeriod: "month" as const,
    stripePriceId: process.env.STRIPE_PRICE_UNLIMITED,
    features: [
      "12,000 Inceptive credits / month",
      "Everything in Pro",
      "Agent Replay Videos",
      "Risk & Cost Simulator",
      "Advanced connectors",
      "Dedicated support",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

// ── Credit costs per action (1 = chat/small tool, 5 = search/email, 10 = computer+vision, 50 = long job) ──
// Basic ($9) = BYOK: Inceptive credits not charged (see credits.ts).
// Pro/Unlimited with active subscription: unlimited (see is_unlimited_bucket in credits.ts).
export const CREDIT_COSTS = {
  chat_message: 1,
  tool_small: 1,
  web_search: 5,
  browse_url: 5,
  email_draft: 5,
  email_read: 5,
  research_fast: 5,
  research_deep: 10,
  research_ultra: 20,
  social_post: 5,
  goal_create: 1,
  task_create: 1,
  goal_update: 1,
  computer_use_action: 10,
  autonomous_job_hour: 50,
  ai_chat_gemini: 1, // Dynamic cost — actual deduction is token-based in proxy.ts
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
