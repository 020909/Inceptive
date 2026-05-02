"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Briefcase,
  Calendar,
  User,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────

type CaseType = "kyb_review" | "sar_draft" | "vendor_review" | "aml_triage" | "reconciliation";
type CasePriority = "low" | "normal" | "high" | "urgent";

interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CASE_TYPE_OPTIONS: { value: CaseType; label: string }[] = [
  { value: "kyb_review", label: "KYB Review" },
  { value: "sar_draft", label: "SAR Draft" },
  { value: "vendor_review", label: "Vendor Review" },
  { value: "aml_triage", label: "AML Triage" },
  { value: "reconciliation", label: "Reconciliation" },
];

const PRIORITY_OPTIONS: { value: CasePriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface CreateCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (caseId: string) => void;
}

export function CreateCaseModal({
  isOpen,
  onClose,
  onCaseCreated,
}: CreateCaseModalProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [caseType, setCaseType] = useState<CaseType>("kyb_review");
  const [priority, setPriority] = useState<CasePriority>("normal");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    if (!user?.id || !isOpen) return;
    setLoadingMembers(true);
    const supabase = createClient();
    try {
      // Get user's tenant_id first
      const { data: currentUser, error: userError } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (userError || !currentUser?.tenant_id) {
        console.error("Error fetching user tenant:", userError);
        setLoadingMembers(false);
        return;
      }

      // Fetch team members from the same tenant
      const { data: members, error: membersError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("tenant_id", currentUser.tenant_id)
        .neq("id", user.id);

      if (membersError) {
        console.error("Error fetching team members:", membersError);
      } else {
        setTeamMembers((members || []).map((m: any) => ({
          user_id: m.id,
          full_name: m.full_name,
          email: m.email,
          role: m.role,
        })));
      }
    } catch (err) {
      console.error("Error fetching team members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (isOpen) {
      void fetchTeamMembers();
    }
  }, [isOpen, fetchTeamMembers]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setCaseType("kyb_review");
      setPriority("normal");
      setDescription("");
      setAssignedTo("");
      setDueDate("");
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!title.trim()) {
      errors.title = "Title is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !user?.id) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          case_type: caseType,
          priority,
          description: description.trim() || null,
          assigned_to: assignedTo || null,
          due_date: dueDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create case");
      }

      const data = await response.json();
      // Onboarding: mark first case created
      try {
        localStorage.setItem("inceptive:onboarding:created_case", "true");
      } catch {
        // ignore
      }
      onCaseCreated(data.case.id);
    } catch (err) {
      console.error("Error creating case:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create case. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: CasePriority): string => {
    switch (priority) {
      case "low":
        return "bg-slate-400";
      case "normal":
        return "bg-blue-400";
      case "high":
        return "bg-orange-500";
      case "urgent":
        return "bg-red-500";
      default:
        return "bg-slate-400";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-[var(--fg-primary)]">
                Create New Case
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--fg-muted)]">
                Start a new compliance case workflow.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Error Banner */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="text-sm font-medium text-[var(--fg-primary)]"
            >
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter case title"
              className={cn(
                "h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]",
                fieldErrors.title && "border-red-500"
              )}
            />
            {fieldErrors.title && (
              <p className="text-xs text-red-500">{fieldErrors.title}</p>
            )}
          </div>

          {/* Type and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Case Type */}
            <div className="space-y-2">
              <Label
                htmlFor="case_type"
                className="text-sm font-medium text-[var(--fg-primary)]"
              >
                Case Type
              </Label>
              <Select
                value={caseType}
                onValueChange={(v) => setCaseType(v as CaseType)}
              >
                <SelectTrigger className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label
                htmlFor="priority"
                className="text-sm font-medium text-[var(--fg-primary)]"
              >
                Priority
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as CasePriority)}
              >
                <SelectTrigger className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn("h-2 w-2 rounded-full", getPriorityColor(opt.value))}
                        />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-[var(--fg-primary)]"
            >
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter case description (optional)"
              rows={3}
              className="bg-[var(--bg-elevated)] border-[var(--border-default)] resize-none"
            />
          </div>

          {/* Assign To and Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assign To */}
            <div className="space-y-2">
              <Label
                htmlFor="assigned_to"
                className="text-sm font-medium text-[var(--fg-primary)]"
              >
                <div className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Assign To
                </div>
              </Label>
              <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v || "")}>
                <SelectTrigger className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {loadingMembers ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : (
                    teamMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        <div className="flex flex-col">
                          <span>{member.full_name || member.email}</span>
                          {member.full_name && (
                            <span className="text-xs text-[var(--fg-muted)]">
                              {member.email}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label
                htmlFor="due_date"
                className="text-sm font-medium text-[var(--fg-primary)]"
              >
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Due Date
                </div>
              </Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-10 bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Case
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
