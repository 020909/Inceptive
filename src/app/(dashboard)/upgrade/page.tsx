"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { Check, Zap, Crown, Rocket, Loader2, Star } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PLANS } from "@/lib/stripe";
import { cn } from "@/lib/utils";

const PLAN_ICONS = {
  free:      <Zap className="w-5 h-5" />,
  basic:     <Rocket className="w-5 h-5" />,
  pro:       <Star className="w-5 h-5" />,
  unlimited: <Crown className="w-5 h-5" />,
};

const PLAN_CARD_BORDER: Record<string, string> = {
  free: "border-[var(--border-subtle)]",
  basic: "border-[var(--success-soft)]",
  pro: "border-[var(--accent-soft)]",
  unlimited: "border-[var(--warning-soft)]",
};

const PLAN_ICON_BOX_MAP: Record<string, string> = {
  free: "bg-[var(--bg-overlay)] border-[var(--border-subtle)]",
  basic: "bg-[var(--bg-surface)] border-[var(--success-soft)]",
  pro: "bg-[var(--accent-muted)] border-[var(--accent-soft)]",
  unlimited: "bg-[var(--warning-soft)] border-[var(--warning-soft)]",
};

function UpgradePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState<string | null>(null);
  const [creditsInfo, setCreditsInfo] = useState<any>(null);

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      toast.success("Welcome to your new plan! 🎉", { duration: 5000 });
      router.replace("/dashboard");
    }
    // Fetch current plan
    fetch("/api/credits")
      .then(r => r.json())
      .then(d => {
        setCurrentPlan(d.plan || "free");
        setCreditsInfo(d);
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (planId === "free") return;
    if (planId === currentPlan) {
      toast("You're already on this plan");
      return;
    }
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    { ...PLANS.free,      id: "free" },
    { ...PLANS.basic,     id: "basic" },
    { ...PLANS.pro,       id: "pro",       popular: true },
    { ...PLANS.unlimited, id: "unlimited" },
  ];

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8 bg-[var(--bg-app)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-subtle)] text-xs font-medium mb-4 text-[var(--fg-secondary)] bg-[var(--bg-elevated)]">
          <Zap className="w-3 h-3" /> Your 24/7 AI Employee
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--fg-primary)] tracking-tight mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-[var(--fg-secondary)] text-base max-w-md mx-auto">
          No surprise bills. Cancel anytime. Your data, your control.
        </p>
        {creditsInfo && currentPlan !== "free" && (
          <button
            onClick={handleManageBilling}
            disabled={loading === "portal"}
            className="mt-4 text-sm text-[var(--fg-secondary)] underline hover:text-[var(--fg-primary)] transition-colors"
          >
            {loading === "portal" ? "Opening..." : "Manage billing & invoices →"}
          </button>
        )}
      </motion.div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {plans.map((plan, i) => {
          const isCurrent = plan.id === currentPlan;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5",
                (plan as any).popular ? "bg-[var(--accent-soft)]" : "bg-[var(--bg-elevated)]",
                isCurrent ? "border-[var(--ring)]" : PLAN_CARD_BORDER[plan.id]
              )}
            >
              {(plan as any).popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold text-[var(--accent-foreground)] bg-[var(--accent)]">
                  MOST POPULAR
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[10px] font-bold bg-[var(--fg-primary)] text-[var(--bg-base)]">
                  CURRENT
                </div>
              )}

              {/* Icon + Name */}
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center text-[var(--fg-primary)] border",
                    PLAN_ICON_BOX_MAP[plan.id]
                  )}
                >
                  {PLAN_ICONS[plan.id as keyof typeof PLAN_ICONS]}
                </div>
                <div>
                  <p className="text-[var(--fg-primary)] font-semibold text-sm">{plan.name}</p>
                  <p className="text-[var(--fg-tertiary)] text-[11px]">
                    {plan.id === "free" ? "Always free" :
                     plan.id === "basic" ? "BYOK platform fee" :
                     plan.id === "pro" ? "Hosted AI included" : "Max power"}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-5">
                <span className="text-3xl font-bold text-[var(--fg-primary)]">${plan.price}</span>
                <span className="text-[var(--fg-secondary)] text-sm">/mo</span>
                <p className="text-xs text-[var(--fg-tertiary)] mt-1">
                  {plan.id === "free" && "100 credits / day"}
                  {plan.id === "basic" && "Unlimited BYOK usage"}
                  {plan.id === "pro" && "5,000 credits / month"}
                  {plan.id === "unlimited" && "12,000 credits / month"}
                </p>
              </div>

              {/* Features */}
              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[var(--fg-secondary)]">
                    <Check className="w-3.5 h-3.5 text-[var(--fg-primary)] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                disabled={!!loading || isCurrent || plan.id === "free"}
                onClick={() => handleSubscribe(plan.id)}
                className={cn(
                  "w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
                  isCurrent || plan.id === "free"
                    ? "bg-[var(--border-subtle)] text-[var(--fg-secondary)]"
                    : "bg-[var(--fg-primary)] text-[var(--bg-base)]"
                )}
              >
                {loading === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Redirecting...
                  </span>
                ) : isCurrent ? "Current plan" :
                   plan.id === "free" ? "Always free" :
                   `Upgrade to ${plan.name}`}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Credits explainer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="max-w-2xl mx-auto mt-10 p-5 rounded-2xl border border-[var(--border-subtle)] text-sm bg-[var(--bg-elevated)]"
      >
        <p className="font-semibold text-[var(--fg-primary)] mb-2">What are Inceptive Credits?</p>
        <p className="text-[var(--fg-secondary)] leading-relaxed">
          Credits are consumed when Inceptive does work for you using our hosted AI.
          A quick chat reply = 10 credits. A web search = 25. A deep research report = 100–300.
          <span className="text-[var(--fg-primary)]"> Basic plan ($9) users bring their own API key — zero credits consumed,
          no limits.</span> Credits reset daily (free) or monthly (Pro/Unlimited).
        </p>
      </motion.div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradePageInner />
    </Suspense>
  );
}
