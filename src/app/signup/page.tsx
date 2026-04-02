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

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

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
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) toast.error(error.message);
    setOauthLoading(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success("Account created! Check your email to verify.");
    router.push("/dashboard");
    router.refresh();
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
        className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center p-10 relative overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(101,16,244,0.12) 0%, transparent 65%)" }}
        />

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
            </div>
            <span className="text-3xl font-bold text-[var(--fg-primary)] tracking-[-0.04em]">Inceptive</span>
          </div>
          <p className="text-lg text-[var(--fg-tertiary)] leading-relaxed max-w-sm">
            The first AI that works while you sleep.
            <br />Not when you ask.
          </p>
        </div>
      </motion.div>

      {/* ── Right auth form ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-1 items-center justify-center p-6 lg:p-16 border-l border-[var(--border-subtle)]"
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
            <h2 className="text-2xl font-bold text-[var(--fg-primary)] tracking-[-0.03em] mb-1">Create your account</h2>
            <p className="text-sm text-[var(--fg-tertiary)]">Get started with your 24/7 AI employee</p>
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

          <form onSubmit={handleSignUp} className="space-y-4">
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
                id="password" type="password" placeholder="Create a password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                className="h-10 rounded-lg text-sm bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-strong)] focus:ring-0 transition-colors"
              />
              {errors.password && <p className="text-[11px] text-[var(--destructive)]">{errors.password}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Confirm Password</Label>
              <Input
                id="confirmPassword" type="password" placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: undefined })); }}
                className="h-10 rounded-lg text-sm bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--border-strong)] focus:ring-0 transition-colors"
              />
              {errors.confirmPassword && <p className="text-[11px] text-[var(--destructive)]">{errors.confirmPassword}</p>}
            </div>

            <motion.div whileTap={{ scale: 0.98 }} className="pt-1">
              <Button type="submit" disabled={loading}
                className="w-full h-10 rounded-lg font-medium text-sm bg-[var(--fg-primary)] text-[var(--bg-base)] hover:bg-white/90 border-0 transition-colors">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
              </Button>
            </motion.div>
          </form>

          <p className="mt-8 text-center text-[13px] text-[var(--fg-muted)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--fg-primary)] hover:text-white/80 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}