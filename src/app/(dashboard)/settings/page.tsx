"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, Loader2, Check, ChevronRight,
  Sun, Moon, User, Shield, Bell, Cpu,
} from "lucide-react";
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
type Section = "ai" | "account" | "appearance";

const SECTIONS: { id: Section; label: string; icon: typeof Cpu }[] = [
  { id: "ai", label: "AI Configuration", icon: Cpu },
  { id: "account", label: "My Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Sun },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [savedProvider, setSavedProvider] = useState<string>("");
  const [savedModel, setSavedModel] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [step, setStep] = useState<Step>("provider");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("ai");

  // My Account
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [memberSince, setMemberSince] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setLoading(false); return; }
        setAccessToken(session.access_token);

        if (session.user?.created_at) {
          setMemberSince(new Date(session.user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
        }
        if (session.user?.user_metadata?.display_name) {
          setDisplayName(session.user.user_metadata.display_name);
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
  }, []);

  const providerData = PROVIDERS.find(p => p.id === selectedProvider);

  const handleSave = async () => {
    if (!accessToken || !selectedProvider || !selectedModel || !apiKeyInput.trim()) {
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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

  const handleSaveName = async () => {
    if (!accessToken) return;
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

        {/* Two-column layout: Content (left) + Nav (right) */}
        <div className="flex gap-6 items-start">

          {/* ─── Left: Content Panel ─── */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">

              {/* ── AI Configuration ── */}
              {activeSection === "ai" && (
                <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

                  {hasApiKey && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.25)" }}>
                      <div className="w-2 h-2 rounded-full bg-[#30D158] shrink-0" />
                      <span className="text-sm" style={{ color: "var(--foreground)" }}>
                        Active: <span className="font-semibold">{currentModelMeta?.name || savedModel || savedProvider}</span>
                      </span>
                      <span className="ml-auto text-xs text-[#30D158] font-semibold">Connected</span>
                    </div>
                  )}

                  <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>AI Provider & Model</h2>
                      <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>Your API key is stored securely and only used to run your agents</p>
                    </div>
                    <div className="p-5">
                      {/* Step progress tabs */}
                      <div className="flex gap-2 mb-5">
                        {(["provider", "model", "key"] as Step[]).map((s, i) => {
                          const labels = ["Provider", "Model", "API Key"];
                          const isActive = step === s;
                          const isDone = (s === "provider" && selectedProvider) ||
                                         (s === "model" && selectedModel) ||
                                         (s === "key" && hasApiKey);
                          return (
                            <button
                              key={s}
                              onClick={() => { if (s === "model" && !selectedProvider) return; setStep(s); }}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                              style={{
                                background: isActive ? "var(--foreground)" : "var(--background)",
                                border: isActive ? "1px solid var(--foreground)" : "1px solid var(--border)",
                                color: isActive ? "#FFFFFF" : isDone ? "var(--foreground)" : "var(--foreground-secondary)",
                              }}
                            >
                              {isDone && !isActive
                                ? <Check className="w-3.5 h-3.5 text-[#30D158]" />
                                : <span className="text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold"
                                    style={{
                                      background: isActive ? "rgba(255,255,255,0.25)" : "var(--border)",
                                      color: isActive ? "#fff" : "var(--foreground-secondary)",
                                    }}>
                                    {i + 1}
                                  </span>
                              }
                              {labels[i]}
                            </button>
                          );
                        })}
                      </div>

                      <AnimatePresence mode="wait">
                        {/* Step: Provider */}
                        {step === "provider" && (
                          <motion.div key="provider" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                            <p className="text-sm mb-3" style={{ color: "var(--foreground-secondary)" }}>Choose your AI provider</p>
                            <div className="space-y-2">
                              {PROVIDERS.map(p => (
                                <motion.button key={p.id} whileTap={{ scale: 0.99 }}
                                  onClick={() => { setSelectedProvider(p.id); setSelectedModel(""); setStep("model"); }}
                                  className="w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-150"
                                  style={{
                                    background: selectedProvider === p.id ? "rgba(255,255,255,0.08)" : "var(--background)",
                                    borderColor: selectedProvider === p.id ? "rgba(255,255,255,0.4)" : "var(--border)",
                                  }}>
                                  <img src={p.logo} alt={p.name} width={22} height={22} className="object-contain shrink-0" />
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</div>
                                    <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{p.description}</div>
                                  </div>
                                  {selectedProvider === p.id
                                    ? <Check className="w-4 h-4 text-[var(--foreground)] shrink-0" />
                                    : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--border-strong)" }} />
                                  }
                                </motion.button>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Step: Model */}
                        {step === "model" && providerData && (
                          <motion.div key="model" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                            <div className="flex items-center gap-3 mb-3">
                              <button onClick={() => setStep("provider")} className="text-xs text-[var(--foreground)] hover:opacity-80 font-medium">← Back</button>
                              <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                                Models from <span className="font-semibold" style={{ color: "var(--foreground)" }}>{providerData.name}</span>
                              </span>
                            </div>
                            <div className="space-y-2">
                              {providerData.models.map(m => (
                                <motion.button key={m.id} whileTap={{ scale: 0.99 }}
                                  onClick={() => { setSelectedModel(m.id); setStep("key"); }}
                                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-150"
                                  style={{
                                    background: selectedModel === m.id ? "rgba(255,255,255,0.08)" : "var(--background)",
                                    borderColor: selectedModel === m.id ? "rgba(255,255,255,0.4)" : "var(--border)",
                                  }}>
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{m.name}</div>
                                    <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{m.description}</div>
                                  </div>
                                  {selectedModel === m.id && <Check className="w-4 h-4 text-[var(--foreground)] shrink-0" />}
                                </motion.button>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Step: API Key */}
                        {step === "key" && (
                          <motion.div key="key" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => setStep("model")} className="text-xs text-[var(--foreground)] hover:opacity-80 font-medium">← Back</button>
                              <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                                Enter your <span className="font-semibold" style={{ color: "var(--foreground)" }}>{providerData?.name}</span> API key
                              </span>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                              {providerData && <img src={providerData.logo} alt={providerData.name} width={18} height={18} className="object-contain shrink-0" />}
                              <div>
                                <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{providerData?.name}</div>
                                <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                                  {providerData?.models.find(m => m.id === selectedModel)?.name || selectedModel}
                                </div>
                              </div>
                              <button onClick={() => setStep("provider")} className="ml-auto text-xs font-medium text-[var(--foreground)] hover:opacity-80">Change</button>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>API Key</Label>
                                {providerData?.keyUrl && (
                                  <a href={providerData.keyUrl} target="_blank" rel="noreferrer"
                                    className="text-xs font-medium text-[var(--foreground)] hover:opacity-75">
                                    Get your key →
                                  </a>
                                )}
                              </div>
                              <div className="relative">
                                <Input
                                  type={showApiKey ? "text" : "password"}
                                  value={apiKeyInput}
                                  onChange={e => setApiKeyInput(e.target.value)}
                                  placeholder={providerData?.keyHint ? `${providerData.keyHint}...` : "Paste your API key here"}
                                  className="h-11 rounded-xl text-sm pr-11 focus-visible:ring-[var(--foreground)]"
                                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                                />
                                <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
                                  style={{ color: "var(--foreground-secondary)" }}>
                                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                                {providerData?.keyHint && <span className="font-medium">{providerData.keyHint} — </span>}
                                Stored securely. Never logged or shared.
                              </p>
                            </div>

                            <motion.div whileTap={{ scale: 0.98 }}>
                              <Button onClick={handleSave} disabled={saving || !apiKeyInput.trim()}
                                className="w-full h-11 rounded-xl font-semibold text-sm border-0 hover:opacity-90 disabled:opacity-40"
                                style={{ background: "var(--foreground)", color: "#FFFFFF" }}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Configuration"}
                              </Button>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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
                          { id: "dark" as const, label: "Dark", icon: Moon, preview: "#1C1C1E", surface: "#242426", border: "#38383A", text: "#FFFFFF", sub: "#8E8E93" },
                          { id: "light" as const, label: "Light", icon: Sun, preview: "#F5F5F7", surface: "#FFFFFF", border: "#D2D2D7", text: "#1C1C1E", sub: "#6E6E73" },
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
            </AnimatePresence>
          </div>

          {/* ─── Right: Vertical Nav ─── */}
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
                    <span className="text-sm font-semibold" style={{ color: isActive ? "var(--foreground)" : "var(--foreground)" }}>
                      {s.label}
                    </span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
