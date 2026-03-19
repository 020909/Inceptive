-- ============================================================
-- 008_subscriptions.sql
-- Subscription + credits system for Inceptive
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Extend users table with subscription fields ──────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'basic', 'pro', 'unlimited')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'inactive', 'trialing', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- ── 2. Credits ledger ─────────────────────────────────────────
-- One row per user per period (daily for free, monthly for paid).
-- credits_remaining decrements on each AI action.
-- A cron job (or webhook) resets on period_end.
CREATE TABLE IF NOT EXISTS public.user_credits (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan               TEXT        NOT NULL DEFAULT 'free',
  credits_remaining  INTEGER     NOT NULL DEFAULT 100,
  credits_total      INTEGER     NOT NULL DEFAULT 100,
  period_start       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)   -- one active credits row per user
);

-- ── 3. Credit transaction log ─────────────────────────────────
-- Every deduction gets logged for transparency / refunds.
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       INTEGER     NOT NULL,   -- negative = spend, positive = refund/topup
  action       TEXT        NOT NULL,   -- 'chat_message', 'web_search', 'research', 'email_draft', etc.
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. RLS ────────────────────────────────────────────────────
ALTER TABLE public.user_credits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own credits
CREATE POLICY "users_read_own_credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can write credits (server-side only)
CREATE POLICY "service_role_write_credits"
  ON public.user_credits FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "users_read_own_transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "service_role_write_transactions"
  ON public.credit_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- ── 5. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id
  ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id
  ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at
  ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer
  ON public.users(stripe_customer_id);

-- ── 6. Auto-create credits row on user signup ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_credits (
    user_id, plan, credits_remaining, credits_total,
    period_start, period_end
  ) VALUES (
    NEW.id, 'free', 100, 100,
    NOW(), NOW() + INTERVAL '1 day'
  ) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach to the users table (fires when the profile row is created)
DROP TRIGGER IF EXISTS on_user_created_credits ON public.users;
CREATE TRIGGER on_user_created_credits
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- ── 7. Backfill credits for existing users ────────────────────
INSERT INTO public.user_credits (
  user_id, plan, credits_remaining, credits_total, period_start, period_end
)
SELECT
  id, 'free', 100, 100, NOW(), NOW() + INTERVAL '1 day'
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- ── 8. RPC: atomic credit decrement ──────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_credits(
  p_user_id UUID,
  p_amount  INTEGER
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.user_credits
  SET
    credits_remaining = GREATEST(0, credits_remaining - p_amount),
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;
