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
import { Plus, MoreVertical, Target, Loader2, Check, Pencil, Trash2 } from "lucide-react";
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

  // Form state
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
    } catch (err) {
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
    } catch (err) {
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

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <Button disabled className="bg-[#007AFF] text-white h-10 px-4">
            <Plus className="h-4 w-4 mr-2" /> Add Goal
          </Button>
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => (
             <div key={i} className="rounded-xl border border-[var(--border)] bg-[#242426] p-6 skeleton">
               <div className="h-6 w-1/3 bg-[#2C2C2E] rounded mb-2"></div>
               <div className="h-4 w-1/2 bg-[#2C2C2E] rounded mb-6"></div>
               <div className="h-2 w-full bg-[#2C2C2E] rounded"></div>
             </div>
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl">
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={() => {
                setTitle("");
                setDescription("");
                setIsAddModalOpen(true);
              }}
              className="bg-[#007AFF] text-white hover:bg-[#0A84FF] rounded-lg h-10 px-4 text-sm font-medium transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </motion.div>
        </motion.div>

        {goals.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-20 text-center border border-[var(--border)] rounded-xl bg-[#242426]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2C2C2E] border border-[var(--border)] mb-6">
              <Target className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No goals yet</h3>
            <p className="text-[var(--foreground-secondary)] mb-6 max-w-sm">
              Set your first goal and Inceptive will work toward it every night.
            </p>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#007AFF] text-white hover:bg-[#0A84FF]"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Goal
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal, idx) => (
              <motion.div
                key={goal.id}
                className="rounded-xl border border-[var(--border)] bg-[#242426] p-6 relative group hover:border-[#3A3A3C] transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                whileHover={{ backgroundColor: "#2C2C2E" }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-white">{goal.title}</h3>
                      {goal.status === 'active' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-white/20 text-white">Active</span>}
                      {goal.status === 'completed' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#30D158]/10 text-[#30D158] border border-[#30D158]/20">Completed</span>}
                      {goal.status === 'paused' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#2C2C2E] text-[var(--foreground-secondary)] border border-[var(--border)]">Paused</span>}
                    </div>
                    {goal.description && <p className="text-sm text-[var(--foreground-secondary)]">{goal.description}</p>}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 p-0 text-[var(--foreground-secondary)] hover:text-white hover:bg-[#2A2A2C] flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#2A2A2C] border-[var(--border)] text-white">
                      {goal.status !== 'completed' && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(goal.id, 'completed', 100)} className="hover:bg-[#38383A] cursor-pointer">
                          <Check className="h-4 w-4 mr-2" /> Mark Complete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openEditModal(goal)} className="hover:bg-[#38383A] cursor-pointer">
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(goal.id)} className="text-[#FF453A] hover:bg-[#38383A] hover:text-[#FF453A] cursor-pointer">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-2 bg-[#2C2C2E] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#007AFF] rounded-full transition-all duration-500"
                      style={{ width: `${goal.progress_percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white min-w-[3ch]">{goal.progress_percent}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-[var(--border)] text-white sm:max-w-[425px]">
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
                className="bg-[#2A2A2C] border-[var(--border)] text-white focus:border-[#007AFF]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does success look like?"
                className="bg-[#2A2A2C] border-[var(--border)] text-white focus:border-[#007AFF] min-h-[100px]"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="hover:bg-[#2C2C2E] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#007AFF] text-white hover:bg-[#0A84FF]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-[#1C1C1E] border-[var(--border)] text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-[#2A2A2C] border-[var(--border)] text-white focus:border-[#007AFF]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-[#2A2A2C] border-[var(--border)] text-white focus:border-[#007AFF] min-h-[100px]"
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
                  className="bg-[#2A2A2C] border-[var(--border)] text-white focus:border-[#007AFF]"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="bg-[#2A2A2C] border-[var(--border)] text-white focus:border-[#007AFF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-[var(--border)] text-white">
                    <SelectItem value="active" className="hover:bg-[#2C2C2E] focus:bg-[#2C2C2E] focus:text-white">Active</SelectItem>
                    <SelectItem value="paused" className="hover:bg-[#2C2C2E] focus:bg-[#2C2C2E] focus:text-white">Paused</SelectItem>
                    <SelectItem value="completed" className="hover:bg-[#2C2C2E] focus:bg-[#2C2C2E] focus:text-white">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)} className="hover:bg-[#2C2C2E] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-[#007AFF] text-white hover:bg-[#0A84FF]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
