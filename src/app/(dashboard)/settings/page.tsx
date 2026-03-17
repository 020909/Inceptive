"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models — best for reasoning & writing",
    logoDomain: "anthropic.com",
    models: [
      { id: "claude-opus-4-5", name: "Claude Opus 4.5", description: "Most powerful · Best quality" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Balanced · Recommended" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", description: "Fastest · Lowest cost" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models — versatile and widely used",
    logoDomain: "openai.com",
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
    logoDomain: "google.com",
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
    logoDomain: "openrouter.ai",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", description: "Via OpenRouter" },
      { id: "openai/gpt-4o", name: "GPT-4o", description: "Via OpenRouter" },
      { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Via OpenRouter" },
      { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B", description: "Open source" },
      { id: "mistralai/mistral-large", name: "Mistral Large", description: "Via OpenRouter" },
    ],
  },
];

function ProviderLogo({ domain, name, size = 28 }: { domain: string; name: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div
        className="rounded-lg flex items-center justify-center text-xs font-bold text-[#8E8E93] shrink-0"
        style={{ width: size, height: size, background: "#2C2C2E" }}
      >
        {name[0]}
      </div>
    );
  }
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      width={size}
      height={size}
      className="rounded-lg object-contain shrink-0"
      onError={() => setErrored(true)}
    />
  );
}

type Step = "provider" | "model" | "key";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [savedProvider, setSavedProvider] = useState<string>("google");
  const [savedModel, setSavedModel] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [step, setStep] = useState<Step>("provider");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setLoading(false); return; }
        setAccessToken(session.access_token);
        const res = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSavedProvider(data.api_provider || "google");
          setSavedModel(data.api_model || "");
          setHasApiKey(data.has_api_key);
          setSelectedProvider(data.api_provider || "google");
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
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

        {hasApiKey && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border mb-6"
            style={{ background: "#007AFF12", borderColor: "#007AFF30" }}
          >
            <div className="w-2 h-2 rounded-full bg-[#30D158]" />
            <span className="text-sm text-[#8E8E93]">
              Active:{" "}
              <span className="text-white font-medium">
                {currentModelMeta?.name || savedModel || savedProvider}
              </span>
            </span>
            <span className="ml-auto text-xs text-[#30D158] font-medium">Connected</span>
          </motion.div>
        )}

        <div className="rounded-2xl border overflow-hidden" style={{ background: "#242426", borderColor: "#38383A" }}>
          {/* Step tabs */}
          <div className="flex border-b" style={{ borderColor: "#38383A" }}>
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
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all duration-150"
                  style={{
                    background: isActive ? "#2A2A2C" : "transparent",
                    color: isActive ? "#FFFFFF" : "#8E8E93",
                    borderBottom: isActive ? "2px solid #007AFF" : "2px solid transparent",
                  }}
                >
                  {isDone && !isActive
                    ? <Check className="w-3.5 h-3.5 text-[#30D158]" />
                    : <span className="text-xs w-4 h-4 rounded-full flex items-center justify-center font-semibold"
                        style={{ background: isActive ? "#007AFF" : "#38383A", color: "#fff" }}>
                        {i + 1}
                      </span>
                  }
                  {labels[i]}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === "provider" && (
                <motion.div key="provider"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}>
                  <p className="text-sm text-[#8E8E93] mb-4">Choose your AI provider</p>
                  <div className="space-y-2.5">
                    {PROVIDERS.map(p => (
                      <motion.button key={p.id} whileTap={{ scale: 0.99 }}
                        onClick={() => { setSelectedProvider(p.id); setSelectedModel(""); setStep("model"); }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-150"
                        style={{
                          background: selectedProvider === p.id ? "#007AFF12" : "#1C1C1E",
                          borderColor: selectedProvider === p.id ? "#007AFF50" : "#38383A",
                        }}>
                        <ProviderLogo domain={p.logoDomain} name={p.name} size={28} />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-white">{p.name}</div>
                          <div className="text-xs text-[#8E8E93]">{p.description}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#48484A]" />
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
                    <button onClick={() => setStep("provider")} className="text-xs text-[#007AFF] hover:opacity-80 transition-opacity">Back</button>
                    <span className="text-sm text-[#8E8E93]">
                      Choose a model from{" "}
                      <span className="inline-flex items-center gap-1.5 text-white">
                        <ProviderLogo domain={providerData.logoDomain} name={providerData.name} size={14} />
                        {providerData.name}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {providerData.models.map(m => (
                      <motion.button key={m.id} whileTap={{ scale: 0.99 }}
                        onClick={() => { setSelectedModel(m.id); setStep("key"); }}
                        className="w-full flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all duration-150"
                        style={{
                          background: selectedModel === m.id ? "#007AFF12" : "#1C1C1E",
                          borderColor: selectedModel === m.id ? "#007AFF50" : "#38383A",
                        }}>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-white">{m.name}</div>
                          <div className="text-xs text-[#8E8E93]">{m.description}</div>
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
                    <button onClick={() => setStep("model")} className="text-xs text-[#007AFF] hover:opacity-80 transition-opacity">Back</button>
                    <span className="text-sm text-[#8E8E93]">
                      Enter your <span className="text-white">{providerData?.name}</span> API key
                    </span>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#1C1C1E", border: "1px solid #2C2C2E" }}>
                    {providerData && <ProviderLogo domain={providerData.logoDomain} name={providerData.name} size={24} />}
                    <div>
                      <div className="text-xs text-[#8E8E93]">{providerData?.name}</div>
                      <div className="text-sm font-medium text-white">
                        {providerData?.models.find(m => m.id === selectedModel)?.name || selectedModel}
                      </div>
                    </div>
                    <button onClick={() => setStep("provider")} className="ml-auto text-xs text-[#007AFF] hover:opacity-80">Change</button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#8E8E93] uppercase tracking-wide">API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={hasApiKey ? "Enter new key to replace existing" : "Paste your API key here"}
                        className="h-11 rounded-xl text-sm text-white placeholder:text-[#48484A] pr-11 focus-visible:ring-[#007AFF]"
                        style={{ background: "#1C1C1E", border: "1px solid #38383A" }}
                      />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#48484A] hover:text-white transition-colors duration-150">
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-[#636366]">Stored securely. Only used to run your agents. Never logged.</p>
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
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
