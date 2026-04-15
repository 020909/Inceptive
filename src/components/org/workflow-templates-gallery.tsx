"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { trackClientEvent } from "@/lib/analytics";
import { useFuseSearch } from "@/hooks/useFuseSearch";
import { useAuth } from "@/lib/auth-context";
import type { WorkflowCategory, WorkflowTemplate, OrgWorkflowWithTemplate } from "@/lib/supabase/workflows-browser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWorkflowIcon } from "@/components/org/workflow-icons";

interface WorkflowTemplatesGalleryProps {
  orgId: string;
  orgSlug: string;
  templates: WorkflowTemplate[];
  initialActiveWorkflows: OrgWorkflowWithTemplate[];
}

const CATEGORY_LABELS: Array<{ value: "all" | WorkflowCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "research", label: "Research" },
  { value: "operations", label: "Operations" },
  { value: "content", label: "Content" },
];

export function WorkflowTemplatesGallery({
  orgId,
  orgSlug,
  templates,
  initialActiveWorkflows,
}: WorkflowTemplatesGalleryProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<"all" | WorkflowCategory>("all");
  const [activeWorkflows, setActiveWorkflows] = useState(initialActiveWorkflows);
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null);
  const { query, setQuery, results } = useFuseSearch(templates, ["name", "description", "category"]);

  const activeByTemplateId = useMemo(
    () => new Map(activeWorkflows.map((workflow) => [workflow.template_id, workflow])),
    [activeWorkflows]
  );

  const visibleTemplates = useMemo(() => {
    if (category === "all") return results;
    return results.filter((template) => template.category === category);
  }, [category, results]);

  const handleActivate = async (template: WorkflowTemplate) => {
    if (!user?.id) {
      toast.error("Please sign in to activate a workflow.");
      return;
    }

    setActivatingTemplateId(template.id);
    try {
      const response = await fetch("/api/org/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgId,
          templateId: template.id,
        }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json.error || "Failed to activate workflow.");
      }

      if (response.status === 202 || json.queued) {
        toast.success("Workflow activation submitted for admin approval.");
        return;
      }

      const activated = json.workflow as OrgWorkflowWithTemplate;

      setActiveWorkflows((current) => [
        {
          ...activated,
          template,
          last_run_at: null,
        },
        ...current,
      ]);

      trackClientEvent(orgId, user.id, "workflow_activated", {
        workflow_name: template.name,
        workflow_category: template.category,
      });

      toast.success("Workflow activated. Your AI agent will begin tonight.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to activate workflow.";
      toast.error(message);
    } finally {
      setActivatingTemplateId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="command-surface rounded-[32px] border border-[var(--border-default)] p-6">
        <div className="mb-5">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">Search Templates</p>
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
            <Search size={18} className="text-[var(--fg-muted)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by workflow name, description, or category..."
              className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <p className="mt-3 text-sm text-[var(--fg-muted)]">{visibleTemplates.length} results</p>
        </div>

        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">Category</p>
        <Tabs value={category} onValueChange={(value) => setCategory(value as "all" | WorkflowCategory)}>
          <TabsList>
            {CATEGORY_LABELS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {visibleTemplates.map((template) => {
          const Icon = getWorkflowIcon(template.icon);
          const activeWorkflow = activeByTemplateId.get(template.id);
          const isActivating = activatingTemplateId === template.id;

          return (
            <Card key={template.id} className="rounded-[32px]">
              <CardHeader className="gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                    <Icon size={26} className="text-[var(--fg-primary)]" />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline">{template.category}</Badge>
                    {template.estimated_time_saved ? (
                      <Badge variant="default">{template.estimated_time_saved}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{template.name}</CardTitle>
                  <CardDescription className="leading-6">{template.description}</CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">First Steps</p>
                  <ul className="space-y-2 text-sm text-[var(--fg-secondary)]">
                    {template.steps.slice(0, 2).map((step) => (
                      <li key={step.title} className="flex gap-2">
                        <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-[var(--fg-muted)]" />
                        <span>{step.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {activeWorkflow ? (
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="px-3 py-1 text-xs">
                      Active
                    </Badge>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-11 rounded-xl px-5"
                      render={<Link href={`/org/${orgSlug}/workflows/active`} />}
                    >
                      Configure
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="h-11 w-full rounded-xl"
                    disabled={isActivating}
                    onClick={() => handleActivate(template)}
                  >
                    {isActivating ? "Activating..." : "Activate"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visibleTemplates.length === 0 ? (
        <Card className="rounded-[32px]">
          <CardContent className="p-6 text-sm text-[var(--fg-muted)]">
            No workflows matched your current search and category filter.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
