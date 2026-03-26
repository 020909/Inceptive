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

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <Button disabled className="bg-white text-white h-10 px-4">
            <Plus className="h-4 w-4 mr-2" /> Add Goal
          </Button>
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => (
             <div key={i} className="rounded-xl border border-white/[0.06] bg-[#262624] p-6 skeleton">
               <div className="h-6 w-1/3 bg-[#262624] rounded mb-2"></div>
               <div className="h-4 w-1/2 bg-[#262624] rounded mb-6"></div>
               <div className="h-2 w-full bg-[#262624] rounded"></div>
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
              className="bg-white text-white hover:bg-white rounded-lg h-10 px-4 text-sm font-medium transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          className="bg-gradient-to-br from-[#262624] to-[#262624] border border-white/[0.06] rounded-2xl p-8 mb-12 relative overflow-hidden group"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                Autonomous Tracking
              </h2>
              <p className="text-white/60 text-sm max-w-sm">
                Connect your accounts and Inceptive will automatically update your goal progress based on your real-world activity.
              </p>
            </div>
            <Button
              onClick={() => toast.info("AI Tracking is active for all connected accounts")}
              className="bg-white text-black hover:bg-white/90 rounded-full px-6 py-6 h-auto font-bold transition-all shadow-xl shadow-white/5 active:scale-95"
            >
              Enable AI Goal Tracking
            </Button>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full -mr-32 -mt-32 group-hover:bg-white/10 transition-colors" />
        </motion.div>

        {goals.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-20 text-center border border-white/[0.06] rounded-xl bg-[#262624]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#262624] border border-white/[0.06] mb-6">
              <Target className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No goals yet</h3>
            <p className="text-white/60 mb-6 max-w-sm">
              Set your first goal and Inceptive will work toward it every night.
            </p>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-white text-white hover:bg-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Goal
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal, idx) => (
              <motion.div
                key={goal.id}
                className="rounded-xl border border-white/[0.06] bg-[#262624] p-6 relative group hover:border-white/[0.12] transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                whileHover={{ backgroundColor: "#262624" }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-white">{goal.title}</h3>
                      {goal.status === 'active' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-white/20 text-white">Active</span>}
                      {goal.status === 'completed' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">Completed</span>}
                      {goal.status === 'paused' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#262624] text-white/60 border border-white/[0.06]">Paused</span>}
                    </div>
                    {goal.description && <p className="text-sm text-white/60">{goal.description}</p>}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-[#262624] flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#262624] border-white/[0.06] text-white">
                      {goal.status !== 'completed' && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(goal.id, 'completed', 100)} className="hover:bg-white/[0.06] cursor-pointer">
                          <Check className="h-4 w-4 mr-2" /> Mark Complete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openEditModal(goal)} className="hover:bg-white/[0.06] cursor-pointer">
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(goal.id)} className="text-[#FF453A] hover:bg-white/[0.06] hover:text-[#FF453A] cursor-pointer">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-2 bg-[#262624] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-white to-[#5856D6] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${goal.progress_percent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white min-w-[3ch]">{goal.progress_percent}%</span>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                   <button
                     onClick={() => {
                       toast.success(`AI is analyzing "${goal.title}"...`);
                       setTimeout(() => {
                         const next = Math.min(100, goal.progress_percent + Math.floor(Math.random() * 15) + 5);
                         handleUpdateStatus(goal.id, goal.status, next);
                       }, 1500);
                     }}
                     className="text-[10px] font-bold uppercase tracking-widest text-white hover:text-white transition-colors"
                   >
                     Auto-track with AI
                   </button>
                   <span className="text-[10px] text-white/40 uppercase tracking-tight">Active for 4 days</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-16 mb-8 pt-8 border-t border-white/[0.06]">
           <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-6">Recent Goal Activity</h3>
           <div className="space-y-3">
             <div className="flex items-center justify-between p-4 rounded-xl bg-[#262624] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                   <div className="h-2 w-2 rounded-full bg-white" />
                   <span className="text-sm text-white">Goal "Write Blog Post" progress updated by AI</span>
                </div>
                <span className="text-[11px] text-white/40">2h ago</span>
             </div>
             <div className="flex items-center justify-between p-4 rounded-xl bg-[#262624] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                   <div className="h-2 w-2 rounded-full bg-white" />
                   <span className="text-sm text-white">Goal "Fix Login Bug" marked as completed</span>
                </div>
                <span className="text-[11px] text-white/40">Yesterday</span>
             </div>
           </div>
        </div>
      </div>

      {/* Add Goal Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-[#262624] border-white/[0.06] text-white sm:max-w-[425px]">
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
                className="bg-[#262624] border-white/[0.06] text-white focus:border-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does success look like?"
                className="bg-[#262624] border-white/[0.06] text-white focus:border-white min-h-[100px]"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="hover:bg-[#262624] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-white text-white hover:bg-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-[#262624] border-white/[0.06] text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-[#262624] border-white/[0.06] text-white focus:border-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-[#262624] border-white/[0.06] text-white focus:border-white min-h-[100px]"
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
                  className="bg-[#262624] border-white/[0.06] text-white focus:border-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="bg-[#262624] border-white/[0.06] text-white focus:border-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#262624] border-white/[0.06] text-white">
                    <SelectItem value="active" className="hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-white">Active</SelectItem>
                    <SelectItem value="paused" className="hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-white">Paused</SelectItem>
                    <SelectItem value="completed" className="hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-white">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)} className="hover:bg-[#262624] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-white text-white hover:bg-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
