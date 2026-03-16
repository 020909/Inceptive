"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingTable } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Goal } from "@/types/database";
import { Target, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-[#1F1F1F] text-white",
    completed: "bg-[#111111] text-[#888888]",
    paused: "bg-[#111111] text-[#555555] border border-[#1F1F1F]",
  };

  return (
    <span
      className={`text-[10px] font-medium uppercase px-2.5 py-1 rounded-full ${
        styles[status] || styles.active
      }`}
    >
      {status}
    </span>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <div className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 transition-all duration-200 hover:border-[#333333]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white mb-1">
            {goal.title}
          </h3>
          {goal.description && (
            <p className="text-sm text-[#888888] line-clamp-2">
              {goal.description}
            </p>
          )}
        </div>
        <StatusBadge status={goal.status} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#555555]">Progress</span>
          <span className="text-sm font-medium text-white">
            {goal.progress_percent}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#1F1F1F]">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${goal.progress_percent}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-[#555555] mt-4">
        Created{" "}
        {new Date(goal.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string }>({});

  useEffect(() => {
    if (!user) return;

    const fetchGoals = async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setGoals((data as Goal[]) || []);
      setLoading(false);
    };

    fetchGoals();
  }, [user, supabase]);

  const handleAddGoal = async () => {
    if (!title.trim()) {
      setErrors({ title: "Title is required" });
      return;
    }
    if (!user) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        status: "active",
        progress_percent: 0,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create goal");
      setSaving(false);
      return;
    }

    setGoals((prev) => [data as Goal, ...prev]);
    setTitle("");
    setDescription("");
    setDialogOpen(false);
    setSaving(false);
    toast.success("Goal created successfully");
  };

  if (loading) {
    return (
      <PageTransition>
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Goal Tracking
              </h1>
              <p className="text-sm text-[#888888]">
                Track progress on your long-term objectives
              </p>
            </div>
          </div>
          <LoadingTable />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Goal Tracking
            </h1>
            <p className="text-sm text-[#888888]">
              Track progress on your long-term objectives
            </p>
          </div>

          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-white text-black hover:bg-white/90 rounded-lg h-10 px-4 text-sm font-medium transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-sm text-[#888888]">Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setErrors({});
                    }}
                    placeholder="e.g., Launch new product"
                    className="h-11 bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200"
                  />
                  {errors.title && (
                    <p className="text-xs text-[#EF4444]">{errors.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[#888888]">
                    Description (optional)
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your goal..."
                    className="min-h-[100px] bg-[#111111] border-[#333333] text-white placeholder:text-[#555555] rounded-lg focus:border-white focus:ring-0 transition-colors duration-200 resize-none"
                  />
                </div>
                <Button
                  onClick={handleAddGoal}
                  disabled={saving}
                  className="w-full h-11 bg-white text-black hover:bg-white/90 rounded-lg font-medium transition-all duration-200"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create Goal"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Add goals to track your AI's progress toward your long-term objectives."
            actionLabel="Add Goal"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
