"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

import { PageTransition } from "@/components/ui/page-transition";
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
import { Share2, Plus, Loader2, Calendar, Check, Unlink, ExternalLink, Send, Bot } from "lucide-react";
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
}

const SOCIAL_CONNECTORS = [
  { id: "x",         provider: "twitter",   name: "X (Twitter)", logo: "/logos/social/x.png",         users: "600M+",  oauthPath: "/api/auth/twitter/connect",  telegramInput: false },
  { id: "linkedin",  provider: "linkedin",  name: "LinkedIn",    logo: "/logos/social/linkedin.png",  users: "950M+",  oauthPath: "/api/auth/linkedin/connect", telegramInput: false },
  { id: "facebook",  provider: "facebook",  name: "Facebook",    logo: "/logos/social/facebook.png",  users: "3B+",    oauthPath: "/api/auth/meta/connect",     telegramInput: false },
  { id: "instagram", provider: "instagram", name: "Instagram",   logo: "/logos/social/instagram.png", users: "2B+",    oauthPath: "/api/auth/meta/connect",     telegramInput: false },
  { id: "telegram",  provider: "telegram",  name: "Telegram",    logo: "/logos/social/telegram.png",  users: "900M+",  oauthPath: null,                         telegramInput: true  },
  { id: "tiktok",    provider: "tiktok",    name: "TikTok",      logo: "/logos/social/tiktok.png",    users: "1.5B+",  oauthPath: "/api/auth/tiktok/connect",   telegramInput: false },
  { id: "youtube",   provider: "youtube",   name: "YouTube",     logo: "/logos/social/youtube.png",   users: "2.5B+",  oauthPath: "/api/auth/google/connect",   telegramInput: false },
  { id: "whatsapp",  provider: "whatsapp",  name: "WhatsApp",    logo: "/logos/social/whatsapp.png",  users: "2B+",    oauthPath: null,                         telegramInput: false },
  { id: "wechat",    provider: "wechat",    name: "WeChat",      logo: "/logos/social/wechat.png",    users: "1.3B+",  oauthPath: null,                         telegramInput: false },
  { id: "snapchat",  provider: "snapchat",  name: "Snapchat",    logo: "/logos/social/snapchat.png",  users: "750M+",  oauthPath: null,                         telegramInput: false },
];

function ConnectorCard({ connector, connected, connectedAccount, accessToken, onDisconnect, onTelegramConnect }: {
  connector: typeof SOCIAL_CONNECTORS[0];
  connected: boolean;
  connectedAccount?: ConnectedAccount;
  accessToken: string | null;
  onDisconnect: (provider: string) => void;
  onTelegramConnect: () => void;
}) {
  const handleConnect = () => {
    if (connector.telegramInput) { onTelegramConnect(); return; }
    if (!connector.oauthPath) { toast.info(`${connector.name} — coming soon`); return; }
    if (!accessToken) { toast.error("Please sign in first"); return; }
    window.location.href = `${connector.oauthPath}?token=${encodeURIComponent(accessToken)}&redirect_to=/social`;
  };
  const displayName = connectedAccount?.account_name || connectedAccount?.metadata?.username;
  return (
    <motion.div whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }} transition={{ duration: 0.18 }}
      className="flex items-center gap-3 p-4 rounded-2xl border transition-colors duration-150"
      style={{ background: "var(--background-elevated)", borderColor: connected ? "#007AFF40" : "#2C2C2E" }}>
      <img src={connector.logo} alt={connector.name} width={28} height={28} className="object-contain shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white leading-tight">{connector.name}</div>
        <div className="text-xs text-[var(--foreground-tertiary)] truncate">
          {connected && displayName ? displayName : connector.users + " users"}
        </div>
      </div>
      {connected ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: "#30D15820", color: "#30D158", border: "1px solid #30D15830" }}>
            <Check className="w-3 h-3" /><span>On</span>
          </div>
          <button onClick={() => onDisconnect(connector.provider)}
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(255,59,48,0.1)", color: "#FF3B30" }} title="Disconnect">
            <Unlink className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button onClick={handleConnect}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-opacity"
          style={{ background: (connector.oauthPath || connector.telegramInput) ? "#007AFF" : "#38383A", color: (connector.oauthPath || connector.telegramInput) ? "#FFFFFF" : "#8E8E93" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}>
          {connector.telegramInput ? <Bot className="w-3 h-3" /> : connector.oauthPath ? <ExternalLink className="w-3 h-3" /> : null}
          {(connector.oauthPath || connector.telegramInput) ? "Connect" : "Soon"}
        </button>
      )}
    </motion.div>
  );
}

