"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Session } from "@supabase/supabase-js";
import { useTheme } from "@/lib/theme-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, Loader2, Check, ChevronRight,
  Sun, Moon, User, Shield, Bell, Cpu, Brain, Mail,
  Activity, PauseCircle, Clock,
} from "lucide-react";
import { useChat } from "@/lib/chat-context";
import { useAgent } from "@/lib/agent-context";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models — best for reasoning & writing",
    logo: "/logos/ai/anthropic.png",
    keyPrefix: "sk-ant-",
    keyHint: "Starts with sk-ant-",
    keyUrl: "https://console.anthropic.com/keys",
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Most powerful · Best quality" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Balanced · Recommended" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", description: "Fastest · Lowest cost" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models — versatile and widely used",
    logo: "/logos/ai/openai.png",
    keyPrefix: "sk-",
    keyHint: "Starts with sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Most capable · Multimodal" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast · Cost-effective" },
      { id: "o3-mini", name: "o3-mini", description: "Advanced reasoning" },
    ],
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini models — great speed and context",
    logo: "/logos/ai/google.png",
    keyPrefix: "AIza",
    keyHint: "Starts with AIza",
    keyUrl: "https://aistudio.google.com/app/apikey",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Fast · Recommended" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Long context · Powerful" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fastest Gemini" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models with one API key",
    logo: "/logos/ai/openrouter.png",
    keyPrefix: "sk-or-",
    keyHint: "Starts with sk-or-",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Via OpenRouter · Recommended" },
      { id: "openai/gpt-4o", name: "GPT-4o", description: "Via OpenRouter" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Via OpenRouter" },
      { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B", description: "Open source · Free tier" },
      { id: "mistralai/mistral-large", name: "Mistral Large", description: "Via OpenRouter" },
    ],
  },
];

type Step = "provider" | "model" | "key";
type Section = "ai" | "account" | "mail" | "appearance" | "memory" | "agent";

const SECTIONS: { id: Section; label: string; icon: typeof Cpu }[] = [
  { id: "ai", label: "AI Configuration", icon: Cpu },
  { id: "agent", label: "Agent", icon: Activity },
  { id: "account", label: "My Account", icon: User },
  { id: "mail", label: "Email connectors", icon: Mail },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "memory", label: "Memory", icon: Brain },
];

