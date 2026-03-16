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
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Invalid email address";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Welcome back!");
    router.push("/dashboard");
    router.refresh();
  };

  const handleMagicLink = async () => {
    if (!email) {
      setErrors({ email: "Enter your email for magic link" });
      return;
    }
    setMagicLinkLoading(true);

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email for the magic link!");
    }
    setMagicLinkLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-black">
      {/* Left side — branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-xl overflow-hidden border border-white/20 shrink-0">
            <Image src="/logo.png" alt="Inceptive Logo" fill className="object-cover" />
          </div>
          <span className="text-4xl font-bold text-white tracking-tight">
            Inceptive
          </span>
        </div>
        <p className="text-xl text-[#888888] text-center max-w-md leading-relaxed">
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

          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-[#888888] text-sm mb-8">
            Sign in to your account to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-[#888888]">
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
                className="h-11 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200"
              />
              {errors.email && (
                <p className="text-xs text-[#EF4444]">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-[#888888]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className="h-11 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200"
              />
              {errors.password && (
                <p className="text-xs text-[#EF4444]">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-lg font-medium transition-all duration-200"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1F1F1F]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-black px-3 text-[#555555]">or</span>
            </div>
          </div>

          <Button
            onClick={handleMagicLink}
            disabled={magicLinkLoading}
            variant="outline"
            className="w-full h-11 bg-transparent border-[#333333] text-white hover:bg-[#111111] rounded-lg font-medium transition-all duration-200"
          >
            {magicLinkLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send magic link"
            )}
          </Button>

          <p className="mt-6 text-center text-sm text-[#555555]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-white hover:text-white/80 transition-colors duration-200"
            >
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
