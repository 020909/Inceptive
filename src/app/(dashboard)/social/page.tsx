"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Session } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Share2, Plus, Loader2, Calendar, Check, Unlink, ExternalLink, Send, Bot, Plug, RefreshCw, Settings, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SocialPost {
  id: string; platform: string; content: string;
  status: "scheduled" | "published" | "draft";
  scheduled_for?: string; scheduled_at?: string; created_at?: string;
}
interface ConnectedAccount {
  provider: string; account_email?: string; account_name?: string; account_id?: string;
  metadata?: Record<string, string>; created_at: string;
  decrypted?: boolean;
}

const SOCIAL_CONNECTORS = [
  { id: "gmail",     provider: "gmail",     name: "Gmail",       logo: "/logos/email/gmail.png",   users: "1.8B+",  telegramInput: false, type: "email", description: "Send and receive emails" },
  { id: "outlook",   provider: "outlook",   name: "Outlook",     logo: "/logos/email/outlook.png", users: "400M+",  telegramInput: false, type: "email", description: "Microsoft 365 email" },
  { id: "x",         provider: "twitter",    name: "X (Twitter)", logo: "/logos/social/x.png",         users: "600M+",  telegramInput: false, type: "social", description: "Post tweets and read basic profile" },
  { id: "linkedin",  provider: "linkedin",  name: "LinkedIn",    logo: "/logos/social/linkedin.png",  users: "950M+",  telegramInput: false, type: "social", description: "Professional networking" },
  { id: "facebook", provider: "facebook",  name: "Facebook",    logo: "/logos/social/facebook.png",  users: "3B+",    telegramInput: false, type: "social", description: "Meta Graph API (limited without app review)" },
  { id: "instagram", provider: "instagram", name: "Instagram",   logo: "/logos/social/instagram.png", users: "2B+",    telegramInput: false, type: "social", description: "Meta Graph API (publishing requires Business + permissions)" },
  { id: "whatsapp",  provider: "whatsapp",  name: "WhatsApp",    logo: "/logos/social/whatsapp.png",  users: "2B+",    telegramInput: false, type: "social", description: "WhatsApp Cloud API (requires Business setup)" },
  { id: "telegram",  provider: "telegram",  name: "Telegram",    logo: "/logos/social/telegram.png",  users: "900M+",  telegramInput: true,  type: "social", description: "Messaging and channels" },
  { id: "tiktok",    provider: "tiktok",    name: "TikTok",      logo: "/logos/social/tiktok.png",    users: "1.5B+",  telegramInput: false, type: "social", description: "Short-form video" },
  { id: "youtube",   provider: "youtube",   name: "YouTube",     logo: "/logos/social/youtube.png",   users: "2.5B+",  telegramInput: false, type: "social", description: "Video hosting and streaming" },
];

