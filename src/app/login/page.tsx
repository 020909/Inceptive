"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
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
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) toast.error(error.message);
    setOauthLoading(null);
  };

  const handleMagicLink = async () => {
    if (!email) { setErrors({ email: "Enter your email first" }); return; }
    setMagicLinkLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) { toast.error(error.message); } else { toast.success("Magic link sent — check your email"); }
    setMagicLinkLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#1C1C1E" }}>
      {/* Left branding panel */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-[#2C2C2E] relative overflow-hidden"
        style={{ background: "#141416" }}
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)" }} />

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-white/10">
            <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">Inceptive</span>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--foreground)]/30 bg-[var(--foreground)]/10">
            <Sparkles className="h-3.5 w-3.5 text-[var(--foreground)]" />
            <span className="text-xs font-medium text-[var(--foreground)]">Autonomous AI Platform</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            The AI that works<br />while you sleep.
          </h1>
          <p className="text-[#8E8E93] text-base leading-relaxed max-w-sm">
            Research, email, social media — all running autonomously 24 hours a day.
          </p>
        </div>

        <p className="text-xs text-[#48484A] relative z-10">
          © {new Date().getFullYear()} Inceptive AI. All rights reserved.
        </p>
      </motion.div>

      {/* Right auth form */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-1 items-center justify-center p-6 lg:p-16"
      >
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-white/10">
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
            </div>
            <span className="text-lg font-semibold text-white">Inceptive</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-1.5">Welcome back</h2>
            <p className="text-sm text-[#8E8E93]">Sign in to your Inceptive account</p>
          </div>

          <div className="space-y-3 mb-6">
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth("google")}
                className="w-full h-12 rounded-xl font-semibold text-sm text-black border border-[#38383A] relative overflow-hidden group transition-all duration-200 bg-white hover:bg-white/90"
                style={{
                   boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                {oauthLoading === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <div className="flex items-center justify-center gap-2.5 relative z-10">
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                  </div>
                )}
              </Button>
            </motion.div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-[#8E8E93] uppercase tracking-wide">Email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                className="h-11 rounded-xl text-sm text-white placeholder:text-[#48484A] focus-visible:ring-[var(--foreground)] transition-all duration-150"
                style={{ background: "#2A2A2C", border: errors.email ? "1px solid #FF453A" : "1px solid #38383A" }}
              />
              {errors.email && <p className="text-xs text-[#FF453A]">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-[#8E8E93] uppercase tracking-wide">Password</Label>
              <Input
                id="password" type="password" placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                className="h-11 rounded-xl text-sm text-white placeholder:text-[#48484A] focus-visible:ring-[var(--foreground)] transition-all duration-150"
                style={{ background: "#2A2A2C", border: errors.password ? "1px solid #FF453A" : "1px solid #38383A" }}
              />
              {errors.password && <p className="text-xs text-[#FF453A]">{errors.password}</p>}
            </div>

            <motion.div whileTap={{ scale: 0.98 }} className="pt-1">
              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl font-semibold text-sm border-0 transition-all duration-150 hover:opacity-90"
                style={{ background: "var(--foreground)", color: "#FFFFFF" }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
              </Button>
            </motion.div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2C2C2E]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-[#48484A]" style={{ background: "#1C1C1E" }}>or</span>
            </div>
          </div>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button onClick={handleMagicLink} disabled={magicLinkLoading} variant="outline"
              className="w-full h-11 rounded-xl font-medium text-sm text-white transition-all duration-150 hover:bg-[#2C2C2E]"
              style={{ background: "#242426", border: "1px solid #38383A" }}>
              {magicLinkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "✉  Send magic link"}
            </Button>
          </motion.div>

          <p className="mt-8 text-center text-sm text-[#48484A]">
            No account?{" "}
            <Link href="/signup" className="text-[var(--foreground)] hover:opacity-80 font-medium transition-opacity duration-150">
              Sign up free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