export default function SocialPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
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
  // Telegram bot setup
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [connectingTelegram, setConnectingTelegram] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("social_posts").select("*")
        .eq("user_id", user?.id).order("created_at", { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [user]);

  const fetchConnected = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/connectors", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setConnectedAccounts(data.accounts || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAccessToken(session.access_token);
        if (user) { fetchPosts(); fetchConnected(session.access_token); }
      } else { setLoading(false); }
    };
    init();
  }, [user, fetchPosts, fetchConnected]);

  // Handle OAuth callback params (no useSearchParams — avoids Next.js Suspense requirement)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success(`${connected} connected!`);
    if (error) toast.error(`Connection failed: ${decodeURIComponent(error)}`);
    if (connected || error) window.history.replaceState({}, "", "/social");
  }, []);

  const handleDisconnect = async (provider: string) => {
    if (!accessToken) return;
    try {
      await fetch(`/api/connectors?provider=${provider}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      setConnectedAccounts(prev => prev.filter(a => a.provider !== provider));
      toast.success(`${provider} disconnected`);
    } catch { toast.error("Failed to disconnect"); }
  };

  const handleTelegramConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken || !accessToken) return;
    setConnectingTelegram(true);
    try {
      const res = await fetch("/api/auth/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ bot_token: botToken, chat_id: chatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");
      toast.success(`Telegram bot @${data.bot.username} connected!`);
      setIsTelegramModalOpen(false);
      setBotToken(""); setChatId("");
      fetchConnected(accessToken);
    } catch (err: any) { toast.error(err.message); }
    finally { setConnectingTelegram(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !user) return;
    setSaving(true);
    try {
      if (generateWithAi) {
        if (!topic) { toast.error("Please provide a topic for AI"); setSaving(false); return; }
        const res = await fetch("/api/agent/social", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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
    if (!accessToken) return;
    setPublishing(postId);
    try {
      const res = await fetch("/api/actions/publish-post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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
    if (status === "published") return "bg-emerald-500";
    if (status === "draft") return "bg-yellow-500";
    return "bg-[#555555]";
  };

  const platformProvider: Record<string, string> = {
    x: "twitter", twitter: "twitter", linkedin: "linkedin", facebook: "facebook",
    instagram: "instagram", telegram: "telegram", tiktok: "tiktok", youtube: "youtube",
  };

  const isPlatformConnected = (p: string) => {
    const prov = platformProvider[p.toLowerCase()];
    return prov ? connectedAccounts.some(a => a.provider === prov) : false;
  };

  if (loading) return (
    <PageTransition><div>
      <div className="h-7 w-48 shimmer rounded-lg mb-2" />
      <div className="h-4 w-64 shimmer rounded mb-8" />
      <div className="h-[280px] rounded-2xl shimmer" />
    </div></PageTransition>
  );

  return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Social Media Manager</h1>
            <p className="text-sm text-[var(--foreground-secondary)]">Schedule and publish posts powered by AI</p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="self-start sm:self-auto">
            <Button onClick={() => { setPlatform("X"); setContent(""); setTopic(""); setScheduleTime(""); setGenerateWithAi(false); setIsModalOpen(true); }}
              className="rounded-lg h-10 px-4 text-sm font-medium border-0" style={{ background: "#007AFF", color: "var(--foreground)" }}>
              <Plus className="h-4 w-4 mr-2" />Create Post
            </Button>
          </motion.div>
        </motion.div>

        {/* Connectors */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl border p-5 mb-8" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Connect Social Accounts</h2>
              <p className="text-xs text-[var(--foreground-secondary)] mt-0.5">Link accounts so Inceptive can post on your behalf</p>
            </div>
            {connectedAccounts.length > 0 && (
              <span className="text-xs text-[#30D158] font-medium">{connectedAccounts.length} connected</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SOCIAL_CONNECTORS.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <ConnectorCard connector={c}
                  connected={connectedAccounts.some(a => a.provider === c.provider)}
                  connectedAccount={connectedAccounts.find(a => a.provider === c.provider)}
                  accessToken={accessToken} onDisconnect={handleDisconnect}
                  onTelegramConnect={() => setIsTelegramModalOpen(true)} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Posts list */}
        {posts.length === 0 ? (
          <motion.div className="flex flex-col items-center justify-center py-28 text-center border rounded-2xl"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
              style={{ background: "#007AFF15", border: "1px solid #007AFF30" }}>
              <Share2 className="h-6 w-6 text-[#007AFF]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">No posts yet</h3>
            <p className="text-sm text-[var(--foreground-secondary)] mb-6 max-w-sm">Connect your accounts, then let AI draft and publish your social posts.</p>
            <Button onClick={() => setIsModalOpen(true)} className="rounded-xl px-5 h-10 text-sm font-semibold border-0"
              style={{ background: "#007AFF", color: "var(--foreground)" }}>
              <Plus className="h-4 w-4 mr-2" />Create Post
            </Button>
          </motion.div>
        ) : (
          <motion.div className="grid gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <AnimatePresence>
              {posts.map((post, idx) => (
                <motion.div key={post.id}
                  className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 transition-colors duration-150"
                  style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: idx * 0.04 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#48484A"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#38383A"; }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 text-white text-xs font-semibold rounded-full tracking-wide" style={{ background: "var(--border)" }}>
                        {post.platform}
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ background: "var(--background-overlay)", borderColor: "var(--border)" }}>
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(post.status)}`} />
                        <span className="text-xs uppercase font-medium tracking-wide text-[var(--foreground-secondary)]">{post.status}</span>
                      </div>
                    </div>
                    <p className="text-sm text-white leading-relaxed line-clamp-2">{post.content}</p>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    {(post.scheduled_for || post.scheduled_at) && (
                      <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--foreground-secondary)] text-sm border" style={{ background: "var(--background-overlay)", borderColor: "var(--border)" }}>
                        <Calendar className="h-4 w-4" />
                        {new Date(post.scheduled_for || post.scheduled_at!).toLocaleDateString()} at {new Date(post.scheduled_for || post.scheduled_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                    {post.status !== "published" && (
                      <button
                        onClick={() => handlePublish(post.id)}
                        disabled={publishing === post.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                        style={{ background: isPlatformConnected(post.platform) ? "#007AFF" : "#38383A", color: "var(--foreground)" }}
                        title={isPlatformConnected(post.platform) ? `Publish to ${post.platform}` : "Connect account to publish"}>
                        {publishing === post.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Send className="h-3 w-3" />}
                        {isPlatformConnected(post.platform) ? "Publish Now" : "Publish"}
                      </button>
                    )}
                    {post.status === "published" && (
                      <span className="text-xs text-[#30D158] font-medium">{post.created_at ? formatTimeAgo(new Date(post.created_at)) : "Published"}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Create Post Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border text-white sm:max-w-xl" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <DialogHeader><DialogTitle className="text-white">Create Social Post</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Platform</Label>
                <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                  <SelectTrigger style={{ background: "var(--background-overlay)", border: "1px solid var(--border)", color: "white" }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: "var(--background)", border: "1px solid var(--border)", color: "white" }}>
                    {["X", "LinkedIn", "Instagram", "Facebook", "Telegram", "TikTok", "YouTube"].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Schedule Time</Label>
                <Input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="text-white focus-visible:ring-[#007AFF] [color-scheme:dark]"
                  style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="use-ai" checked={generateWithAi} onChange={e => setGenerateWithAi(e.target.checked)}
                className="rounded w-4 h-4 cursor-pointer accent-[#007AFF]" />
              <Label htmlFor="use-ai" className="cursor-pointer select-none text-[var(--foreground-secondary)]">Generate with AI</Label>
            </div>
            {generateWithAi ? (
              <div className="space-y-2">
                <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Topic</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="What should the post be about?"
                  className="text-white placeholder:text-[var(--border-strong)] focus-visible:ring-[#007AFF]"
                  style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }} required />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Content</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Write your post here..."
                  className="text-white placeholder:text-[var(--border-strong)] focus-visible:ring-[#007AFF] min-h-[120px]"
                  style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }} required />
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}
                className="hover:bg-[#2C2C2E] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="border-0" style={{ background: "#007AFF", color: "var(--foreground)" }}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{generateWithAi ? "Generating…" : "Saving…"}</> : generateWithAi ? "Generate & Save" : "Schedule Post"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Telegram Bot Token Modal */}
      <Dialog open={isTelegramModalOpen} onOpenChange={setIsTelegramModalOpen}>
        <DialogContent className="border text-white sm:max-w-md" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <img src="/logos/social/telegram.png" width={22} height={22} className="object-contain" alt="Telegram" />
              Connect Telegram Bot
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTelegramConnect} className="space-y-4 pt-4">
            <div className="px-3 py-3 rounded-xl text-xs text-[var(--foreground-secondary)] leading-relaxed"
              style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }}>
              1. Create a bot via <span className="text-[#007AFF]">@BotFather</span> on Telegram<br/>
              2. Copy the bot token and paste below<br/>
              3. Add your bot to a channel/group and paste the Chat ID
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Bot Token</Label>
              <Input value={botToken} onChange={e => setBotToken(e.target.value)}
                placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className="text-white placeholder:text-[var(--border-strong)] font-mono text-xs focus-visible:ring-[#007AFF]"
                style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }} required />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--foreground-secondary)] text-xs uppercase tracking-wide">Chat ID (channel or group)</Label>
              <Input value={chatId} onChange={e => setChatId(e.target.value)}
                placeholder="-1001234567890 or @channelname"
                className="text-white placeholder:text-[var(--border-strong)] font-mono text-xs focus-visible:ring-[#007AFF]"
                style={{ background: "var(--background-overlay)", border: "1px solid var(--border)" }} />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsTelegramModalOpen(false)}
                className="hover:bg-[#2C2C2E] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={connectingTelegram} className="border-0" style={{ background: "#007AFF", color: "var(--foreground)" }}>
                {connectingTelegram ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting…</> : "Connect Bot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
