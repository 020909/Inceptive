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
import { Share2, Plus, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatTimeAgo } from "@/lib/utils";

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  status: "scheduled" | "published" | "draft";
  scheduled_for: string;
  created_at: string;
}

export default function SocialPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [platform, setPlatform] = useState("X");
  const [content, setContent] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [generateWithAi, setGenerateWithAi] = useState(false);
  const [topic, setTopic] = useState("");

  const fetchPosts = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !user) return;

    setSaving(true);
    try {
      if (generateWithAi) {
        if (!topic) {
          toast.error("Please provide a topic for AI");
          setSaving(false);
          return;
        }
        
        const res = await fetch("/api/agent/social", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({ platform, topic })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate post");

        // The API actually saves the post. If user specified custom schedule we might update it.
        if (scheduleTime) {
          const supabase = createClient();
          await supabase.from('social_posts').update({ scheduled_for: scheduleTime, status: 'scheduled' }).eq('id', data.post.id);
        }

        toast.success("Post generated and saved!");
      } else {
        // Just save a manual post
        const supabase = createClient();
        const { error } = await supabase.from('social_posts').insert({
          user_id: user.id,
          platform,
          content,
          scheduled_for: scheduleTime || new Date().toISOString(),
          status: "scheduled"
        });

        if (error) throw error;
        toast.success("Post saved!");
      }

      setIsModalOpen(false);
      setContent("");
      setTopic("");
      setGenerateWithAi(false);
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'published') return "bg-emerald-500";
    if (status === 'draft') return "bg-yellow-500";
    return "bg-[#555555]"; // scheduled
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Social Media Manager</h1>
          <Button disabled className="bg-white text-black h-10 px-4">
            <Plus className="h-4 w-4 mr-2" /> Create Post
          </Button>
        </div>
        <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 skeleton h-[240px]" />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Social Media Manager</h1>
          <Button 
            onClick={() => {
              setPlatform("X");
              setContent("");
              setTopic("");
              setScheduleTime("");
              setGenerateWithAi(false);
              setIsModalOpen(true);
            }} 
            className="bg-white text-black hover:bg-white/90 rounded-lg h-10 px-4 text-sm font-medium transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center border border-[#1F1F1F] rounded-xl bg-[#0D0D0D]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#111111] border border-[#333333] mb-6">
              <Share2 className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No posts yet</h3>
            <p className="text-[#888888] mb-6 max-w-sm">
              Schedule your first social media post or let AI generate one for you.
            </p>
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-black hover:bg-white/90"
            >
              <Plus className="h-4 w-4 mr-2" /> Create Post
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-5 flex items-start gap-4 hover:bg-[#111111] transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 bg-[#1F1F1F] text-white text-xs font-semibold rounded-full tracking-wide">
                      {post.platform}
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#111] border border-[#1F1F1F] rounded-full">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(post.status)}`} />
                      <span className="text-xs uppercase font-medium tracking-wide text-[#888]">{post.status}</span>
                    </div>
                  </div>
                  <p className="text-sm text-[#CCCCCC] leading-relaxed line-clamp-2">
                    {post.content}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1F1F1F] rounded-lg text-[#888888] shrink-0 text-sm">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.scheduled_for).toLocaleDateString()} at {new Date(post.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#050505] border-[#1F1F1F] text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Social Post</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                  <SelectTrigger className="bg-[#111111] border-[#333333] text-white focus:border-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D0D0D] border-[#333333] text-white">
                    <SelectItem value="X" className="hover:bg-[#111] focus:bg-[#111]">X</SelectItem>
                    <SelectItem value="LinkedIn" className="hover:bg-[#111] focus:bg-[#111]">LinkedIn</SelectItem>
                    <SelectItem value="Instagram" className="hover:bg-[#111] focus:bg-[#111]">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Schedule Time</Label>
                <Input 
                  type="datetime-local" 
                  value={scheduleTime} 
                  onChange={e => setScheduleTime(e.target.value)} 
                  className="bg-[#111111] border-[#333333] text-white focus:border-white [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input 
                type="checkbox" 
                id="use-ai" 
                checked={generateWithAi} 
                onChange={(e) => setGenerateWithAi(e.target.checked)}
                className="rounded border-[#333333] bg-[#111111] text-white focus:ring-0 w-4 h-4 cursor-pointer accent-white"
              />
              <Label htmlFor="use-ai" className="cursor-pointer select-none">Generate with AI</Label>
            </div>

            {generateWithAi ? (
              <div className="space-y-2">
                <Label>Topic</Label>
                <Input 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)} 
                  placeholder="What should the post be about?"
                  className="bg-[#111111] border-[#333333] text-white focus:border-white"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea 
                  value={content} 
                  onChange={e => setContent(e.target.value)} 
                  placeholder="Write your post here..."
                  className="bg-[#111111] border-[#333333] text-white focus:border-white min-h-[120px]"
                  required
                />
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="hover:bg-[#111] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-white text-black hover:bg-white/90">
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {generateWithAi ? "Generating..." : "Saving..."}</>
                ) : (
                  generateWithAi ? "Generate & Save" : "Schedule Post"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
