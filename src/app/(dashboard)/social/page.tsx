"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Share2, Plus, Loader2, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils";
import { motion } from "framer-motion";

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  status: "scheduled" | "published" | "draft";
  scheduled_for: string;
  created_at: string;
}

// Top 10 social media platforms by number of users
const SOCIAL_CONNECTORS = [
  { id: "facebook", name: "Facebook", domain: "facebook.com", users: "3B+ users" },
  { id: "youtube", name: "YouTube", domain: "youtube.com", users: "2.5B+ users" },
  { id: "whatsapp", name: "WhatsApp", domain: "whatsapp.com", users: "2B+ users" },
  { id: "instagram", name: "Instagram", domain: "instagram.com", users: "2B+ users" },
  { id: "tiktok", name: "TikTok", domain: "tiktok.com", users: "1.5B+ users" },
  { id: "wechat", name: "WeChat", domain: "wechat.com", users: "1.3B+ users" },
  { id: "telegram", name: "Telegram", domain: "telegram.org", users: "900M+ users" },
  { id: "snapchat", name: "Snapchat", domain: "snapchat.com", users: "750M+ users" },
  { id: "x", name: "X (Twitter)", domain: "x.com", users: "600M+ users" },
  { id: "linkedin", name: "LinkedIn", domain: "linkedin.com", users: "950M+ users" },
];

