"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

function getReturnPath(): string {
  if (typeof window === "undefined") return "/dashboard";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [signupHref, setSignupHref] = useState("/signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<null | { type: "error" | "success"; message: string }>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setSignupHref(`/signup?next=${encodeURIComponent(next)}`);
    }
  }, []);

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
    const dest = getReturnPath();
    router.push(dest);
    router.refresh();
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    setAuthFeedback(null);
    setOauthLoading(provider);
    const next = encodeURIComponent(getReturnPath());
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
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
    <div className="min-h-screen flex bg-[var(--void)]" style={{ fontFamily: "var(--font-body)" }}>
      {/* ── Left branding panel ── */}
<motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
      className="relative hidden overflow-hidden border-r border-[var(--border-faint)] bg-[var(--void)] lg:flex lg:w-[52%] lg:flex-col lg:justify-between p-14"
    >
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-[8px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
            <Image src="/logo.png" alt="Inceptive" fill sizes="40px" className="object-cover" />
          </div>
<span
      className="text-lg text-[var(--text-primary)]"
      style={{ fontFamily: "var(--font-header)" }}
    >
      Inceptive
    </span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-xl space-y-10">
<div
      className="inline-flex rounded-full border border-[var(--border-subtle)] px-4 py-1.5 text-[11px] text-[var(--text-secondary)]"
      style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.28px" }}
    >
      Autonomous Operating System
    </div>

<h1
      className="text-[var(--text-primary)]"
      style={{
        fontFamily: "var(--font-header)",
        fontSize: "clamp(38px, 4.5vw, 60px)",
        fontWeight: 400,
        lineHeight: 1.0,
        letterSpacing: "-1.2px",
      }}
    >
      Quiet power for
      <br />
      ambitious teams.
    </h1>

          <p className="max-w-md text-[16px] leading-7 text-[var(--text-secondary)]">
            Built for enterprises that want AI to execute real work: research, operations, and delivery in one secure, editorial workspace.
          </p>

          {/* Stat cards */}
<div className="grid max-w-lg grid-cols-2 gap-4">
      <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-container)] p-6">
        <p
          className="text-[var(--text-secondary)]"
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.28px" }}
        >
          Response
        </p>
        <p
          className="mt-3 text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-header)", fontSize: "32px", fontWeight: 400 }}
        >
          24/7
        </p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">A calmer command layer for work that keeps moving.</p>
      </div>
      <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-6">
        <p
          className="text-[var(--text-secondary)]"
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.28px" }}
        >
          Signal
        </p>
        <p
          className="mt-3 text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-header)", fontSize: "32px", fontWeight: 400 }}
        >
          Focused
        </p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">Warm surfaces, clear hierarchy, no stray color noise.</p>
      </div>
    </div>
        </div>

<p
      className="relative z-10 text-[var(--text-secondary)]"
      style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.16px" }}
    >
      © {new Date().getFullYear()} Inceptive AI
    </p>
      </motion.div>

      {/* ── Right auth form ── */}
<motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08 }}
      className="flex flex-1 items-center justify-center p-6 lg:p-16 bg-[var(--void)]"
    >
      <div className="w-full max-w-[500px] bg-[var(--surface-container)] rounded-[22px] border border-[var(--border-subtle)] p-10 lg:p-14">
          {/* Mobile logo */}
<div className="mb-10 flex items-center gap-3 lg:hidden">
      <div className="relative h-9 w-9 overflow-hidden rounded-[8px] border border-[var(--border-subtle)]">
        <Image src="/logo.png" alt="Inceptive" fill sizes="36px" className="object-cover" />
      </div>
      <span className="text-lg text-[var(--text-primary)]" style={{ fontFamily: "var(--font-header)" }}>
        Inceptive
      </span>
    </div>

          {/* Heading */}
          <div className="mb-8 space-y-2">
<p
      className="text-[var(--text-secondary)]"
      style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.28px" }}
    >
      Welcome back
    </p>
    <h2
      className="text-[var(--text-primary)]"
      style={{
        fontFamily: "var(--font-header)",
        fontSize: "clamp(28px, 3vw, 38px)",
        fontWeight: 400,
        lineHeight: 1.0,
        letterSpacing: "-0.76px",
      }}
    >
      Sign in to Inceptive
    </h2>
    <p className="text-[14px] leading-6 text-[var(--text-secondary)]">
      Access the redesigned workspace and continue where your team left off.
    </p>
  </div>

          {/* Google OAuth */}
<motion.div whileTap={{ scale: 0.98 }} className="mb-6">
    <button
      type="button"
      disabled={!!oauthLoading}
      onClick={() => handleOAuth("google")}
      className="h-12 w-full rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-primary)] text-[14px] hover:border-[var(--text-secondary)] transition-colors flex items-center justify-center disabled:opacity-50"
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
    </button>
  </motion.div>

          {/* Divider */}
<div className="relative my-6">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-[var(--border-subtle)]" />
    </div>
    <div className="relative flex justify-center">
      <span
        className="bg-[var(--surface-container)] px-3 text-[var(--text-secondary)]"
        style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.16px" }}
      >
        or continue with email
      </span>
    </div>
  </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
<div className="space-y-1.5">
    <Label htmlFor="email" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">Email</Label>
    <Input
      id="email" type="email" placeholder="you@example.com"
      value={email}
      onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
      className="h-12 rounded-[8px] border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-container)]"
    />
    {errors.email && <p className="text-[11px] text-[var(--destructive)]">{errors.email}</p>}
  </div>

<div className="space-y-1.5">
    <Label htmlFor="password" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">Password</Label>
    <Input
      id="password" type="password" placeholder="••••••••"
      value={password}
      onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
      className="h-12 rounded-[8px] border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-container)]"
    />
    {errors.password && <p className="text-[11px] text-[var(--destructive)]">{errors.password}</p>}
  </div>

            <motion.div whileTap={{ scale: 0.98 }} className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-full bg-white text-black text-[14px] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </button>
            </motion.div>

            {authFeedback && (
              <p className={authFeedback.type === "error" ? "text-[11px] text-[var(--destructive)] leading-relaxed pt-1" : "text-[11px] text-[var(--success)] leading-relaxed pt-1"}>
                {authFeedback.message}
              </p>
            )}
          </form>

          {/* Magic Link */}
<motion.div whileTap={{ scale: 0.98 }} className="mt-3">
    <button
      onClick={handleMagicLink}
      disabled={magicLinkLoading}
      className="h-12 w-full rounded-full border border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] hover:border-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors disabled:opacity-50 flex items-center justify-center"
    >
      {magicLinkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send magic link"}
    </button>
  </motion.div>

  <p className="mt-8 text-center text-[13px] text-[var(--text-secondary)]">
    No account?{" "}
    <Link href={signupHref} className="text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors">
      Sign up free
    </Link>
  </p>
        </div>
      </motion.div>
    </div>
  );
}
