import Stripe from "stripe";

// Lazy singleton — only instantiated on the server
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
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

// ── Credit costs per action ───────────────────────────────────────────────────
// Basic ($9) plan users have BYOK — 0 credits for everything.
// Free/Pro/Unlimited use these rates.
export const CREDIT_COSTS = {
  chat_message:      10,   // simple chat reply
  web_search:        25,   // searchWeb tool call
  browse_url:        15,   // browseURL tool call
  email_draft:       50,   // draft email via agent
  research_fast:    100,   // fast depth research
  research_deep:    300,   // deep research
  research_ultra:   600,   // ultra depth
  social_post:       75,   // schedule social post
  goal_create:       20,   // create a goal
  task_create:       10,   // create a task
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;
