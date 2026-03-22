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
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Account created! Check your email to verify.");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex bg-[#1C1C1E]">
      {/* Left side — branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-[#141416]"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden border border-white/20 shrink-0">
            <Image src="/logo.png" alt="Inceptive Logo" fill className="object-cover" />
          </div>
          <span className="text-4xl font-bold text-white tracking-tight">
            Inceptive
          </span>
        </div>
        <p className="text-xl text-[#8E8E93] text-center max-w-md leading-relaxed">
          The first AI that works while you sleep.
          <br />
          Not when you ask.
        </p>
      </motion.div>

      {/* Right side — form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-1 items-center justify-center p-6 lg:p-12"
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden border border-white/20 shrink-0">
              <Image src="/logo.png" alt="Inceptive Logo" fill className="object-cover" />
            </div>
            <span className="text-2xl font-bold text-white">Inceptive</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Create your account
          </h1>
          <p className="text-[#8E8E93] text-sm mb-8">
            Get started with your 24/7 AI employee
          </p>

          <div className="space-y-3 mb-6">
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth("google")}
                className="w-full h-12 rounded-xl font-semibold text-sm text-black border border-[#38383A] relative overflow-hidden group transition-all duration-200 bg-white hover:bg-white/90"
                style={{
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
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

          <form onSubmit={handleSignUp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-[#8E8E93]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className="h-11 bg-[#2A2A2C] border-[#38383A] text-white placeholder:text-[#636366] rounded-lg focus:border-[var(--foreground)] focus:ring-0 transition-colors duration-200"
              />
              {errors.email && (
                <p className="text-xs text-[#FF453A]">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-[#8E8E93]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className="h-11 bg-[#2A2A2C] border-[#38383A] text-white placeholder:text-[#636366] rounded-lg focus:border-[var(--foreground)] focus:ring-0 transition-colors duration-200"
              />
              {errors.password && (
                <p className="text-xs text-[#FF453A]">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm text-[#8E8E93]">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }}
                className="h-11 bg-[#2A2A2C] border-[#38383A] text-white placeholder:text-[#636366] rounded-lg focus:border-[var(--foreground)] focus:ring-0 transition-colors duration-200"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-[#FF453A]">{errors.confirmPassword}</p>
              )}
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[var(--foreground)] text-white hover:bg-[#0A84FF] rounded-lg font-medium transition-all duration-200"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create account"
                )}
              </Button>
            </motion.div>
          </form>

          <p className="mt-6 text-center text-sm text-[#636366]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-white hover:text-white/80 transition-colors duration-200"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