export default function SettingsPage() {
  const { user, session, refresh: refreshAuth } = useAuth();
  const { theme, setTheme } = useTheme();
  const { memoryEnabled, setMemoryEnabled } = useChat();
  const { is24_7Mode, toggle24_7Mode, requiresApproval, setRequiresApproval, sleepAfterMinutes, setSleepAfterMinutes } = useAgent();
  const [savingMemory, setSavingMemory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedProvider, setSavedProvider] = useState<string>("");
  const [savedModel, setSavedModel] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [step, setStep] = useState<Step>("provider");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("ai");
  const [forceGemini, setForceGemini] = useState(true);
  const [savingGemini, setSavingGemini] = useState(false);

  const [yahooEmail, setYahooEmail] = useState("");
  const [yahooPassword, setYahooPassword] = useState("");
  const [yahooSaving, setYahooSaving] = useState(false);

  // My Account
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [memberSince, setMemberSince] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        if (!session?.access_token) {
          if (!loading) setLoading(false);
          return;
        }

        if (user?.created_at) {
          setMemberSince(new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
        }
        if (user?.user_metadata?.display_name) {
          setDisplayName(user.user_metadata.display_name);
        }

        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSavedProvider(data.api_provider || "");
          setSavedModel(data.api_model || "");
          setHasApiKey(data.has_api_key);
          setSelectedProvider(data.api_provider || "");
          setSelectedModel(data.api_model || "");
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [session, user]);

  const providerData = PROVIDERS.find(p => p.id === selectedProvider);

  const handleSave = async () => {
    if (!session?.access_token || !selectedProvider || !selectedModel || !apiKeyInput.trim()) {
      toast.error("Please complete all steps before saving");
      return;
    }

    // Warn if the key format doesn't match the selected provider
    const providerMeta = PROVIDERS.find(p => p.id === selectedProvider);
    if (providerMeta?.keyPrefix && !apiKeyInput.trim().startsWith(providerMeta.keyPrefix)) {
      toast.error(
        `This doesn't look like a ${providerMeta.name} key. ${providerMeta.name} keys ${providerMeta.keyHint}. Check you selected the right provider.`,
        { duration: 6000 }
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          api_provider: selectedProvider,
          api_model: selectedModel,
          api_key_encrypted: apiKeyInput.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save");
      toast.success("Settings saved — you're all set!");
      setSavedProvider(selectedProvider);
      setSavedModel(selectedModel);
      setHasApiKey(true);
      setApiKeyInput("");
      setStep("provider");
    } catch (err: any) {
      toast.error(err.message, { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const handleYahooConnect = async () => {
    if (!session?.access_token || !yahooEmail.trim() || !yahooPassword.trim()) {
      toast.error("Enter Yahoo address and app password");
      return;
    }
    setYahooSaving(true);
    try {
      const res = await fetch("/api/connectors/yahoo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email: yahooEmail.trim(), app_password: yahooPassword.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success("Yahoo Mail connected");
      setYahooPassword("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setYahooSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!session?.access_token) return;
    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (error) throw error;
      toast.success("Display name updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/login` });
    toast.success("Password reset email sent to " + user.email);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-4xl">
          <div className="h-7 w-32 shimmer rounded-lg mb-6" />
          <div className="h-[400px] rounded-2xl shimmer" />
        </div>
      </PageTransition>
    );
  }

  const currentProviderMeta = PROVIDERS.find(p => p.id === savedProvider);
  const currentModelMeta = currentProviderMeta?.models.find(m => m.id === savedModel);

  return (
    <PageTransition>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>Settings</h1>

        {/* Two-column layout: Nav (left) + Content (right) */}
        <div className="flex gap-6 items-start">

          {/* ─── Left: Vertical Nav ─── */}
          <div className="w-52 shrink-0 sticky top-6">
            <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
              {SECTIONS.map((s, i) => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-150 ${i !== SECTIONS.length - 1 ? "border-b" : ""}`}
                    style={{
                      background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                      borderColor: "var(--border)",
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? "var(--foreground)" : "var(--foreground-secondary)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {s.label}
                    </span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Right: Content Panel ─── */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">

              {/* ── AI Configuration ── */}
              {activeSection === "ai" && (
                <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>AI Configuration</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>Powered by Inceptive's optimized Gemini 2.0 Flash model</p>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: "rgba(48,209,88,0.08)", borderColor: "rgba(255,255,255,0.1)" }}>
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl shrink-0" style={{ background: "#FFFFFF20" }}>
                          <Cpu className="w-6 h-6 text-[#FFFFFF]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-white">Gemini 2.0 Flash</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase" style={{ background: "#FFFFFF30", color: "#FFFFFF" }}>Active</span>
                          </div>
                          <p className="text-xs text-[var(--foreground-secondary)]">Optimized for speed and intelligence. Uses your Inceptive credits.</p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col gap-2">
                        <p className="text-[10px] text-[var(--foreground-tertiary)] uppercase font-semibold tracking-wider">Advanced</p>
                        <p className="text-xs text-[var(--foreground-secondary)]">Custom API keys are currently disabled to ensure maximum platform stability. All agents are automatically utilizing the high-performance Gemini 2.0 backbone.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Agent Settings ── */}
              {activeSection === "agent" && (
                <motion.div key="agent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                  {/* 24/7 Mode */}
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>24/7 Autonomous Mode</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>Keep your agent working around the clock</p>
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Enable 24/7 Mode</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>
                            Agent stays active and enters sleep mode when idle. Automatically wakes when new tasks arrive.
                          </p>
                        </div>
                        <button
                          onClick={toggle24_7Mode}
                          className="relative shrink-0 h-7 w-12 rounded-full transition-colors duration-200"
                          style={{ background: is24_7Mode ? "var(--foreground)" : "var(--background-overlay)", border: "1px solid var(--border)" }}
                          aria-label="Toggle 24/7 mode"
                        >
                          <motion.div
                            className="absolute top-0.5 h-6 w-6 rounded-full"
                            style={{ background: is24_7Mode ? "var(--background)" : "var(--foreground-secondary)" }}
                            animate={{ left: is24_7Mode ? "calc(100% - 26px)" : "2px" }}
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        </button>
                      </div>

                      {is24_7Mode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[var(--foreground-secondary)]" />
                              <span className="text-xs" style={{ color: "var(--foreground)" }}>Sleep after</span>
                            </div>
                            <select
                              value={sleepAfterMinutes}
                              onChange={(e) => setSleepAfterMinutes(Number(e.target.value))}
                              className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs"
                              style={{ color: "var(--foreground)" }}
                            >
                              <option value={1}>1 minute</option>
                              <option value={5}>5 minutes</option>
                              <option value={15}>15 minutes</option>
                              <option value={30}>30 minutes</option>
                              <option value={60}>1 hour</option>
                            </select>
                          </div>
                          <p className="text-[10px] text-[var(--foreground-muted)]">
                            Agent will enter sleep mode after this period of inactivity to save credits.
                          </p>
                        </motion.div>
                      )}

                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${is24_7Mode ? "bg-[var(--success)]" : "bg-[var(--foreground-muted)]"}`} />
                        <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                          {is24_7Mode
                            ? "24/7 mode is ON — Agent will work continuously and auto-sleep when idle"
                            : "24/7 mode is OFF — Agent runs only when you're actively using the dashboard"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Approval Settings */}
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Approval Control</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>Control when the agent requires your approval</p>
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Require Approval</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>
                            Agent pauses before executing each task and waits for your approval. Recommended for critical operations.
                          </p>
                        </div>
                        <button
                          onClick={() => setRequiresApproval(!requiresApproval)}
                          className="relative shrink-0 h-7 w-12 rounded-full transition-colors duration-200"
                          style={{ background: requiresApproval ? "var(--warning)" : "var(--background-overlay)", border: "1px solid var(--border)" }}
                          aria-label="Toggle approval requirement"
                        >
                          <motion.div
                            className="absolute top-0.5 h-6 w-6 rounded-full"
                            style={{ background: requiresApproval ? "var(--background)" : "var(--foreground-secondary)" }}
                            animate={{ left: requiresApproval ? "calc(100% - 26px)" : "2px" }}
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                        <PauseCircle className={`w-4 h-4 shrink-0 ${requiresApproval ? "text-[var(--warning)]" : "text-[var(--foreground-muted)]"}`} />
                        <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                          {requiresApproval
                            ? "Agent will pause before each task — you'll need to approve actions"
                            : "Agent runs autonomously without pausing for approval"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cost Optimization Tip */}
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Cost Optimization</h2>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--accent-subtle)" }}>
                          <Moon className="w-4 h-4 text-[var(--accent)]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Smart Sleep Mode</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>
                            When enabled, the agent automatically sleeps during inactivity to minimize credit usage.
                            This is our key advantage over competitors — you only pay for actual work done.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── My Account ── */}
              {activeSection === "account" && (
                <motion.div key="account" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Profile</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>Your account information</p>
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                          style={{ background: "var(--foreground)" }}>
                          {(displayName || user?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                            {displayName || user?.email?.split("@")[0] || "User"}
                          </div>
                          <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{user?.email}</div>
                          {memberSince && <div className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>Member since {memberSince}</div>}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>Display Name</Label>
                        <div className="flex gap-2">
                          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Enter your name"
                            className="h-10 rounded-xl text-sm flex-1 focus-visible:ring-[var(--foreground)]"
                            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                          <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()}
                            className="h-10 px-4 rounded-xl text-sm border-0 disabled:opacity-40"
                            style={{ background: "var(--foreground)", color: "#FFFFFF" }}>
                            {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>Email Address</Label>
                        <div className="h-10 flex items-center px-3 rounded-xl text-sm" style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground-secondary)" }}>
                          {user?.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Security</h2>
                    </div>
                    <div className="p-5 space-y-3">
                      <button onClick={handleResetPassword}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-150 hover:opacity-75"
                        style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                        <div className="flex items-center gap-3">
                          <Shield className="w-4 h-4 text-[var(--foreground)]" />
                          <div>
                            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Change Password</div>
                            <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Send a reset link to your email</div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "rgba(255,59,48,0.2)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,59,48,0.15)" }}>
                      <h2 className="text-sm font-semibold text-[#FF453A]">Danger Zone</h2>
                    </div>
                    <div className="p-5">
                      <button onClick={() => toast.error("To delete your account, contact support@inceptive.ai")}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 hover:opacity-75"
                        style={{ background: "rgba(255,59,48,0.06)", borderColor: "rgba(255,59,48,0.2)" }}>
                        <span className="text-sm font-semibold text-[#FF453A]">Delete Account</span>
                        <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>— permanently removes all data</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Appearance ── */}
              {activeSection === "mail" && (
                <motion.div key="mail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Gmail</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>
                        OAuth (same as Email Autopilot). Stores refresh token in Supabase.
                      </p>
                    </div>
                    <div className="p-5">
                      <Link href="/email">
                        <Button className="rounded-xl" style={{ background: "var(--foreground)", color: "#fff" }}>
                          Connect Gmail
                        </Button>
                      </Link>
                    </div>
                  </div>
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Yahoo Mail</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>
                        Use a Yahoo <strong>app password</strong> (Account security → generate app password). Stored encrypted.
                      </p>
                    </div>
                    <div className="p-5 space-y-3 max-w-md">
                      <div>
                        <Label className="text-xs text-[var(--foreground-secondary)]">Yahoo email</Label>
                        <Input value={yahooEmail} onChange={(e) => setYahooEmail(e.target.value)} placeholder="you@yahoo.com" className="mt-1 rounded-xl" />
                      </div>
                      <div>
                        <Label className="text-xs text-[var(--foreground-secondary)]">App password</Label>
                        <Input type="password" value={yahooPassword} onChange={(e) => setYahooPassword(e.target.value)} className="mt-1 rounded-xl" />
                      </div>
                      <Button onClick={handleYahooConnect} disabled={yahooSaving} className="rounded-xl" style={{ background: "var(--foreground)", color: "#fff" }}>
                        {yahooSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Yahoo"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === "appearance" && (
                <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Theme</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>Choose how Inceptive looks</p>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: "dark" as const, label: "Dark", icon: Moon, preview: "#0A0A0A", surface: "#111111", border: "#222222", text: "#FFFFFF", sub: "#888888" },
                          { id: "light" as const, label: "Light", icon: Sun, preview: "#F5F5F7", surface: "#FFFFFF", border: "#D2D2D7", text: "#0A0A0A", sub: "#6E6E73" },
                        ].map(t => {
                          const Icon = t.icon;
                          const isActive = theme === t.id;
                          return (
                            <motion.button key={t.id} whileTap={{ scale: 0.97 }}
                              onClick={() => setTheme(t.id)}
                              className="relative flex flex-col overflow-hidden rounded-2xl transition-all duration-200"
                              style={{ border: `2px solid ${isActive ? "var(--foreground)" : "var(--border)"}` }}>
                              <div className="w-full aspect-[4/3] p-3 flex flex-col gap-2" style={{ background: t.preview }}>
                                <div className="h-1.5 w-3/4 rounded-full" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                                <div className="flex gap-1.5 flex-1">
                                  <div className="w-7 rounded-md" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                                  <div className="flex-1 flex flex-col gap-1 justify-center">
                                    <div className="h-1.5 w-4/5 rounded-full" style={{ background: t.text, opacity: 0.85 }} />
                                    <div className="h-1.5 w-1/2 rounded-full" style={{ background: t.sub }} />
                                    <div className="h-5 w-full rounded-lg mt-1" style={{ background: "var(--foreground)" }} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between px-3 py-2.5" style={{ background: "var(--background-elevated)" }}>
                                <div className="flex items-center gap-2">
                                  <Icon className="w-3.5 h-3.5" style={{ color: isActive ? "var(--foreground)" : "var(--foreground-secondary)" }} />
                                  <span className="text-sm font-semibold" style={{ color: isActive ? "var(--foreground)" : "var(--foreground)" }}>{t.label}</span>
                                </div>
                                {isActive && <Check className="w-3.5 h-3.5 text-[var(--foreground)]" />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Notifications</h2>
                    </div>
                    <div className="p-5 flex items-center gap-3 opacity-50">
                      <Bell className="w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
                      <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Notification preferences coming soon</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Memory ── */}
              {activeSection === "memory" && (
                <motion.div key="memory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Memory</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>
                        Save chat history so you can pick up where you left off
                      </p>
                    </div>
                    <div className="p-5 space-y-5">
                      {/* Toggle row */}
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Enable Memory</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>
                            Your recent chats will be saved and appear in the Recents section of the sidebar. You can turn this off at any time.
                          </p>
                        </div>
                        {/* Toggle switch */}
                        <button
                          onClick={async () => {
                            setSavingMemory(true);
                            await setMemoryEnabled(!memoryEnabled);
                            setSavingMemory(false);
                          }}
                          disabled={savingMemory}
                          className="relative shrink-0 h-7 w-12 rounded-full transition-colors duration-200 disabled:opacity-50"
                          style={{ background: memoryEnabled ? "var(--foreground)" : "var(--background-overlay)", border: "1px solid var(--border)" }}
                          aria-label="Toggle memory"
                        >
                          <motion.div
                            className="absolute top-0.5 h-6 w-6 rounded-full"
                            style={{ background: memoryEnabled ? "var(--background)" : "var(--foreground-secondary)" }}
                            animate={{ left: memoryEnabled ? "calc(100% - 26px)" : "2px" }}
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        </button>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${memoryEnabled ? "bg-[#FFFFFF]" : "bg-[var(--foreground-secondary)]"}`} />
                        <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                          {memoryEnabled
                            ? "Memory is ON — chats are being saved and will appear in Recents"
                            : "Memory is OFF — chats are only kept for the current browser session"}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}
