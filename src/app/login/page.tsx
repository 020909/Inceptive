"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<null | { type: "error" | "success"; message: string }>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email address";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setAuthFeedback(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthFeedback({ type: "error", message: error.message });
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    setAuthFeedback(null);
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) setAuthFeedback({ type: "error", message: error.message });
    setOauthLoading(null);
  };

  const handleMagicLink = async () => {
    if (!email) { setErrors({ email: "Enter your email first" }); return; }
    setAuthFeedback(null);
    setMagicLinkLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setAuthFeedback({ type: "error", message: error.message });
    else setAuthFeedback({ type: "success", message: "Magic link sent — check your email." });
    setMagicLinkLoading(false);
  };

  return (
    <div 
      className="min-h-screen flex bg-[var(--bg-base)]"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(201,100,66,0.12) 0%, transparent 52%), linear-gradient(180deg, rgba(255,255,255,0.45), transparent 28%), var(--bg-base)",
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative hidden overflow-hidden border-r border-[var(--border-default)] lg:flex lg:w-[52%] lg:flex-col lg:justify-between p-12"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 18%, rgba(201,100,66,0.14), transparent 28%), radial-gradient(circle at 82% 80%, rgba(20,20,19,0.08), transparent 32%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[0_0_0_1px_rgba(232,230,220,0.8)]">
            <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
          </div>
          <span className="text-lg text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-header)" }}>Inceptive</span>
        </div>

        <div className="relative z-10 max-w-xl space-y-8">
          <div className="inline-flex rounded-full border border-[var(--border-default)] bg-[rgba(255,255,255,0.62)] px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--fg-tertiary)] shadow-[0_0_0_1px_rgba(232,230,220,0.65)]">
            Autonomous Operating System
          </div>
          <h1 className="text-balance text-[4.3rem] leading-[0.96] text-[var(--fg-primary)]">
            Quiet power for
            <br />
            ambitious teams.
          </h1>
          <p className="max-w-md text-[1.05rem] leading-7 text-[var(--fg-tertiary)]">
            Inceptive should feel composed, premium, and inevitable. Research, operations, and execution in one warm, editorial workspace.
          </p>
          <div className="grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-[24px] border border-[var(--border-default)] bg-[rgba(255,255,255,0.72)] p-5 shadow-[0_18px_50px_rgba(78,66,51,0.08)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Response</p>
              <p className="mt-3 text-3xl text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-header)" }}>24/7</p>
              <p className="mt-2 text-sm leading-6 text-[var(--fg-tertiary)]">A calmer command layer for work that keeps moving.</p>
            </div>
            <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[0_18px_50px_rgba(78,66,51,0.06)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Signal</p>
              <p className="mt-3 text-3xl text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-header)" }}>Focused</p>
              <p className="mt-2 text-sm leading-6 text-[var(--fg-tertiary)]">Warm surfaces, clear hierarchy, no stray color noise.</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          © {new Date().getFullYear()} Inceptive AI
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="flex flex-1 items-center justify-center p-6 lg:p-16"
      >
        <div className="glass w-full max-w-[520px] rounded-[32px] p-8 shadow-[0_30px_80px_rgba(78,66,51,0.12)] lg:p-14">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
            </div>
            <span className="text-lg text-[var(--fg-primary)]" style={{ fontFamily: "var(--font-header)" }}>Inceptive</span>
          </div>

          <div className="mb-8 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Welcome back</p>
            <h2 className="text-[2.6rem] leading-[0.95] text-[var(--fg-primary)]">Sign in to Inceptive</h2>
            <p className="text-sm leading-6 text-[var(--fg-tertiary)]">Access the redesigned workspace and continue where your team left off.</p>
          </div>

          <motion.div whileTap={{ scale: 0.98 }} className="mb-6">
            <Button
              type="button"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth("google")}
              className="h-12 w-full rounded-2xl border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-primary)] shadow-[0_0_0_1px_rgba(232,230,220,0.78)] hover:bg-[var(--bg-surface)]"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </span>
              )}
            </Button>
          </motion.div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-default)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[var(--bg-base)] px-3 text-[11px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--fg-tertiary)]">Email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                className="h-12 rounded-2xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--ring)] focus:ring-0"
              />
              {errors.email && <p className="text-[11px] text-[var(--destructive)]">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--fg-tertiary)]">Password</Label>
              <Input
                id="password" type="password" placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                className="h-12 rounded-2xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--ring)] focus:ring-0"
              />
              {errors.password && <p className="text-[11px] text-[var(--destructive)]">{errors.password}</p>}
            </div>

            <motion.div whileTap={{ scale: 0.98 }} className="pt-1">
              <Button type="submit" disabled={loading}
                className="h-12 w-full rounded-2xl text-sm font-medium">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </motion.div>

            {authFeedback && (
              <p
                className={
                  authFeedback.type === "error"
                    ? "text-[11px] text-[var(--destructive)] leading-relaxed pt-1"
                    : "text-[11px] text-[var(--success)] leading-relaxed pt-1"
                }
              >
                {authFeedback.message}
              </p>
            )}
          </form>

          <motion.div whileTap={{ scale: 0.98 }} className="mt-3">
            <Button onClick={handleMagicLink} disabled={magicLinkLoading} variant="outline"
              className="h-12 w-full rounded-2xl text-[13px] font-medium">
              {magicLinkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send magic link"}
            </Button>
          </motion.div>

          <p className="mt-8 text-center text-[13px] text-[var(--fg-muted)]">
            No account?{" "}
            <Link href="/signup" className="font-medium text-[var(--accent)] transition-colors hover:text-[#d97757]">
              Sign up free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
