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
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Via OpenRouter" },
      { id: "openai/gpt-4o", name: "GPT-4o", description: "Via OpenRouter" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Via OpenRouter" },
      { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B", description: "Open source" },
      { id: "mistralai/mistral-large", name: "Mistral Large", description: "Via OpenRouter" },
    ],
  },
];

type Step = "provider" | "model" | "key";
type Section = "ai" | "account" | "appearance";

const SECTIONS = [
  { id: "ai" as Section, label: "AI Configuration", icon: Cpu },
  { id: "account" as Section, label: "My Account", icon: User },
  { id: "appearance" as Section, label: "Appearance", icon: Sun },
];

function SectionCard({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{title}</h2>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--foreground-secondary)" }}>{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

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

        // Set member since from user metadata
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
    if (!accessToken || !selectedProvider || !selectedModel || !apiKeyInput) {
      toast.error("Please complete all steps before saving");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ api_provider: selectedProvider, api_model: selectedModel, api_key_encrypted: apiKeyInput }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save"); }
      toast.success("Settings saved successfully");
      setSavedProvider(selectedProvider);
      setSavedModel(selectedModel);
      setHasApiKey(true);
      setApiKeyInput("");
      setStep("provider");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!accessToken) return;
    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
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
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    toast.success("Password reset email sent to " + user.email);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-2xl">
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
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>Settings</h1>

        {/* Section tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl" style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}>
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background: isActive ? "var(--accent)" : "transparent",
                  color: isActive ? "#FFFFFF" : "var(--foreground-secondary)",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ─── AI Configuration ─── */}
          {activeSection === "ai" && (
            <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

              {hasApiKey && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: "var(--accent-subtle)", borderColor: "rgba(0,122,255,0.3)" }}>
                  <div className="w-2 h-2 rounded-full bg-[#30D158]" />
                  <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                    Active: <span className="font-medium" style={{ color: "var(--foreground)" }}>
                      {currentModelMeta?.name || savedModel || savedProvider}
                    </span>
                  </span>
                  <span className="ml-auto text-xs text-[#30D158] font-medium">Connected</span>
                </div>
              )}

              <SectionCard title="AI Provider" description="Choose your AI provider and model">
                {/* Step tabs */}
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
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150"
                        style={{
                          background: isActive ? "var(--accent-subtle)" : "var(--background)",
                          borderColor: isActive ? "rgba(0,122,255,0.4)" : "var(--border)",
                          color: isActive ? "var(--foreground)" : "var(--foreground-secondary)",
                        }}
                      >
                        {isDone && !isActive
                          ? <Check className="w-3.5 h-3.5 text-[#30D158]" />
                          : <span className="text-xs w-4 h-4 rounded-full flex items-center justify-center font-semibold"
                              style={{ background: isActive ? "#007AFF" : "var(--border)", color: "#fff" }}>
                              {i + 1}
                            </span>
                        }
                        {labels[i]}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {step === "provider" && (
                    <motion.div key="provider"
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}>
                      <p className="text-sm mb-4" style={{ color: "var(--foreground-secondary)" }}>Choose your AI provider</p>
                      <div className="space-y-2.5">
                        {PROVIDERS.map(p => (
                          <motion.button key={p.id} whileTap={{ scale: 0.99 }}
                            onClick={() => { setSelectedProvider(p.id); setSelectedModel(""); setStep("model"); }}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-150"
                            style={{
                              background: selectedProvider === p.id ? "var(--accent-subtle)" : "var(--background)",
                              borderColor: selectedProvider === p.id ? "rgba(0,122,255,0.4)" : "var(--border)",
                            }}>
                            <img src={p.logo} alt={p.name} width={20} height={20} className="object-contain shrink-0" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</div>
                              <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{p.description}</div>
                            </div>
                            <ChevronRight className="w-4 h-4" style={{ color: "var(--border-strong)" }} />
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === "model" && providerData && (
                    <motion.div key="model"
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}>
                      <div className="flex items-center gap-3 mb-4">
                        <button onClick={() => setStep("provider")} className="text-xs text-[#007AFF] hover:opacity-80 transition-opacity">← Back</button>
                        <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                          Choose a model from <span className="font-medium" style={{ color: "var(--foreground)" }}>{providerData.name}</span>
                        </span>
                      </div>
                      <div className="space-y-2">
                        {providerData.models.map(m => (
                          <motion.button key={m.id} whileTap={{ scale: 0.99 }}
                            onClick={() => { setSelectedModel(m.id); setStep("key"); }}
                            className="w-full flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all duration-150"
                            style={{
                              background: selectedModel === m.id ? "var(--accent-subtle)" : "var(--background)",
                              borderColor: selectedModel === m.id ? "rgba(0,122,255,0.4)" : "var(--border)",
                            }}>
                            <div className="flex-1">
                              <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{m.name}</div>
                              <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{m.description}</div>
                            </div>
                            {selectedModel === m.id && <Check className="w-4 h-4 text-[#007AFF] shrink-0" />}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === "key" && (
                    <motion.div key="key"
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5">
                      <div className="flex items-center gap-3 mb-1">
                        <button onClick={() => setStep("model")} className="text-xs text-[#007AFF] hover:opacity-80 transition-opacity">← Back</button>
                        <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                          Enter your <span className="font-medium" style={{ color: "var(--foreground)" }}>{providerData?.name}</span> API key
                        </span>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
                        {providerData && <img src={providerData.logo} alt={providerData.name} width={18} height={18} className="object-contain shrink-0" />}
                        <div>
                          <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{providerData?.name}</div>
                          <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                            {providerData?.models.find(m => m.id === selectedModel)?.name || selectedModel}
                          </div>
                        </div>
                        <button onClick={() => setStep("provider")} className="ml-auto text-xs text-[#007AFF] hover:opacity-80">Change</button>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--foreground-secondary)" }}>API Key</Label>
                        <div className="relative">
                          <Input
                            type={showApiKey ? "text" : "password"}
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder={hasApiKey ? "Enter new key to replace existing" : "Paste your API key here"}
                            className="h-11 rounded-xl text-sm pr-11 focus-visible:ring-[#007AFF]"
                            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                          />
                          <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
                            style={{ color: "var(--border-strong)" }}>
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs" style={{ color: "var(--foreground-tertiary)" }}>Stored securely. Only used to run your agents. Never logged.</p>
                      </div>

                      <motion.div whileTap={{ scale: 0.98 }}>
                        <Button onClick={handleSave} disabled={saving || !apiKeyInput.trim()}
                          className="w-full h-11 rounded-xl font-semibold text-sm border-0 transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
                          style={{ background: "#007AFF", color: "#FFFFFF" }}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Configuration"}
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SectionCard>
            </motion.div>
          )}

          {/* ─── My Account ─── */}
          {activeSection === "account" && (
            <motion.div key="account" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
              <SectionCard title="Profile" description="Your account information">
                <div className="space-y-5">
                  {/* Avatar + email */}
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                      style={{ background: "linear-gradient(135deg, #007AFF, #5856D6)" }}>
                      {(displayName || user?.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                        {displayName || user?.email?.split("@")[0] || "User"}
                      </div>
                      <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{user?.email}</div>
                      {memberSince && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--foreground-tertiary)" }}>
                          Member since {memberSince}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Display name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--foreground-secondary)" }}>Display Name</Label>
                    <div className="flex gap-2">
                      <Input
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="Enter your name"
                        className="h-10 rounded-xl text-sm flex-1 focus-visible:ring-[#007AFF]"
                        style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                      />
                      <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()}
                        className="h-10 px-4 rounded-xl text-sm border-0 disabled:opacity-40"
                        style={{ background: "#007AFF", color: "#FFFFFF" }}>
                        {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--foreground-secondary)" }}>Email Address</Label>
                    <div className="h-10 flex items-center px-3 rounded-xl text-sm" style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground-secondary)" }}>
                      {user?.email}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Security" description="Manage your password and account access">
                <div className="space-y-3">
                  <button
                    onClick={handleResetPassword}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-150 hover:opacity-80"
                    style={{ background: "var(--background)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-[#007AFF]" />
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Change Password</div>
                        <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>Send a reset link to your email</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: "var(--border-strong)" }} />
                  </button>
                </div>
              </SectionCard>

              <SectionCard title="Danger Zone" description="Irreversible actions">
                <button
                  onClick={() => toast.error("To delete your account, please contact support@inceptive.ai")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 hover:opacity-80"
                  style={{ background: "rgba(255,59,48,0.06)", borderColor: "rgba(255,59,48,0.2)" }}
                >
                  <div className="text-sm font-medium text-[#FF453A]">Delete Account</div>
                  <div className="text-xs ml-1" style={{ color: "var(--foreground-secondary)" }}>— permanently removes all data</div>
                </button>
              </SectionCard>
            </motion.div>
          )}

          {/* ─── Appearance ─── */}
          {activeSection === "appearance" && (
            <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
              <SectionCard title="Theme" description="Choose how Inceptive looks">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "dark" as const, label: "Dark", icon: Moon, preview: "#1C1C1E", surface: "#242426", text: "#FFFFFF", subtext: "#8E8E93", border: "#38383A" },
                    { id: "light" as const, label: "Light", icon: Sun, preview: "#F5F5F7", surface: "#FFFFFF", text: "#1C1C1E", subtext: "#6E6E73", border: "#D2D2D7" },
                  ].map(t => {
                    const Icon = t.icon;
                    const isActive = theme === t.id;
                    return (
                      <motion.button key={t.id} whileTap={{ scale: 0.98 }}
                        onClick={() => setTheme(t.id)}
                        className="relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-200"
                        style={{ borderColor: isActive ? "#007AFF" : "var(--border)" }}>
                        {/* Theme preview */}
                        <div className="w-full aspect-[4/3] p-3 flex flex-col gap-2" style={{ background: t.preview }}>
                          <div className="flex gap-1.5">
                            <div className="h-1.5 rounded-full flex-1" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                          </div>
                          <div className="flex gap-2 flex-1">
                            <div className="w-6 rounded-md" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                            <div className="flex-1 flex flex-col gap-1.5 justify-center">
                              <div className="h-1.5 w-3/4 rounded-full" style={{ background: t.text, opacity: 0.8 }} />
                              <div className="h-1.5 w-1/2 rounded-full" style={{ background: t.subtext }} />
                              <div className="h-5 w-full rounded-lg mt-1" style={{ background: "#007AFF", opacity: 0.9 }} />
                            </div>
                          </div>
                        </div>
                        {/* Label */}
                        <div className="flex items-center justify-between px-3 py-2.5" style={{ background: "var(--background-elevated)" }}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" style={{ color: isActive ? "#007AFF" : "var(--foreground-secondary)" }} />
                            <span className="text-sm font-medium" style={{ color: isActive ? "#007AFF" : "var(--foreground)" }}>{t.label}</span>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-[#007AFF]" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Notifications" description="Coming soon">
                <div className="flex items-center gap-3 py-2 opacity-50">
                  <Bell className="w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
                  <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Notification preferences will be available soon</span>
                </div>
              </SectionCard>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
