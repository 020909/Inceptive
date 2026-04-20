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

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loginHref, setLoginHref] = useState("/login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<null | { type: "error" | "success"; message: string }>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setLoginHref(`/login?next=${encodeURIComponent(next)}`);
    }
  }, []);

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email address";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Must be at least 6 characters";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setAuthFeedback(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthFeedback({ type: "error", message: error.message });
      setLoading(false);
      return;
    }
    setAuthFeedback({ type: "success", message: "Account created! Check your email to verify." });
    router.push(getReturnPath());
    router.refresh();
  };

  return (
    <div
      className="min-h-screen flex bg-[#000000]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* ── Left branding panel ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center p-12 border-r border-white/10 bg-[#000000] relative overflow-hidden"
      >
        <div className="relative z-10 text-center max-w-sm">
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="relative h-12 w-12 rounded-[10px] overflow-hidden border border-white/10 bg-white/5">
              <Image src="/logo.png" alt="Inceptive" fill sizes="48px" className="object-cover" />
            </div>
            <span
              className="text-white"
              style={{ fontFamily: "var(--font-header)", fontSize: "26px", fontWeight: 400 }}
            >
              Inceptive
            </span>
          </div>

          <h2
            className="text-white mb-4"
            style={{
              fontFamily: "var(--font-header)",
              fontSize: "clamp(32px, 3.5vw, 48px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.96px",
            }}
          >
            The first AI that works while you sleep.
          </h2>
          <p className="text-[16px] text-[#93939f] leading-relaxed">
            Not when you ask.
          </p>

          {/* Mini stat */}
          <div className="mt-10 rounded-[22px] border border-white/10 bg-[#171717] p-6 text-left">
            <p
              className="text-[#93939f]"
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.28px" }}
            >
              Avg. time saved
            </p>
            <p
              className="mt-2 text-white"
              style={{ fontFamily: "var(--font-header)", fontSize: "36px", fontWeight: 400 }}
            >
              23h / week
            </p>
            <p className="mt-1 text-[13px] text-[#93939f]">per employee, replacing manual workflows.</p>
          </div>
        </div>
      </motion.div>

      {/* ── Right auth form ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-1 items-center justify-center p-6 lg:p-16 bg-[#000000]"
      >
        <div className="w-full max-w-[480px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="relative h-8 w-8 rounded-[8px] overflow-hidden border border-white/10">
              <Image src="/logo.png" alt="Inceptive" fill sizes="32px" className="object-cover" />
            </div>
            <span className="text-white" style={{ fontFamily: "var(--font-header)", fontSize: "18px" }}>
              Inceptive
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <p
              className="text-[#93939f] mb-2"
              style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.28px" }}
            >
              New account
            </p>
            <h2
              className="text-white mb-1"
              style={{
                fontFamily: "var(--font-header)",
                fontSize: "clamp(26px, 3vw, 36px)",
                fontWeight: 400,
                lineHeight: 1.0,
                letterSpacing: "-0.72px",
              }}
            >
              Create your account
            </h2>
            <p className="text-[14px] text-[#93939f]">Get started with your 24/7 AI employee</p>
          </div>

          {/* Google OAuth */}
          <motion.div whileTap={{ scale: 0.98 }} className="mb-6">
            <button
              type="button"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth("google")}
              className="w-full h-12 rounded-full border border-white/10 bg-white/5 text-white text-[14px] hover:border-[#3b82f6] transition-colors flex items-center justify-center disabled:opacity-50"
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
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-[#93939f] bg-[#000000]"
                style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.16px" }}
              >
                or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-medium text-[#93939f] uppercase tracking-widest">Email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                className="h-11 rounded-[8px] text-sm bg-white/5 border-white/10 text-white placeholder:text-[#93939f] focus:border-[#3b82f6] focus:ring-0 transition-colors"
              />
              {errors.email && <p className="text-[11px] text-[var(--destructive)]">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-medium text-[#93939f] uppercase tracking-widest">Password</Label>
              <Input
                id="password" type="password" placeholder="Create a password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                className="h-11 rounded-[8px] text-sm bg-white/5 border-white/10 text-white placeholder:text-[#93939f] focus:border-[#3b82f6] focus:ring-0 transition-colors"
              />
              {errors.password && <p className="text-[11px] text-[var(--destructive)]">{errors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-[11px] font-medium text-[#93939f] uppercase tracking-widest">Confirm Password</Label>
              <Input
                id="confirmPassword" type="password" placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: undefined })); }}
                className="h-11 rounded-[8px] text-sm bg-white/5 border-white/10 text-white placeholder:text-[#93939f] focus:border-[#3b82f6] focus:ring-0 transition-colors"
              />
              {errors.confirmPassword && <p className="text-[11px] text-[var(--destructive)]">{errors.confirmPassword}</p>}
            </div>

            <motion.div whileTap={{ scale: 0.98 }} className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full bg-white text-black text-[14px] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </button>
            </motion.div>

            {authFeedback && (
              <p className={authFeedback.type === "error" ? "text-[11px] text-[var(--destructive)] leading-relaxed pt-1" : "text-[11px] text-[var(--success)] leading-relaxed pt-1"}>
                {authFeedback.message}
              </p>
            )}
          </form>

          <p className="mt-8 text-center text-[13px] text-[#93939f]">
            Already have an account?{" "}
            <Link href={loginHref} className="text-white hover:text-[#3b82f6] transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}