"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Target, Loader2, Check, Pencil, Trash2, Calendar, CheckCircle2, TrendingUp, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Goal {
  id: string;
  title: string;
  description: string;
  progress_percent: number;
  status: "active" | "completed" | "paused";
  created_at: string;
}

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"active" | "completed" | "paused">("active");
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchGoals = async (token: string) => {
    try {
      const res = await fetch("/api/goals", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch goals");
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (error) {
      console.error(error);
      toast.error("Could not load goals");
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
        fetchGoals(session.access_token);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !accessToken || !user) return;

    setSaving(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title,
          description,
          progress_percent: 0,
          status: "active",
          user_id: user.id
        })
      });

      if (!res.ok) throw new Error("Failed to create goal");
      
      toast.success("Goal added");
      setIsAddModalOpen(false);
      setTitle("");
      setDescription("");
      fetchGoals(accessToken);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !accessToken || !editingId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/goals`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          id: editingId,
          title,
          description,
          progress_percent: progress,
          status
        })
      });

      if (!res.ok) throw new Error("Failed to update goal");
      
      toast.success("Goal updated");
      setIsEditModalOpen(false);
      fetchGoals(accessToken);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, newProgress?: number) => {
    if (!accessToken) return;
    try {
      const body: any = { id, status: newStatus };
      if (newProgress !== undefined) body.progress_percent = newProgress;

      const res = await fetch(`/api/goals`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      toast.success("Goal updated");
      fetchGoals(accessToken);
    } catch {
      toast.error("Failed to update goal");
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm("Are you sure you want to delete this goal?")) return;
    try {
      const res = await fetch(`/api/goals?id=${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error();
      toast.success("Goal deleted");
      fetchGoals(accessToken);
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  const openEditModal = (goal: Goal) => {
    setEditingId(goal.id);
    setTitle(goal.title);
    setDescription(goal.description);
    setProgress(goal.progress_percent);
    setStatus(goal.status);
    setIsEditModalOpen(true);
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const avgProgress = goals.length > 0 
    ? Math.round(goals.reduce((acc, g) => acc + g.progress_percent, 0) / goals.length)
    : 0;
  const dueThisWeek = activeGoals.length;

  function GoalCard({ goal, index }: { goal: Goal; index: number }) {
    return (
      <motion.div
        className="p-5 rounded-2xl bg-[var(--bg-surface)] card-elevated hover:border-[var(--border-default)] transition-all duration-300"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, type: 'spring', stiffness: 100, damping: 20 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${goal.status === 'completed' ? 'bg-[var(--success-soft)]' : 'bg-[var(--bg-elevated)]'}`}>
              {goal.status === 'completed' ? (
                <CheckCircle2 size={20} className="text-[var(--fg-primary)]" />
              ) : (
                <Target size={20} className="text-[var(--fg-tertiary)]" />
              )}
            </div>
            <div>
              <h3 className="text-[var(--fg-primary)] font-medium tracking-[-0.02em]">{goal.title}</h3>
              <p className="text-[var(--fg-muted)] text-sm">{goal.description}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 w-8 p-0 text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-elevated)] flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)]">
              {goal.status !== 'completed' && (
                <DropdownMenuItem onClick={() => handleUpdateStatus(goal.id, 'completed', 100)} className="hover:bg-[var(--bg-elevated)] cursor-pointer">
                  <Check className="h-4 w-4 mr-2" /> Mark Complete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openEditModal(goal)} className="hover:bg-[var(--bg-elevated)] cursor-pointer">
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(goal.id)} className="text-red-400 hover:bg-[var(--bg-elevated)] hover:text-red-400 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[var(--fg-muted)] text-xs">Progress</span>
            <span className="text-[var(--fg-secondary)] text-xs">{goal.progress_percent}%</span>
          </div>
          <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[var(--fg-primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress_percent}%` }}
              transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-[var(--fg-muted)]">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(goal.created_at).toLocaleDateString()}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[var(--fg-muted)] text-[11px]">
            {goal.status === 'completed' ? 'Completed' : goal.status === 'paused' ? 'Paused' : 'Active'}
          </span>
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="h-28 shimmer rounded-[28px] mt-4 sm:mt-5" />
        <div className="flex-1 p-8">
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-32 shimmer rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="page-hero mt-4 sm:mt-5 flex items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">Planning</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.02em]">Goals</h1>
            <p className="text-[var(--fg-muted)] text-sm mt-2">Track objectives, milestones, and execution momentum.</p>
          </div>
          <motion.button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] font-medium text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setTitle("");
              setDescription("");
              setIsAddModalOpen(true);
            }}
          >
            <Plus size={16} />
            New Goal
          </motion.button>
        </header>

        {/* Content */}
        <div className="flex-1 p-8">
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Target size={18} className="text-[var(--fg-secondary)]" />
                <span className="text-[var(--fg-muted)] text-xs">Active Goals</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{activeGoals.length}</p>
            </motion.div>
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 size={18} className="text-[var(--fg-secondary)]" />
                <span className="text-[var(--fg-muted)] text-xs">Completed</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{completedGoals.length}</p>
            </motion.div>
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp size={18} className="text-[var(--fg-secondary)]" />
                <span className="text-[var(--fg-muted)] text-xs">Avg. Progress</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{avgProgress}%</p>
            </motion.div>
            <motion.div
              className="page-kpi p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Clock size={18} className="text-[var(--fg-secondary)]" />
                <span className="text-[var(--fg-muted)] text-xs">Due This Week</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">{dueThisWeek}</p>
            </motion.div>
          </div>

          {/* Goals Grid */}
          {goals.length === 0 ? (
            <motion.div
              className="flex flex-col items-center justify-center py-24 rounded-2xl bg-[var(--bg-surface)] card-elevated"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Target size={32} className="text-[var(--fg-muted)] mb-4" />
              <p className="text-[var(--fg-secondary)] mb-2">No goals yet</p>
              <p className="text-[var(--fg-muted)] text-sm mb-6">Create your first goal to start tracking progress</p>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-[var(--fg-primary)] text-[var(--bg-base)] font-medium"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Goal
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {goals.map((goal, index) => (
                <GoalCard key={goal.id} goal={goal} index={index} />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Add Goal Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="E.g. Launch new feature"
                className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] focus:border-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does success look like?"
                className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] focus:border-white min-h-[100px]"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="hover:bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:text-[var(--fg-primary)]">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] focus:border-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] focus:border-white min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Progress (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={e => setProgress(Number(e.target.value))}
                  className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] focus:border-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--fg-primary)] focus:border-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--fg-primary)]">
                    <SelectItem value="active" className="hover:bg-[var(--bg-elevated)] focus:bg-[var(--bg-elevated)] focus:text-[var(--fg-primary)]">Active</SelectItem>
                    <SelectItem value="paused" className="hover:bg-[var(--bg-elevated)] focus:bg-[var(--bg-elevated)] focus:text-[var(--fg-primary)]">Paused</SelectItem>
                    <SelectItem value="completed" className="hover:bg-[var(--bg-elevated)] focus:bg-[var(--bg-elevated)] focus:text-[var(--fg-primary)]">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)} className="hover:bg-[var(--bg-elevated)] text-[var(--fg-primary)] hover:text-[var(--fg-primary)]">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