function ConnectorCard({ connector, connected, onConnect }: {
  connector: typeof SOCIAL_CONNECTORS[0];
  connected: boolean;
  onConnect: (id: string) => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="flex items-center gap-3 p-4 rounded-2xl border transition-all duration-150"
      style={{ background: "#242426", borderColor: connected ? "#007AFF40" : "#38383A" }}
    >
      <div className="w-9 h-9 rounded-xl overflow-hidden border flex items-center justify-center shrink-0"
        style={{ borderColor: "#38383A", background: "#1C1C1E" }}>
        <img
          src={`https://logo.clearbit.com/${connector.domain}`}
          alt={connector.name}
          width={24}
          height={24}
          className="object-contain"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = "none";
            (target.nextSibling as HTMLElement).style.display = "flex";
          }}
        />
        <div className="w-6 h-6 rounded-lg hidden items-center justify-center text-xs font-bold text-[#8E8E93]"
          style={{ background: "#2C2C2E" }}>
          {connector.name[0]}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white leading-tight">{connector.name}</div>
        <div className="text-xs text-[#636366]">{connector.users}</div>
      </div>
      {connected ? (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0"
          style={{ background: "#30D15820", color: "#30D158", border: "1px solid #30D15830" }}>
          <Check className="w-3 h-3" />
          <span>On</span>
        </div>
      ) : (
        <button
          onClick={() => onConnect(connector.id)}
          className="px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-opacity"
          style={{ background: "#007AFF", color: "#FFFFFF" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          Connect
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
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [platform, setPlatform] = useState("X");
  const [content, setContent] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [generateWithAi, setGenerateWithAi] = useState(false);
  const [topic, setTopic] = useState("");

  const fetchPosts = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAccessToken(session.access_token);
        if (user) fetchPosts();
      } else {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const handleConnect = (id: string) => {
    toast.info("Social OAuth coming soon — connector UI is ready.");
    setConnectedPlatforms(prev => prev.includes(id) ? prev : [...prev, id]);
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
        if (!res.ok) throw new Error(data.error || "Failed to generate post");
        if (scheduleTime) {
          const supabase = createClient();
          await supabase.from("social_posts").update({ scheduled_for: scheduleTime, status: "scheduled" }).eq("id", data.post.id);
        }
        toast.success("Post generated and saved!");
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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "published") return "bg-emerald-500";
    if (status === "draft") return "bg-yellow-500";
    return "bg-[#555555]";
  };

  if (loading) {
    return (
      <PageTransition>
        <div>
          <div className="h-7 w-48 shimmer rounded-lg mb-2" />
          <div className="h-4 w-64 shimmer rounded mb-8" />
          <div className="h-[280px] rounded-2xl shimmer" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Social Media Manager</h1>
            <p className="text-sm text-[#8E8E93]">Schedule and publish posts powered by AI</p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => {
                setPlatform("X"); setContent(""); setTopic("");
                setScheduleTime(""); setGenerateWithAi(false); setIsModalOpen(true);
              }}
              className="rounded-lg h-10 px-4 text-sm font-medium border-0"
              style={{ background: "#007AFF", color: "#FFFFFF" }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Post
            </Button>
          </motion.div>
        </motion.div>

        {/* Social Connectors */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl border p-5 mb-8"
          style={{ background: "#1C1C1E", borderColor: "#38383A" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Connect Social Accounts</h2>
              <p className="text-xs text-[#8E8E93] mt-0.5">Link your accounts so Inceptive can post on your behalf</p>
            </div>
            {connectedPlatforms.length > 0 && (
              <span className="text-xs text-[#30D158] font-medium">{connectedPlatforms.length} connected</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SOCIAL_CONNECTORS.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <ConnectorCard
                  connector={c}
                  connected={connectedPlatforms.includes(c.id)}
                  onConnect={handleConnect}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Posts list */}
        {posts.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-28 text-center border rounded-2xl"
            style={{ background: "#242426", borderColor: "#38383A" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
              style={{ background: "#007AFF15", border: "1px solid #007AFF30" }}>
              <Share2 className="h-6 w-6 text-[#007AFF]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">No posts yet</h3>
            <p className="text-sm text-[#8E8E93] mb-6 max-w-sm">
              Schedule your first social media post or let AI generate one for you.
            </p>
            <Button onClick={() => setIsModalOpen(true)}
              className="rounded-xl px-5 h-10 text-sm font-semibold border-0"
              style={{ background: "#007AFF", color: "#FFFFFF" }}>
              <Plus className="h-4 w-4 mr-2" /> Create Post
            </Button>
          </motion.div>
        ) : (
          <motion.div className="grid gap-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {posts.map((post, idx) => (
              <motion.div key={post.id}
                className="rounded-2xl border p-5 flex items-start gap-4 transition-colors duration-150"
                style={{ background: "#242426", borderColor: "#38383A" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#48484A"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#38383A"; }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 text-white text-xs font-semibold rounded-full tracking-wide" style={{ background: "#38383A" }}>
                      {post.platform}
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ background: "#2A2A2C", borderColor: "#38383A" }}>
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(post.status)}`} />
                      <span className="text-xs uppercase font-medium tracking-wide text-[#8E8E93]">{post.status}</span>
                    </div>
                  </div>
                  <p className="text-sm text-white leading-relaxed line-clamp-2">{post.content}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-[#8E8E93] shrink-0 text-sm border" style={{ background: "#2A2A2C", borderColor: "#38383A" }}>
                  <Calendar className="h-4 w-4" />
                  {new Date(post.scheduled_for).toLocaleDateString()} at {new Date(post.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border text-white sm:max-w-xl" style={{ background: "#1C1C1E", borderColor: "#38383A" }}>
          <DialogHeader>
            <DialogTitle className="text-white">Create Social Post</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8E8E93] text-xs uppercase tracking-wide">Platform</Label>
                <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                  <SelectTrigger style={{ background: "#2A2A2C", border: "1px solid #38383A", color: "white" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#1C1C1E", border: "1px solid #38383A", color: "white" }}>
                    {["X", "LinkedIn", "Instagram", "Facebook", "TikTok", "YouTube"].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8E8E93] text-xs uppercase tracking-wide">Schedule Time</Label>
                <Input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="text-white focus-visible:ring-[#007AFF] [color-scheme:dark]"
                  style={{ background: "#2A2A2C", border: "1px solid #38383A" }} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="use-ai" checked={generateWithAi}
                onChange={(e) => setGenerateWithAi(e.target.checked)}
                className="rounded w-4 h-4 cursor-pointer accent-[#007AFF]"
              />
              <Label htmlFor="use-ai" className="cursor-pointer select-none text-[#8E8E93]">Generate with AI</Label>
            </div>
            {generateWithAi ? (
              <div className="space-y-2">
                <Label className="text-[#8E8E93] text-xs uppercase tracking-wide">Topic</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="What should the post be about?"
                  className="text-white placeholder:text-[#48484A] focus-visible:ring-[#007AFF]"
                  style={{ background: "#2A2A2C", border: "1px solid #38383A" }} required />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[#8E8E93] text-xs uppercase tracking-wide">Content</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Write your post here..."
                  className="text-white placeholder:text-[#48484A] focus-visible:ring-[#007AFF] min-h-[120px]"
                  style={{ background: "#2A2A2C", border: "1px solid #38383A" }} required />
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}
                className="hover:bg-[#2C2C2E] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving}
                className="border-0" style={{ background: "#007AFF", color: "#FFFFFF" }}>
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{generateWithAi ? "Generating…" : "Saving…"}</>
                  : generateWithAi ? "Generate & Save" : "Schedule Post"
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
