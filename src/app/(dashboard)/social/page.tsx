"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingTable } from "@/components/ui/loading-skeleton";
import type { SocialPost } from "@/types/database";
import { Share2 } from "lucide-react";

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="text-[10px] font-medium text-[#888888] uppercase px-2.5 py-1 rounded-full bg-[#1F1F1F]">
      {platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-[#1F1F1F] text-white",
    scheduled: "bg-[#111111] text-[#888888] border border-[#333333]",
    draft: "bg-[#111111] text-[#555555] border border-[#1F1F1F]",
  };

  return (
    <span
      className={`text-[10px] font-medium uppercase px-2.5 py-1 rounded-full ${
        styles[status] || styles.draft
      }`}
    >
      {status}
    </span>
  );
}

export default function SocialPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPosts = async () => {
      const { data } = await supabase
        .from("social_posts")
        .select("*")
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: false });

      setPosts((data as SocialPost[]) || []);
      setLoading(false);
    };

    fetchPosts();
  }, [user, supabase]);

  if (loading) {
    return (
      <PageTransition>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Social Media Manager
          </h1>
          <p className="text-sm text-[#888888] mb-6">
            Posts created and scheduled by your AI
          </p>
          <LoadingTable />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">
          Social Media Manager
        </h1>
        <p className="text-sm text-[#888888] mb-6">
          Posts created and scheduled by your AI
        </p>

        {posts.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No social posts yet"
            description="Your AI agent will create and schedule social media posts here automatically."
          />
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-5 transition-all duration-200 hover:border-[#333333]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <PlatformBadge platform={post.platform} />
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="text-sm text-white leading-relaxed line-clamp-3">
                      {post.content}
                    </p>
                    <p className="text-xs text-[#555555] mt-3">
                      {post.scheduled_at
                        ? `Scheduled for ${new Date(
                            post.scheduled_at
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })} at ${new Date(
                            post.scheduled_at
                          ).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}`
                        : post.published_at
                        ? `Published ${new Date(
                            post.published_at
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}`
                        : "Draft"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
