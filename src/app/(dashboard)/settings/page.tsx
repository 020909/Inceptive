"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Session } from "@supabase/supabase-js";
import { useTheme } from "@/lib/theme-context";
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
      { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", description: "Free · Best for coding" },
      { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B", description: "Open source · Free tier" },
      { id: "mistralai/mistral-large", name: "Mistral Large", description: "Via OpenRouter" },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast inference — free tier available",
    logo: "/logos/ai/openrouter.png",
    keyPrefix: "gsk_",
    keyHint: "Starts with gsk_",
    keyUrl: "https://console.groq.com/keys",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Fast · Free tier · Recommended" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Fastest · Free tier" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B", description: "Google · Free tier" },
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

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-7 w-11 shrink-0 cursor-pointer items-center overflow-hidden rounded-full border border-[var(--border-default)] p-[3px] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-[var(--fg-primary)]" : "bg-[var(--bg-overlay)]"}`}
      aria-label="Toggle"
      aria-pressed={on}
    >
      <motion.span
        className={`pointer-events-none block h-5 w-5 shrink-0 rounded-full shadow-sm ${on ? "bg-[var(--bg-base)]" : "bg-[var(--fg-tertiary)]"}`}
        initial={false}
        animate={{ x: on ? 18 : 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 38 }}
      />
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`command-surface rounded-[24px] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
      <h2 className="text-sm font-semibold text-[var(--fg-primary)]">{title}</h2>
      {description && <p className="text-xs mt-0.5 text-[var(--fg-tertiary)]">{description}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { user, session, refresh: refreshAuth } = useAuth();
  const { theme, setTheme } = useTheme();
  const { memoryEnabled, setMemoryEnabled } = useChat();
  const { 
    is24_7Mode, toggle24_7Mode, 
    requiresApproval, setRequiresApproval, 
    sleepAfterMinutes, setSleepAfterMinutes,
    aiName, setAiName,
    aiPersonality, setAiPersonality,
    aiTone, setAiTone
  } = useAgent();
  const [savingMemory, setSavingMemory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedProvider, setSavedProvider] = useState<string>("");
  const [savedModel, setSavedModel] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [step, setStep] = useState<Step>("provider");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("ai");

  const [yahooEmail, setYahooEmail] = useState("");
  const [yahooPassword, setYahooPassword] = useState("");
  const [yahooSaving, setYahooSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [memberSince, setMemberSince] = useState("");
  const [creditInfo, setCreditInfo] = useState<{ remaining: number; total: number; plan: string; unlimited?: boolean } | null>(null);

  const [scheduledName, setScheduledName] = useState("");
  const [scheduledCron, setScheduledCron] = useState("0 9 * * 1");
  const [scheduledPrompt, setScheduledPrompt] = useState("");
  const [scheduledSaving, setScheduledSaving] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);

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
        const creditsRes = await fetch("/api/credits");
        if (creditsRes.ok) {
          const c = await creditsRes.json();
          setCreditInfo({
            remaining: c.credits?.remaining ?? 0,
            total: c.credits?.total ?? 0,
            plan: c.plan ?? "free",
            unlimited: c.unlimited ?? false,
          });
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [session, user]);

  const fetchScheduledTasks = async () => {
    if (!session?.access_token) return;
    setScheduledLoading(true);
    try {
      const res = await fetch("/api/scheduled-tasks", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const d = await res.json();
      if (res.ok) setScheduledTasks(d.tasks || []);
    } catch {
    } finally {
      setScheduledLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.access_token || !selectedProvider || !selectedModel || !apiKeyInput.trim()) {
      toast.error("Please complete all steps before saving");
      return;
    }
    const providerMeta = PROVIDERS.find(p => p.id === selectedProvider);
    if (providerMeta?.keyPrefix && !apiKeyInput.trim().startsWith(providerMeta.keyPrefix)) {
      toast.error(`This doesn't look like a ${providerMeta.name} key. ${providerMeta.name} keys ${providerMeta.keyHint}. Check you selected the right provider.`, { duration: 6000 });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ api_provider: selectedProvider, api_model: selectedModel, api_key_encrypted: apiKeyInput.trim() }),
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
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

  const createScheduledTask = async () => {
    if (!session?.access_token) return;
    if (!scheduledName.trim() || !scheduledCron.trim() || !scheduledPrompt.trim()) {
      toast.error("Name, cron, and prompt are required");
      return;
    }
    setScheduledSaving(true);
    try {
      const res = await fetch("/api/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: scheduledName.trim(),
          schedule_cron: scheduledCron.trim(),
          prompt: scheduledPrompt.trim(),
          timezone: "UTC",
          enabled: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to create");
      toast.success("Scheduled task created");
      setScheduledName("");
      setScheduledPrompt("");
      await fetchScheduledTasks();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScheduledSaving(false);
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
      <div className="page-frame max-w-5xl">
        <div className="h-7 w-32 rounded-lg bg-[var(--bg-surface)] animate-pulse mb-6" />
        <div className="h-[400px] rounded-xl bg-[var(--bg-surface)] animate-pulse" />
        </div>
    );
  }

  return (
    <div className="page-frame max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-hero mb-6 px-6 py-6"
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">Preferences</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.02em]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">Control AI behavior, account details, memory, connectors, and agent defaults.</p>
      </motion.div>

        <div className="flex gap-6 items-start">

        {/* Left nav */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-52 shrink-0 sticky top-6"
        >
          <div className="command-surface rounded-[24px] overflow-hidden">
              {SECTIONS.map((s, i) => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 ${
                    i !== SECTIONS.length - 1 ? "border-b border-[var(--border-subtle)]" : ""
                  } ${isActive ? "bg-[var(--bg-elevated)]" : "hover:bg-[var(--bg-elevated)]"}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--fg-primary)]" : "text-[var(--fg-tertiary)]"}`} />
                  <span className={`text-[13px] ${isActive ? "text-[var(--fg-primary)] font-medium" : "text-[var(--fg-secondary)]"}`}>
                      {s.label}
                    </span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--fg-primary)]" />}
                  </button>
                );
              })}
            </div>
        </motion.div>

        {/* Right content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">

            {/* AI Configuration */}
              {activeSection === "ai" && (
                <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <Card>
                  <CardHeader title="AI Configuration" description="Powered by Inceptive's optimized Gemini 2.0 Flash model" />
                  <div className="p-5">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--success-soft)] border border-[var(--border-subtle)]">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-[var(--bg-elevated)] shrink-0">
                        <Cpu className="w-5 h-5 text-[var(--fg-primary)]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-[var(--fg-primary)]">Gemini 2.0 Flash</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[var(--success-soft)] text-[var(--success)]">Active</span>
                        </div>
                        <p className="text-xs text-[var(--fg-tertiary)]">Optimized for speed and intelligence. Uses your Inceptive credits.</p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <p className="text-[10px] text-[var(--fg-muted)] uppercase font-semibold tracking-wider mb-2">Advanced</p>
                      <p className="text-xs text-[var(--fg-tertiary)]">Custom API keys are currently disabled to ensure maximum platform stability. All agents use the high-performance Gemini 2.0 backbone.</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Agent Settings */}
            {activeSection === "agent" && (
              <motion.div key="agent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <Card>
                  <CardHeader title="AI Personality" description="Define how your agent identifies and speaks" />
                  <div className="p-5 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="space-y-1.5 flex flex-col">
                        <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Name</Label>
                        <select value={aiName} onChange={(e) => setAiName(e.target.value)} className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--fg-primary)] outline-none focus:border-[var(--fg-tertiary)] transition-colors h-10">
                          <option value="Inceptive">Inceptive (Default)</option>
                          <option value="Jarvis">Jarvis</option>
                          <option value="Aria">Aria</option>
                          <option value="Nexus">Nexus</option>
                          <option value="Assistant">Assistant</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Personality</Label>
                        <select value={aiPersonality} onChange={(e) => setAiPersonality(e.target.value)} className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--fg-primary)] outline-none focus:border-[var(--fg-tertiary)] transition-colors h-10">
                          <option value="Professional">Professional (Default)</option>
                          <option value="Friendly">Friendly & Approachable</option>
                          <option value="Witty">Witty & Sarcastic</option>
                          <option value="Direct">Direct & Concise</option>
                          <option value="Academic">Academic & Analytical</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Tone</Label>
                        <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--fg-primary)] outline-none focus:border-[var(--fg-tertiary)] transition-colors h-10">
                          <option value="Helpful">Helpful (Default)</option>
                          <option value="Formal">Formal</option>
                          <option value="Casual">Casual</option>
                          <option value="Enthusiastic">Enthusiastic</option>
                          <option value="Dry">Dry</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="24/7 Autonomous Mode" description="Keep your agent working around the clock" />
                  <div className="p-5 space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-[var(--fg-primary)]">Enable 24/7 Mode</p>
                        <p className="text-xs mt-0.5 text-[var(--fg-tertiary)]">Agent stays active and enters sleep mode when idle. Automatically wakes when new tasks arrive.</p>
                      </div>
                      <Toggle on={is24_7Mode} onToggle={toggle24_7Mode} />
                    </div>
                    {is24_7Mode && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[var(--fg-tertiary)]" />
                            <span className="text-xs text-[var(--fg-primary)]">Sleep after</span>
                                  </div>
                          <select value={sleepAfterMinutes} onChange={(e) => setSleepAfterMinutes(Number(e.target.value))} className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--fg-primary)]">
                            <option value={1}>1 minute</option>
                            <option value={5}>5 minutes</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                          </select>
                            </div>
                          </motion.div>
                        )}
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${is24_7Mode ? "bg-[var(--success)]" : "bg-[var(--fg-muted)]"}`} />
                      <p className="text-xs text-[var(--fg-tertiary)]">
                        {is24_7Mode ? "24/7 mode is ON — Agent will work continuously and auto-sleep when idle" : "24/7 mode is OFF — Agent runs only when you're actively using the dashboard"}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Approval Control" description="Control when the agent requires your approval" />
                  <div className="p-5 space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-[var(--fg-primary)]">Require Approval</p>
                        <p className="text-xs mt-0.5 text-[var(--fg-tertiary)]">Agent pauses before executing each task and waits for your approval.</p>
                      </div>
                      <Toggle on={requiresApproval} onToggle={() => setRequiresApproval(!requiresApproval)} />
                            </div>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                      <PauseCircle className={`w-4 h-4 shrink-0 ${requiresApproval ? "text-[var(--warning)]" : "text-[var(--fg-muted)]"}`} />
                      <p className="text-xs text-[var(--fg-tertiary)]">
                        {requiresApproval ? "Agent will pause before each task — you'll need to approve actions" : "Agent runs autonomously without pausing for approval"}
                      </p>
                                  </div>
                            </div>
                </Card>

                <Card>
                  <CardHeader title="Scheduled Tasks" description="Set-and-forget automation (runs via cron). Uses credits smartly." />
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Name</Label>
                        <Input value={scheduledName} onChange={(e) => setScheduledName(e.target.value)} placeholder="e.g. Monday Inbox Summary"
                          className="h-10 rounded-lg text-sm bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Cron (UTC)</Label>
                        <Input value={scheduledCron} onChange={(e) => setScheduledCron(e.target.value)} placeholder="0 9 * * 1"
                          className="h-10 rounded-lg text-sm bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] font-mono" />
                            </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Actions</Label>
                        <div className="flex gap-2">
                          <Button onClick={createScheduledTask} disabled={scheduledSaving}
                            className="h-10 px-4 rounded-lg text-sm border-0 bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90 disabled:opacity-40 flex items-center gap-2">
                            {scheduledSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Create
                          </Button>
                          <Button variant="ghost" onClick={fetchScheduledTasks} className="h-10 px-4 rounded-lg text-sm hover:bg-[var(--bg-elevated)]">
                            Refresh
                          </Button>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Prompt</Label>
                      <textarea value={scheduledPrompt} onChange={(e) => setScheduledPrompt(e.target.value)} rows={4}
                        placeholder={`Example:\nEvery Monday at 9am: pull my Gmail inbox and summarize what needs a reply.\n\n(Use clear instructions. If Gmail isn't connected, the task will fail with a clear error.)`}
                        className="w-full rounded-lg text-sm bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--fg-primary)] px-3 py-2 outline-none focus:border-[var(--border-strong)]" />
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        Cron format: <span className="font-mono">min hour day month dayOfWeek</span> (UTC). Example:{" "}
                        <span className="font-mono">0 9 * * 1</span> = Mondays 09:00 UTC.
                      </p>
                    </div>
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-[var(--fg-muted)] uppercase font-semibold tracking-wider">Your tasks</p>
                        {scheduledLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--fg-muted)]" />}
                      </div>
                      <div className="space-y-2">
                        {(scheduledTasks || []).length === 0 ? (
                          <div className="px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--fg-tertiary)]">
                            No scheduled tasks yet.
                          </div>
                        ) : (
                          (scheduledTasks || []).slice(0, 8).map((t: any) => (
                            <div key={t.id} className="px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm text-[var(--fg-primary)] font-medium truncate">{t.name}</p>
                                <p className="text-xs text-[var(--fg-muted)] font-mono mt-1">{t.schedule_cron} · {t.timezone || "UTC"}</p>
                                <p className="text-[11px] text-[var(--fg-tertiary)] mt-1">
                                  Status: {t.last_status || "—"}
                                  {t.last_error ? ` · Error: ${t.last_error}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Toggle on={!!t.enabled} onToggle={async () => {
                                  if (!session?.access_token) return;
                                  await fetch(`/api/scheduled-tasks/${t.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                                    body: JSON.stringify({ enabled: !t.enabled }),
                                  });
                                  fetchScheduledTasks();
                                }} />
                                <Button variant="ghost" onClick={async () => {
                                  if (!session?.access_token) return;
                                  await fetch(`/api/scheduled-tasks/${t.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
                                  fetchScheduledTasks();
                                }} className="h-9 px-3 rounded-lg text-xs hover:bg-[var(--bg-elevated)]">
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                </motion.div>
              )}

            {/* My Account */}
              {activeSection === "account" && (
                <motion.div key="account" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <Card>
                  <CardHeader title="Profile" description="Your account information" />
                    <div className="p-5 space-y-5">
                      <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold bg-[var(--fg-primary)] text-[var(--bg-base)] shrink-0">
                          {(displayName || user?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                        <div className="font-medium text-[var(--fg-primary)]">{displayName || user?.email?.split("@")[0] || "User"}</div>
                        <div className="text-sm text-[var(--fg-tertiary)]">{user?.email}</div>
                        {memberSince && <div className="text-xs mt-0.5 text-[var(--fg-muted)]">Member since {memberSince}</div>}
                      </div>
                    </div>
                      <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Display Name</Label>
                        <div className="flex gap-2">
                          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Enter your name"
                          className="h-10 rounded-lg text-sm flex-1 bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] focus:border-[var(--border-strong)] focus:ring-0" />
                          <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()}
                          className="h-10 px-4 rounded-lg text-sm border-0 bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90 disabled:opacity-40">
                            {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Email Address</Label>
                      <div className="h-10 flex items-center px-3 rounded-lg text-sm bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--fg-tertiary)]">
                          {user?.email}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Security" />
                  <div className="p-5">
                      <button onClick={handleResetPassword}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border-subtle)] text-left transition-all duration-150 hover:bg-[var(--bg-elevated)]">
                        <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-[var(--fg-tertiary)]" />
                          <div>
                          <div className="text-sm font-medium text-[var(--fg-primary)]">Change Password</div>
                          <div className="text-xs text-[var(--fg-tertiary)]">Send a reset link to your email</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--fg-muted)]" />
                    </button>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Inceptive Credits" description="Your current usage and plan limits" />
                  <div className="p-5">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--fg-tertiary)]">Remaining</span>
                        <span className="text-lg font-semibold text-[var(--fg-primary)]">
                          {creditInfo?.unlimited ? "Unlimited" : `${creditInfo?.remaining ?? 0} / ${creditInfo?.total ?? 0}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-[var(--fg-muted)]">Plan</span>
                        <span className="text-xs uppercase tracking-wide text-[var(--fg-secondary)]">{creditInfo?.plan ?? "free"}</span>
                          </div>
                      {!creditInfo?.unlimited && (
                        <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                          <div className="h-full bg-[var(--fg-primary)]"
                            style={{ width: `${Math.max(0, Math.min(100, ((creditInfo?.remaining ?? 0) / Math.max(1, creditInfo?.total ?? 1)) * 100))}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="border-[var(--destructive-soft)]">
                  <div className="px-5 py-4 border-b border-[var(--destructive-soft)]">
                    <h2 className="text-sm font-semibold text-[var(--destructive)]">Danger Zone</h2>
                    </div>
                    <div className="p-5">
                      <button onClick={() => toast.error("To delete your account, contact support@inceptive.ai")}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--destructive-soft)] bg-[var(--destructive-soft)] text-left transition-all duration-150 hover:opacity-80">
                      <span className="text-sm font-medium text-[var(--destructive)]">Delete Account</span>
                      <span className="text-xs text-[var(--fg-tertiary)]">— permanently removes all data</span>
                      </button>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Email Connectors */}
            {activeSection === "mail" && (
              <motion.div key="mail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <Card>
                  <CardHeader title="Gmail" description="OAuth (same as Email Autopilot). Stores refresh token in Supabase." />
                  <div className="p-5">
                    <Link href="/email">
                      <Button className="rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90 border-0">Connect Gmail</Button>
                    </Link>
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Yahoo Mail" description="Use a Yahoo app password (Account security → generate app password)." />
                  <div className="p-5 space-y-3 max-w-md">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">Yahoo email</Label>
                      <Input value={yahooEmail} onChange={(e) => setYahooEmail(e.target.value)} placeholder="you@yahoo.com"
                        className="rounded-lg bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[var(--fg-tertiary)] uppercase tracking-widest">App password</Label>
                      <Input type="password" value={yahooPassword} onChange={(e) => setYahooPassword(e.target.value)}
                        className="rounded-lg bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)]" />
                    </div>
                    <Button onClick={handleYahooConnect} disabled={yahooSaving}
                      className="rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90 border-0">
                      {yahooSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Yahoo"}
                    </Button>
                  </div>
                </Card>
                </motion.div>
              )}

            {/* Appearance */}
              {activeSection === "appearance" && (
                <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <Card>
                  <CardHeader title="Theme" description="Choose how Inceptive looks" />
                    <div className="p-5">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                        { id: "dark" as const, label: "Dark", icon: Moon, preview: "#0A0A0A", surface: "#1A1A1A", border: "#333", text: "#FFF", sub: "#888" },
                        { id: "light" as const, label: "Light", icon: Sun, preview: "#F5F5F7", surface: "#FFFFFF", border: "#D2D2D7", text: "#0A0A0A", sub: "#6E6E73" },
                        ].map(t => {
                          const Icon = t.icon;
                          const isActive = theme === t.id;
                          return (
                            <motion.button key={t.id} whileTap={{ scale: 0.97 }}
                              onClick={() => setTheme(t.id)}
                            className={`relative flex flex-col overflow-hidden rounded-xl transition-all duration-200 border-2 ${isActive ? "border-[var(--fg-primary)]" : "border-[var(--border-subtle)]"}`}>
                              <div className="w-full aspect-[4/3] p-3 flex flex-col gap-2" style={{ background: t.preview }}>
                                <div className="h-1.5 w-3/4 rounded-full" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                                <div className="flex gap-1.5 flex-1">
                                  <div className="w-7 rounded-md" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                                  <div className="flex-1 flex flex-col gap-1 justify-center">
                                    <div className="h-1.5 w-4/5 rounded-full" style={{ background: t.text, opacity: 0.85 }} />
                                    <div className="h-1.5 w-1/2 rounded-full" style={{ background: t.sub }} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-elevated)]">
                                <div className="flex items-center gap-2">
                                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--fg-primary)]" : "text-[var(--fg-tertiary)]"}`} />
                                <span className="text-sm font-medium text-[var(--fg-primary)]">{t.label}</span>
                              </div>
                              {isActive && <Check className="w-3.5 h-3.5 text-[var(--fg-primary)]" />}
                              </div>
                            </motion.button>
                          );
                        })}
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Notifications" />
                    <div className="p-5 flex items-center gap-3 opacity-50">
                    <Bell className="w-4 h-4 text-[var(--fg-tertiary)]" />
                    <span className="text-sm text-[var(--fg-tertiary)]">Notification preferences coming soon</span>
                  </div>
                </Card>
                </motion.div>
              )}

            {/* Memory */}
              {activeSection === "memory" && (
                <motion.div key="memory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <Card>
                  <CardHeader title="Memory" description="Save chat history so you can pick up where you left off" />
                    <div className="p-5 space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                        <p className="text-sm font-medium text-[var(--fg-primary)]">Enable Memory</p>
                        <p className="text-xs mt-0.5 text-[var(--fg-tertiary)]">Your recent chats will be saved and appear in the Recents section.</p>
                      </div>
                      <Toggle
                        on={memoryEnabled}
                        disabled={savingMemory}
                        onToggle={async () => { setSavingMemory(true); await setMemoryEnabled(!memoryEnabled); setSavingMemory(false); }}
                      />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${memoryEnabled ? "bg-[var(--fg-primary)]" : "bg-[var(--fg-muted)]"}`} />
                      <p className="text-xs text-[var(--fg-tertiary)]">
                        {memoryEnabled ? "Memory is ON — chats are being saved" : "Memory is OFF — chats are only kept for the current session"}
                      </p>
                    </div>
                  </div>
                </Card>
                </motion.div>
              )}

            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
