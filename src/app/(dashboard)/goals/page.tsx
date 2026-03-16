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
          <Button disabled className="bg-white text-black h-10 px-4">
            <Plus className="h-4 w-4 mr-2" /> Add Goal
          </Button>
        </div>
        <div className="space-y-4">
          {[1,2,3].map(i => (
             <div key={i} className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 skeleton">
               <div className="h-6 w-1/3 bg-[#111] rounded mb-2"></div>
               <div className="h-4 w-1/2 bg-[#111] rounded mb-6"></div>
               <div className="h-2 w-full bg-[#111] rounded"></div>
             </div>
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <Button 
            onClick={() => {
              setTitle("");
              setDescription("");
              setIsAddModalOpen(true);
            }} 
            className="bg-white text-black hover:bg-white/90 rounded-lg h-10 px-4 text-sm font-medium transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-[#1F1F1F] rounded-xl bg-[#0D0D0D]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#111111] border border-[#333333] mb-6">
              <Target className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No goals yet</h3>
            <p className="text-[#888888] mb-6 max-w-sm">
              Set your first goal and Inceptive will work toward it every night.
            </p>
            <Button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-white text-black hover:bg-white/90"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Goal
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <div key={goal.id} className="rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] p-6 relative group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-white">{goal.title}</h3>
                      {goal.status === 'active' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-white/20 text-white">Active</span>}
                      {goal.status === 'completed' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Completed</span>}
                      {goal.status === 'paused' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#333] text-[#888] border border-[#444]">Paused</span>}
                    </div>
                    {goal.description && <p className="text-sm text-[#888888]">{goal.description}</p>}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 p-0 text-[#888888] hover:text-white hover:bg-[#111111] flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#111111] border-[#333333] text-white">
                      {goal.status !== 'completed' && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(goal.id, 'completed', 100)} className="hover:bg-[#1F1F1F] cursor-pointer">
                          <Check className="h-4 w-4 mr-2" /> Mark Complete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openEditModal(goal)} className="hover:bg-[#1F1F1F] cursor-pointer">
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(goal.id)} className="text-red-500 hover:bg-[#1F1F1F] hover:text-red-400 cursor-pointer">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-2 bg-[#111111] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${goal.progress_percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white min-w-[3ch]">{goal.progress_percent}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-[#0D0D0D] border-[#333333] text-white sm:max-w-[425px]">
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
                className="bg-[#111111] border-[#333333] text-white focus:border-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="What does success look like?"
                className="bg-[#111111] border-[#333333] text-white focus:border-white min-h-[100px]"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)} className="hover:bg-[#111] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-white text-black hover:bg-white/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-[#0D0D0D] border-[#333333] text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="bg-[#111111] border-[#333333] text-white focus:border-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="bg-[#111111] border-[#333333] text-white focus:border-white min-h-[100px]"
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
                  className="bg-[#111111] border-[#333333] text-white focus:border-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger className="bg-[#111111] border-[#333333] text-white focus:border-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D0D0D] border-[#333333] text-white">
                    <SelectItem value="active" className="hover:bg-[#111] focus:bg-[#111] focus:text-white">Active</SelectItem>
                    <SelectItem value="paused" className="hover:bg-[#111] focus:bg-[#111] focus:text-white">Paused</SelectItem>
                    <SelectItem value="completed" className="hover:bg-[#111] focus:bg-[#111] focus:text-white">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)} className="hover:bg-[#111] text-white hover:text-white">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-white text-black hover:bg-white/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
