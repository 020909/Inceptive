"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) toast.error(error.message);
    setOauthLoading(null);
  };

  const handleMagicLink = async () => {
    if (!email) { setErrors({ email: "Enter your email first" }); return; }
    setMagicLinkLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) toast.error(error.message);
    else toast.success("Magic link sent — check your email");
    setMagicLinkLoading(false);
  };

  return (
    <div 
      className="min-h-screen flex bg-[var(--bg-base)]"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(101,16,244,0.15) 0%, transparent 70%), var(--bg-base)" }}
    >
      {/* ── Left branding panel ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 border-r border-[var(--border-subtle)] relative overflow-hidden"
      >
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(101,16,244,0.12) 0%, transparent 65%)" }}
        />

        <div className="flex items-center gap-2.5 relative z-10">
          <div className="relative h-8 w-8 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
          </div>
          <span className="text-[var(--fg-primary)] font-semibold text-base tracking-[-0.03em]">Inceptive</span>
        </div>

        <div className="relative z-10 space-y-5">
          <h1 className="text-[40px] font-bold text-[var(--fg-primary)] leading-[1.1] tracking-[-0.04em] text-balance">
            The AI that works<br />while you sleep.
          </h1>
          <p className="text-[var(--fg-tertiary)] text-base leading-relaxed max-w-sm">
            Research, email, outreach — all running autonomously, around the clock.
          </p>
        </div>

        <p className="text-[11px] text-[var(--fg-muted)] relative z-10">
          © {new Date().getFullYear()} Inceptive AI
        </p>
      </motion.div>

      {/* ── Right auth form ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-1 items-center justify-center p-6 lg:p-16"
      >
        <div className="w-full max-w-[400px] glass rounded-[24px] p-12">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
            </div>
            <span className="text-[var(--fg-primary)] font-semibold text-base">Inceptive</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[var(--fg-primary)] tracking-[-0.03em] mb-1">Welcome back</h2>
            <p className="text-sm text-[var(--fg-tertiary)]">Sign in to your account</p>
          </div>

          {/* Google OAuth */}
          <motion.div whileTap={{ scale: 0.98 }} className="mb-6">
            <Button
              type="button"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth("google")}
              className="w-full h-11 rounded-xl font-medium text-sm text-[var(--bg-base)] bg-white hover:bg-white/90 border-0 transition-colors"
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

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-subtle)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-[11px] text-[var(--fg-muted)] bg-[var(--bg-base)]">or continue with email</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                className="h-10 rounded-lg text-sm bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-strong)] focus:ring-0 transition-colors"
              />
              {errors.email && <p className="text-[11px] text-[var(--destructive)]">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Password</Label>
              <Input
                id="password" type="password" placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                className="h-10 rounded-lg text-sm bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-strong)] focus:ring-0 transition-colors"
              />
              {errors.password && <p className="text-[11px] text-[var(--destructive)]">{errors.password}</p>}
            </div>

            <motion.div whileTap={{ scale: 0.98 }} className="pt-1">
              <Button type="submit" disabled={loading}
                className="w-full h-10 rounded-lg font-medium text-sm bg-[var(--fg-primary)] text-[var(--bg-base)] hover:bg-white/90 border-0 transition-colors">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </motion.div>
          </form>

          {/* Magic link */}
          <motion.div whileTap={{ scale: 0.98 }} className="mt-3">
            <Button onClick={handleMagicLink} disabled={magicLinkLoading} variant="outline"
              className="w-full h-10 rounded-lg font-medium text-[13px] bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)] transition-colors">
              {magicLinkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send magic link"}
            </Button>
          </motion.div>

          <p className="mt-8 text-center text-[13px] text-[var(--fg-muted)]">
            No account?{" "}
            <Link href="/signup" className="text-[var(--fg-primary)] hover:text-white/80 font-medium transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}