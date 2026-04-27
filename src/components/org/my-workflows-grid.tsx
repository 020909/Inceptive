"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WorkflowCard = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused";
  last_run_at: string | null;
  nodes: unknown[] | null;
};

export function MyWorkflowsGrid({
  orgSlug,
  initialWorkflows,
}: {
  orgSlug: string;
  initialWorkflows: WorkflowCard[];
}) {
  const [workflows, setWorkflows] = useState(initialWorkflows);

  const toggleStatus = async (workflowId: string, currentStatus: WorkflowCard["status"]) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    const { error } = await createClient()
      .from("agent_workflows")
      .update({ status: nextStatus })
      .eq("id", workflowId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowId ? { ...workflow, status: nextStatus } : workflow
      )
    );
    toast.success(nextStatus === "active" ? "Workflow activated" : "Workflow paused");
  };

  if (workflows.length === 0) {
    return (
      <Card className="rounded-[32px]">
        <CardHeader>
          <CardTitle>No custom workflows yet</CardTitle>
          <CardDescription>Build your first visual workflow from scratch or start from a template.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="h-11 rounded-xl px-5">
            <Link href={`/org/${orgSlug}/workflows/builder`}>New Workflow</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {workflows.map((workflow) => (
        <Card key={workflow.id} className="rounded-[32px]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{workflow.name}</CardTitle>
                <CardDescription className="mt-2">
                  {Array.isArray(workflow.nodes) ? workflow.nodes.length : 0} agents
                </CardDescription>
              </div>
              <Badge variant="outline">{workflow.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[var(--fg-muted)]">
              Last run:{" "}
              {workflow.last_run_at
                ? formatDistanceToNow(new Date(workflow.last_run_at), { addSuffix: true })
                : "Never"}
            </p>
            <div className="flex flex-wrap gap-3">
<Button asChild variant="outline" size="lg" className="h-11 rounded-xl px-5">
              <Link href={`/org/${orgSlug}/workflows/builder?id=${workflow.id}`}>Edit</Link>
            </Button>
              <Button
                size="lg"
                className="h-11 rounded-xl px-5"
                onClick={() => toggleStatus(workflow.id, workflow.status)}
              >
                {workflow.status === "active" ? "Pause" : "Activate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
