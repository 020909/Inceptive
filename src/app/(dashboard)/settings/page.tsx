"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

const providers = [
  { id: "gemini", name: "Google Gemini" },
  { id: "openai", name: "OpenAI" },
  { id: "claude", name: "Anthropic Claude" },
  { id: "openrouter", name: "OpenRouter" },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apiProvider, setApiProvider] = useState<string | null>("gemini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const fetchSessionAndSettings = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        const token = session.access_token;
        setAccessToken(token);

        const res = await fetch("/api/settings", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.api_provider) setApiProvider(data.api_provider);
          setHasApiKey(data.has_api_key);
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndSettings();
  }, []);

  const handleSave = async () => {
    if (!accessToken) return;
    if (!apiProvider || !apiKeyInput) {
      toast.error("Please select a provider and enter an API key");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          api_provider: apiProvider, 
          api_key_encrypted: apiKeyInput 
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Settings saved");
      setHasApiKey(true);
      setApiKeyInput(""); // Clear input after successful save
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
          <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
            <div className="h-6 w-32 shimmer rounded mb-6" />
            <div className="h-11 w-full shimmer rounded mb-4" />
            <div className="h-11 w-full shimmer rounded" />
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

        <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
          <h2 className="text-lg font-semibold text-white mb-6">AI Provider Configuration</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#888888]">
                Select AI Provider
              </Label>
              <Select value={apiProvider || "gemini"} onValueChange={(value) => setApiProvider(value || 'gemini')}>
                <SelectTrigger className="h-11 bg-[#111111] border-[#333333] text-white rounded-lg focus:border-white focus:ring-0">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-white hover:bg-[#111111] focus:bg-[#111111] focus:text-white cursor-pointer">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[#888888]">
                API Key
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={hasApiKey ? "••••••••••••" : "Paste your API key here"}
                  className="h-11 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white transition-colors duration-200"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-[#555555] mt-2">
                Your API key is stored securely and is only used to run your connected agents.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-white text-black hover:bg-white/90 rounded-lg h-11 text-sm font-medium transition-all duration-200 mt-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