function StatusBadge({ status }: { status: 'connected' | 'disconnected' | 'error' }) {
  const configs = {
    connected: { icon: Check, color: 'text-[var(--fg-primary)]', bg: 'bg-[var(--bg-elevated)]', label: 'Connected' },
    disconnected: { icon: Plug, color: 'text-[var(--fg-muted)]', bg: 'bg-[var(--bg-surface)]', label: 'Disconnected' },
    error: { icon: AlertCircle, color: 'text-[var(--fg-secondary)]', bg: 'bg-[var(--bg-elevated)]', label: 'Error' },
  };
  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
      <Icon size={12} className={config.color} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

function ConnectorCard({ connector, index, connected, connectedAccount, onConnect, onDisconnect }: {
  connector: typeof SOCIAL_CONNECTORS[0];
  index: number;
  connected: boolean;
  connectedAccount?: ConnectedAccount;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="group p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 100, damping: 20 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-2xl">
          <img src={connector.logo} alt={connector.name} width={28} height={28} className="object-contain" />
        </div>
        <StatusBadge status={connected ? 'connected' : 'disconnected'} />
      </div>

      <h3 className="text-[var(--fg-primary)] font-medium tracking-[-0.02em] mb-1">{connector.name}</h3>
      <p className="text-[var(--fg-muted)] text-sm mb-4">{connector.description}</p>
      {connected && connectedAccount?.account_name && (
        <p className="text-[var(--fg-tertiary)] text-xs mb-3">
          ✅ Connected as {connectedAccount.account_name}
          {connectedAccount.account_email ? ` · ${connectedAccount.account_email}` : ""}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
          <RefreshCw size={12} />
          <span>{connected ? 'Synced recently' : 'Not connected'}</span>
        </div>

        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {connected ? (
            <>
              <button className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors">
                <RefreshCw size={14} className="text-[var(--fg-tertiary)]" />
              </button>
              <button className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors">
                <Settings size={14} className="text-[var(--fg-tertiary)]" />
              </button>
              <button onClick={onDisconnect} className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors text-[var(--fg-tertiary)] hover:text-red-400">
                <Unlink size={14} />
              </button>
            </>
          ) : (
            <button onClick={onConnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-primary)] text-xs font-medium hover:bg-[var(--bg-overlay)] transition-colors">
              <Plug size={12} />
              Connect
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function SocialPage() {
  const { user, session, refresh: refreshAuth } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [platform, setPlatform] = useState("X");
  const [content, setContent] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [generateWithAi, setGenerateWithAi] = useState(false);
  const [topic, setTopic] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [connectingTelegram, setConnectingTelegram] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'email' | 'social'>('all');

  const fetchPosts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("social_posts").select("*")
        .eq("user_id", user?.id).order("id", { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (err: any) { toast.error("Posts Error: " + err.message); }
    finally { setLoading(false); }
  }, [user]);

  const fetchConnected = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/connectors", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load connectors");
      setConnectedAccounts(data.accounts || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not load connected accounts");
    }
  }, []);

  const init = useCallback(async () => {
    if (!session?.access_token) {
      if (loading) setLoading(false);
      return;
    }
    const token = session.access_token;
    if (user) {
      fetchPosts();
      fetchConnected(token);
    }
  }, [session, user, fetchPosts, fetchConnected, loading]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      toast.success(`${connected} connected!`);
      refreshAuth().then(() => init());
    }
    if (error) {
      if (error === "config_missing") {
        const provider = params.get("provider") || "this provider";
        toast.error(`Configuration missing: Please set ${provider.toUpperCase()}_CLIENT_ID & SECRET in your Vercel env.`, { duration: 6000 });
      } else {
        toast.error(`Connection failed: ${decodeURIComponent(error)}`);
      }
    }
    if (connected || error) window.history.replaceState({}, "", "/social");
  }, [init, refreshAuth]);

  const PROVIDER_AUTH_PATH: Record<string, string> = { gmail: "google", outlook: "microsoft" };

  const handleConnect = (connector: typeof SOCIAL_CONNECTORS[0]) => {
    if (!session?.access_token) { toast.error("Please sign in first"); return; }
    if (connector.telegramInput) { setIsTelegramModalOpen(true); return; }

    const authSlug = PROVIDER_AUTH_PATH[connector.provider] || connector.provider;
    const base =
      connector.type === "email"
        ? `/api/auth/${authSlug}/connect`
        : `/api/connectors/${connector.provider}?mode=connect`;
    const url = `${base}?token=${encodeURIComponent(session.access_token)}&redirect_to=/social`;
    window.location.href = url;
  };

  const handleDisconnect = async (provider: string) => {
    if (!session?.access_token) return;
    try {
      await fetch(`/api/connectors?provider=${provider}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      setConnectedAccounts(prev => prev.filter(a => a.provider !== provider));
      toast.success(`${provider} disconnected`);
    } catch { toast.error("Failed to disconnect"); }
  };

  const handleTelegramConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken?.trim() || !session?.access_token) return;
    if (!chatId.trim()) {
      toast.error("Chat ID is required so we know where to send posts.");
      return;
    }
    setConnectingTelegram(true);
    try {
      const res = await fetch("/api/connectors/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bot_token: botToken.trim(), chat_id: chatId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");
      toast.success(`Telegram bot @${data.bot.username} connected!`);
      setIsTelegramModalOpen(false);
      setBotToken(""); setChatId("");
      fetchConnected(session?.access_token || "");
    } catch (err: any) { toast.error(err.message); }
    finally { setConnectingTelegram(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !user) return;
    const pk = platform.toLowerCase();
    if (!isPlatformConnected(pk)) {
      toast.error(`Connect ${platform} in Connectors before scheduling a post.`);
      return;
    }
    setSaving(true);
    try {
      if (generateWithAi) {
        if (!topic) { toast.error("Please provide a topic for AI"); setSaving(false); return; }
        const res = await fetch("/api/agent/social", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ platform, topic }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate");
        if (scheduleTime) {
          const supabase = createClient();
          await supabase.from("social_posts").update({ scheduled_for: scheduleTime, status: "scheduled" }).eq("id", data.post.id);
        }
        toast.success("Post generated!");
      } else {
        const supabase = createClient();
        const { error } = await supabase.from("social_posts").insert({
          user_id: user.id, platform, content,
          scheduled_for: scheduleTime || new Date().toISOString(),
          status: "scheduled",
        });
        if (error) throw error;
        toast.success("Post saved!");
      }
      setIsModalOpen(false);
      setContent(""); setTopic(""); setGenerateWithAi(false);
      fetchPosts();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePublish = async (postId: string) => {
    if (!session?.access_token) return;
    const post = posts.find((p) => p.id === postId);
    if (post && !isPlatformConnected(post.platform)) {
      toast.error(`Connect ${post.platform} in Connectors before publishing.`);
      return;
    }
    setPublishing(postId);
    try {
      const res = await fetch("/api/actions/publish-post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ post_id: postId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      toast.success(data.message || "Published!");
      fetchPosts();
    } catch (err: any) { toast.error(err.message); }
    finally { setPublishing(null); }
  };

  const getStatusColor = (status: string) => {
    if (status === "published") return "bg-white/80";
    if (status === "draft") return "bg-white/60";
    return "bg-white/50";
  };

  const platformProvider: Record<string, string> = {
    x: "twitter", twitter: "twitter", linkedin: "linkedin", facebook: "facebook",
    instagram: "instagram", telegram: "telegram", tiktok: "tiktok", youtube: "youtube",
  };

  const isPlatformConnected = (p: string) => {
    const prov = platformProvider[p.toLowerCase()];
    return prov ? connectedAccounts.some(a => a.provider === prov) : false;
  };

  const filteredConnectors = selectedCategory === 'all' 
    ? SOCIAL_CONNECTORS 
    : SOCIAL_CONNECTORS.filter(c => c.type === selectedCategory);

  const connectedCount = connectedAccounts.length;

  if (loading) return (
    <>
      <div className="min-h-screen flex flex-col">
        <div className="h-20 shimmer rounded-xl mx-8 mt-8" />
        <div className="flex-1 p-8">
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-48 shimmer rounded-xl" />)}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-[var(--border-subtle)]">
          <div>
            <h1 className="text-xl font-semibold text-[var(--fg-primary)] tracking-[-0.02em]">Connectors</h1>
            <p className="text-[var(--fg-muted)] text-sm">Manage integrations and data sources</p>
          </div>
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] font-medium text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setPlatform("X"); setContent(""); setTopic(""); setScheduleTime(""); setGenerateWithAi(false); setIsModalOpen(true); }}
          >
            <Plus size={16} />
            Create Post
          </motion.button>
        </header>

        {/* Content */}
        <div className="flex-1 p-8">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <motion.div
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <p className="text-[var(--fg-muted)] text-sm mb-1">Connected</p>
              <p className="text-3xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{connectedCount}</p>
            </motion.div>
            <motion.div
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <p className="text-[var(--fg-muted)] text-sm mb-1">Available</p>
              <p className="text-3xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{SOCIAL_CONNECTORS.length}</p>
            </motion.div>
            <motion.div
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <p className="text-[var(--fg-muted)] text-sm mb-1">Sync Errors</p>
              <p className="text-3xl font-semibold text-[var(--fg-secondary)] tracking-[-0.03em]">0</p>
            </motion.div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 mb-6">
            {(['all', 'email', 'social'] as const).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`
                  px-4 py-2 rounded-lg text-sm capitalize transition-all duration-200
                  ${selectedCategory === category
                    ? 'bg-[var(--bg-elevated)] text-[var(--fg-primary)]'
                    : 'text-[var(--fg-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]'
                  }
                `}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Connectors Grid */}
          <div className="grid grid-cols-4 gap-4">
            {filteredConnectors.map((connector, index) => (
              <ConnectorCard 
                key={connector.id} 
                connector={connector} 
                index={index}
                connected={connectedAccounts.some(a => a.provider === connector.provider)}
                connectedAccount={connectedAccounts.find(a => a.provider === connector.provider)}
                onConnect={() => handleConnect(connector)}
                onDisconnect={() => handleDisconnect(connector.provider)}
              />
            ))}
          </div>

          {/* Posts Section */}
          <div className="mt-8">
            <h2 className="text-[var(--fg-primary)] font-medium tracking-[-0.02em] mb-4">Recent Posts</h2>
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <Share2 size={32} className="text-[var(--fg-muted)] mb-4" />
                <p className="text-[var(--fg-secondary)] mb-2">No posts yet</p>
                <p className="text-[var(--fg-muted)] text-sm">Connect your accounts and create a post to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {posts.slice(0, 4).map((post, idx) => (
                  <motion.div
                    key={post.id}
                    className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-all"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-elevated)] text-[var(--fg-primary)]">
                        {post.platform}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(post.status)}`} />
                        <span className="text-xs text-[var(--fg-muted)] capitalize">{post.status}</span>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--fg-secondary)] line-clamp-2 mb-3">{post.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--fg-muted)]">
                        {post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString() : 'Not scheduled'}
                      </span>
                      {post.status !== "published" && (
                        <button
                          onClick={() => handlePublish(post.id)}
                          disabled={publishing === post.id || !isPlatformConnected(post.platform)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:bg-[var(--bg-overlay)] disabled:opacity-50"
                        >
                          {publishing === post.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Publish'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* API Access */}
          <motion.div
            className="mt-8 p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 100, damping: 20 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[var(--fg-primary)] font-medium tracking-[-0.02em] mb-1">Developer API</h3>
                <p className="text-[var(--fg-muted)] text-sm">Build custom integrations with our API</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-elevated)] text-[var(--fg-primary)] text-sm hover:bg-[var(--bg-elevated)] transition-colors">
                <ExternalLink size={14} />
                View Documentation
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Create Post Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border text-[var(--fg-primary)] sm:max-w-xl bg-[var(--bg-surface)] border-[var(--border-subtle)]">
          <DialogHeader><DialogTitle className="text-[var(--fg-primary)]">Create Social Post</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--fg-secondary)] text-xs uppercase tracking-wide">Platform</Label>
                <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                  <SelectTrigger className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--fg-primary)]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-primary)]">
                    {["X", "LinkedIn", "Instagram", "Facebook", "Telegram", "TikTok", "YouTube"].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--fg-secondary)] text-xs uppercase tracking-wide">Schedule Time</Label>
                <Input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="text-[var(--fg-primary)] focus-visible:ring-white/20 [color-scheme:dark] bg-[var(--bg-app)] border border-[var(--border-subtle)]" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="use-ai" checked={generateWithAi} onChange={e => setGenerateWithAi(e.target.checked)}
                className="rounded w-4 h-4 cursor-pointer accent-white" />
              <Label htmlFor="use-ai" className="cursor-pointer select-none text-[var(--fg-secondary)]">Generate with AI</Label>
            </div>
            {generateWithAi ? (
              <div className="space-y-2">
                <Label className="text-[var(--fg-secondary)] text-xs uppercase tracking-wide">Topic</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="What should the post be about?"
                  className="text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus-visible:ring-white/20 bg-[var(--bg-app)] border border-[var(--border-subtle)]" required />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[var(--fg-secondary)] text-xs uppercase tracking-wide">Content</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Write your post here..."
                  className="text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus-visible:ring-white/20 min-h-[120px] bg-[var(--bg-app)] border border-[var(--border-subtle)]" required />
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}
                className="hover:bg-white/10 text-[var(--fg-primary)] hover:text-[var(--fg-primary)]">Cancel</Button>
              <Button type="submit" disabled={saving} className="border-0 bg-[var(--fg-primary)] text-[var(--bg-base)]">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{generateWithAi ? "Generating…" : "Saving…"}</> : generateWithAi ? "Generate & Save" : "Schedule Post"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Telegram Bot Token Modal */}
      <Dialog open={isTelegramModalOpen} onOpenChange={setIsTelegramModalOpen}>
        <DialogContent className="border text-[var(--fg-primary)] sm:max-w-md bg-[var(--bg-surface)] border-[var(--border-subtle)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--fg-primary)] flex items-center gap-2">
              <img src="/logos/social/telegram.png" width={22} height={22} className="object-contain" alt="Telegram" />
              Connect Telegram Bot
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTelegramConnect} className="space-y-4 pt-4">
            <div className="px-3 py-3 rounded-xl text-xs text-[var(--fg-secondary)] leading-relaxed bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              1. Create a bot via <span className="text-[var(--fg-primary)]">@BotFather</span> on Telegram<br/>
              2. Copy the bot token and paste below<br/>
              3. Add your bot to a channel/group and paste the Chat ID
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--fg-secondary)] text-xs uppercase tracking-wide">Bot Token</Label>
              <Input value={botToken} onChange={e => setBotToken(e.target.value)}
                placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className="text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] font-mono text-xs focus-visible:ring-white/20 bg-[var(--bg-app)] border border-[var(--border-subtle)]" required />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--fg-secondary)] text-xs uppercase tracking-wide">Chat ID (required)</Label>
              <Input value={chatId} onChange={e => setChatId(e.target.value)}
                placeholder="-1001234567890 or @channelname"
                className="text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] font-mono text-xs focus-visible:ring-white/20 bg-[var(--bg-app)] border border-[var(--border-subtle)]"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsTelegramModalOpen(false)}
                className="hover:bg-white/10 text-[var(--fg-primary)] hover:text-[var(--fg-primary)]">Cancel</Button>
              <Button type="submit" disabled={connectingTelegram} className="border-0 bg-[var(--fg-primary)] text-[var(--bg-base)]">
                {connectingTelegram ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting…</> : "Connect Bot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
