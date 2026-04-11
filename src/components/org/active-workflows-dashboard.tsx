"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PauseCircle, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  updateWorkflowStatus,
  type OrgWorkflowStatus,
  type OrgWorkflowWithTemplate,
} from "@/lib/supabase/workflows-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkflowIcon } from "@/components/org/workflow-icons";

interface ActiveWorkflowsDashboardProps {
  orgSlug: string;
  initialWorkflows: OrgWorkflowWithTemplate[];
}

export function ActiveWorkflowsDashboard({
  orgSlug,
  initialWorkflows,
}: ActiveWorkflowsDashboardProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (workflowId: string, nextStatus: OrgWorkflowStatus) => {
    setUpdatingId(workflowId);
    try {
      const updated = await updateWorkflowStatus(workflowId, nextStatus, createClient());
      setWorkflows((current) =>
        current.map((workflow) =>
          workflow.id === workflowId ? { ...workflow, status: updated.status } : workflow
        )
      );
      toast.success(nextStatus === "paused" ? "Workflow paused." : "Workflow resumed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update workflow.";
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (workflows.length === 0) {
    return (
      <Card className="rounded-[32px]">
        <CardHeader>
          <CardTitle>No active workflows yet</CardTitle>
          <CardDescription>Activate a workflow template to start your first automation.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="h-11 rounded-xl px-5"
            render={<Link href={`/org/${orgSlug}/workflows`} />}
          >
            Browse Workflows
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      {workflows.map((workflow) => {
        const Icon = getWorkflowIcon(workflow.template.icon);
        const nextStatus = workflow.status === "active" ? "paused" : "active";
        const isUpdating = updatingId === workflow.id;

        return (
          <Card key={workflow.id} className="rounded-[32px]">
            <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                  <Icon size={26} className="text-[var(--fg-primary)]" />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-medium text-[var(--fg-primary)]">{workflow.template.name}</h2>
                    <Badge variant="outline">{workflow.status}</Badge>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-[var(--fg-secondary)]">
                    {workflow.template.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--fg-muted)]">
                    <span>
                      Activated {formatDistanceToNow(new Date(workflow.activated_at), { addSuffix: true })}
                    </span>
                    <span>
                      Last run:{" "}
                      {workflow.last_run_at
                        ? formatDistanceToNow(new Date(workflow.last_run_at), { addSuffix: true })
                        : "No workflow activity yet"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-xl px-5"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange(workflow.id, nextStatus)}
                >
                  {workflow.status === "active" ? <PauseCircle /> : <PlayCircle />}
                  {workflow.status === "active" ? "Pause" : "Resume"}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-11 rounded-xl px-5"
                  render={<Link href={`/org/${orgSlug}/activity?workflow=${workflow.template.slug}`} />}
                >
                  View Activity
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
