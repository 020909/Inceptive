"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
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
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Settings state
  const [apiProvider, setApiProvider] = useState<string>("openai");
  const [apiKey, setApiKey] = useState("");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [timezone, setTimezone] = useState("America/New_York");

  // Connected accounts
  const [connectedAccounts] = useState({
    gmail: false,
    twitter: false,
    linkedin: false,
  });

  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setApiProvider(data.api_provider || "openai");
        setApiKey(data.api_key_encrypted || "");
        setWakeTime(data.wake_time || "07:00");
        setTimezone(data.timezone || "America/New_York");
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user, supabase]);

  const handleSaveProvider = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        api_provider: apiProvider,
        api_key_encrypted: apiKey,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("AI provider settings saved");
    }
    setSaving(false);
  };

  const handleSaveSchedule = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        wake_time: wakeTime,
        timezone: timezone,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Schedule settings saved");
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }
    toast.error("Account deletion requires admin support. Please contact support@inceptive.ai");
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6">
                <div className="h-5 w-40 shimmer rounded mb-4" />
                <div className="h-11 w-full shimmer rounded" />
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

        {/* AI Provider */}
        <section className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">
            AI Provider
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-[#888888]">Provider</Label>
              <Select value={apiProvider} onValueChange={(v) => v && setApiProvider(v)}>
                <SelectTrigger className="h-11 bg-[#111111] border-[#333333] text-white rounded-lg focus:border-white focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F]">
                  <SelectItem value="openai" className="text-white hover:bg-[#111111]">
                    OpenAI
                  </SelectItem>
                  <SelectItem value="claude" className="text-white hover:bg-[#111111]">
                    Claude
                  </SelectItem>
                  <SelectItem value="gemini" className="text-white hover:bg-[#111111]">
                    Gemini
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-[#888888]">API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
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
            </div>

            <Button
              onClick={handleSaveProvider}
              disabled={saving}
              className="bg-white text-black hover:bg-white/90 rounded-lg h-10 px-6 text-sm font-medium transition-all duration-200"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </section>

        {/* Wake Up Time */}
        <section className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">
            Wake Up Time
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-[#888888]">Time</Label>
              <Input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="h-11 bg-[#111111] border-[#333333] text-white rounded-lg focus:border-white focus:ring-0 transition-colors duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-[#888888]">Timezone</Label>
              <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                <SelectTrigger className="h-11 bg-[#111111] border-[#333333] text-white rounded-lg focus:border-white focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D0D] border-[#1F1F1F] max-h-60">
                  {timezones.map((tz) => (
                    <SelectItem
                      key={tz}
                      value={tz}
                      className="text-white hover:bg-[#111111]"
                    >
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleSaveSchedule}
            disabled={saving}
            className="mt-4 bg-white text-black hover:bg-white/90 rounded-lg h-10 px-6 text-sm font-medium transition-all duration-200"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </section>

        {/* Connected Accounts */}
        <section className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">
            Connected Accounts
          </h2>
          <div className="space-y-3">
            {[
              { name: "Gmail", connected: connectedAccounts.gmail },
              { name: "Twitter", connected: connectedAccounts.twitter },
              { name: "LinkedIn", connected: connectedAccounts.linkedin },
            ].map((account) => (
              <div
                key={account.name}
                className="flex items-center justify-between py-3 border-b border-[#1F1F1F] last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white">{account.name}</span>
                  {account.connected && (
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-emerald-500">
                        Connected
                      </span>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="h-9 bg-transparent border-[#333333] text-white hover:bg-[#111111] rounded-lg text-sm transition-all duration-200"
                >
                  {account.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            ))}
          </div>
        </section>

        <Separator className="bg-[#1F1F1F] my-6" />

        {/* Danger Zone */}
        <section className="rounded-xl border border-[#EF4444]/30 bg-[#0D0D0D] p-6">
          <h2 className="text-base font-semibold text-[#EF4444] mb-2">
            Danger Zone
          </h2>
          <p className="text-sm text-[#888888] mb-4">
            Once you delete your account, there is no going back. Please be
            certain.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleDeleteAccount}
              className="bg-[#EF4444] text-white hover:bg-[#DC2626] rounded-lg h-10 px-6 text-sm font-medium transition-all duration-200"
            >
              Delete Account
            </Button>
            <Button
              onClick={signOut}
              variant="outline"
              className="bg-transparent border-[#333333] text-white hover:bg-[#111111] rounded-lg h-10 px-6 text-sm font-medium transition-all duration-200"
            >
              Sign Out
            </Button>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
