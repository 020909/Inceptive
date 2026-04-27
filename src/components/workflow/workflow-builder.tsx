"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Clock,
  GitBranch,
  Globe,
  Mail,
  MoreHorizontal,
  PenTool,
  Search,
  Timer,
  Users,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import {
  NODE_GROUPS,
  NODE_TYPES_CONFIG,
  type WorkflowNodeData,
  type WorkflowNodeType,
} from "@/lib/workflow-nodes";
import { getWorkflowNodeIcon } from "@/components/workflow/workflow-icon";
import { AgentNode, TriggerNode } from "@/components/workflow/AgentNode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const nodeTypes: NodeTypes = {
  defaultAgent: AgentNode,
  triggerNode: TriggerNode,
};

type WorkflowStatus = "draft" | "active" | "paused";

type SavedWorkflow = {
  id: string;
  name: string;
  description: string | null;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  status: WorkflowStatus;
  last_run_at: string | null;
  created_at?: string;
  updated_at?: string;
};

type WorkflowBuilderProps = {
  orgId: string;
  orgSlug: string;
  initialWorkflow: SavedWorkflow | null;
};

const STARTER_TEMPLATES = [
  {
    title: "Overnight Sales Pipeline",
    description: "Find 20 leads, research them, send personalized outreach, report results",
    nodes: ["trigger", "lead_agent", "research_agent", "email_agent", "report_agent"] as WorkflowNodeType[],
  },
  {
    title: "Daily Intelligence Brief",
    description: "Research industry news and email you a morning brief",
    nodes: ["trigger", "research_agent", "content_agent", "email_agent"] as WorkflowNodeType[],
  },
  {
    title: "Inbox Autopilot",
    description: "Prioritize inbox, draft replies to important emails, archive the rest",
    nodes: ["trigger", "email_agent", "condition", "email_agent", "report_agent"] as WorkflowNodeType[],
  },
];

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  draft: "bg-zinc-500",
  active: "bg-emerald-400",
  paused: "bg-amber-400",
};

const FALLBACK_NODE_ICONS = {
  Clock,
  Mail,
  Search,
  Users,
  Globe,
  PenTool,
  FileText,
  GitBranch,
  Timer,
};

function createWorkflowNode(typeKey: WorkflowNodeType, index: number, x = 120, y = 140): Node<WorkflowNodeData> {
  const config = NODE_TYPES_CONFIG[typeKey];
  return {
    id: `${typeKey}-${crypto.randomUUID()}`,
    type: typeKey === "trigger" ? "triggerNode" : "defaultAgent",
    position: { x, y },
    data: {
      typeKey,
      label: config.label,
      description: config.description,
      configured: false,
      config: {},
    },
    draggable: true,
    selected: index === 0,
  };
}

function buildTemplateGraph(template: (typeof STARTER_TEMPLATES)[number]) {
  const nodes = template.nodes.map((typeKey, index) =>
    createWorkflowNode(typeKey, index, 120 + index * 250, 220)
  );

  const edges: Edge[] = nodes.slice(1).map((node, index) => ({
    id: `edge-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
    type: "smoothstep",
    animated: false,
    label: "→ passes data",
    style: { stroke: "rgba(255,255,255,0.2)", strokeWidth: 2 },
    labelStyle: { fill: "#d4d4d8", fontSize: 11 },
    labelBgStyle: { fill: "#18181b", fillOpacity: 1 },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
  }));

  return { nodes, edges };
}

function getNowIsoString() {
  return new Date().toISOString();
}

export function WorkflowBuilder({
  orgId,
  orgSlug,
  initialWorkflow,
}: WorkflowBuilderProps) {
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [workflowId, setWorkflowId] = useState(initialWorkflow?.id ?? null);
  const [workflowName, setWorkflowName] = useState(initialWorkflow?.name ?? "Untitled Workflow");
  const [workflowDescription, setWorkflowDescription] = useState(initialWorkflow?.description ?? "");
  const [status, setStatus] = useState<WorkflowStatus>(initialWorkflow?.status ?? "draft");
  const [editingName, setEditingName] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeData>(initialWorkflow?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow?.edges ?? []);

  const selectedNode = useMemo(
    () => nodes.find((node: Node<WorkflowNodeData>) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    setEdges((current: Edge[]) =>
      current.map((edge: Edge) => ({
        ...edge,
        animated: status === "active",
        type: "smoothstep",
        style: {
          stroke: "rgba(255,255,255,0.2)",
          strokeWidth: 2,
        },
        label: "→ passes data",
        labelStyle: { fill: "#d4d4d8", fontSize: 11 },
        labelBgStyle: { fill: "#18181b", fillOpacity: 1 },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 999,
      }))
    );
  }, [status, setEdges]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((current: Edge[]) =>
        addEdge(
          {
            ...connection,
            id: `edge-${connection.source}-${connection.target}-${crypto.randomUUID()}`,
            type: "smoothstep",
            animated: status === "active",
            label: "→ passes data",
            style: { stroke: "rgba(255,255,255,0.2)", strokeWidth: 2 },
            labelStyle: { fill: "#d4d4d8", fontSize: 11 },
            labelBgStyle: { fill: "#18181b", fillOpacity: 1 },
            labelBgPadding: [8, 4],
            labelBgBorderRadius: 999,
          },
          current
        )
      );
    },
    [setEdges, status]
  );

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData("application/inceptive-node", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const typeKey = event.dataTransfer.getData("application/inceptive-node") as WorkflowNodeType;
    if (!typeKey || !dropRef.current) return;

    const bounds = dropRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left - 100;
    const y = event.clientY - bounds.top - 40;

    setNodes((current: Node<WorkflowNodeData>[]) => [
      ...current,
      createWorkflowNode(typeKey, current.length, x, y),
    ]);
  };

  const saveWorkflow = async (nextStatus: WorkflowStatus = status) => {
    const payload = {
      id: workflowId ?? undefined,
      organization_id: orgId,
      name: workflowName.trim() || "Untitled Workflow",
      description: workflowDescription.trim() || null,
      nodes,
      edges,
      status: nextStatus,
      updated_at: getNowIsoString(),
      ...(workflowId ? {} : { created_by: null }),
    };

    const supabase = createClient();
    let query = supabase
      .from("agent_workflows")
      .upsert(payload, { onConflict: "id" })
      .select("id, name, description, nodes, edges, status, last_run_at, created_at, updated_at")
      .single();

    if (!workflowId) {
      query = supabase
        .from("agent_workflows")
        .insert({
          organization_id: orgId,
          name: workflowName.trim() || "Untitled Workflow",
          description: workflowDescription.trim() || null,
          nodes,
          edges,
          status: nextStatus,
        })
        .select("id, name, description, nodes, edges, status, last_run_at, created_at, updated_at")
        .single();
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    setWorkflowId(data.id);
    setStatus(data.status);
    toast.success(nextStatus === "active" ? "Workflow activated" : "Workflow saved");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", data.id);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleSave = (nextStatus?: WorkflowStatus) => {
    startTransition(async () => {
      try {
        await saveWorkflow(nextStatus ?? status);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save workflow.");
      }
    });
  };

  const handleDuplicate = () => {
    setWorkflowId(null);
    setWorkflowName(`${workflowName} Copy`);
    toast.success("Workflow duplicated in memory. Click Save to store it.");
  };

  const handleDelete = async () => {
    if (!workflowId) {
      setNodes([]);
      setEdges([]);
      toast.success("Draft cleared.");
      return;
    }

    const { error } = await createClient().from("agent_workflows").delete().eq("id", workflowId);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Workflow deleted.");
    if (typeof window !== "undefined") {
      window.location.href = `/org/${orgSlug}/workflows`;
    }
  };

  const applyTemplate = (template: (typeof STARTER_TEMPLATES)[number]) => {
    const graph = buildTemplateGraph(template);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setWorkflowName(template.title);
    setWorkflowDescription(template.description);
  };

  const updateNodeConfig = (config: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((current) =>
      current.map((node: Node<WorkflowNodeData>) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config,
                configured: Object.values(config).some((value) =>
                  Array.isArray(value) ? value.length > 0 : value !== "" && value != null
                ),
              },
            }
          : node
      )
    );
  };

  return (
    <div className="flex h-[calc(100vh-1.5rem)] overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-zinc-950 text-white">
      <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-zinc-950/90 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
<Button asChild variant="ghost" size="icon-sm">
              <Link href={`/org/${orgSlug}/workflows`}>
                <ArrowLeft />
              </Link>
            </Button>

          {editingName ? (
            <Input
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setEditingName(false);
              }}
              className="h-9 w-[260px] rounded-xl border-white/10 bg-zinc-900 text-white"
              autoFocus
            />
          ) : (
            <button type="button" onClick={() => setEditingName(true)} className="text-left">
              <p className="text-sm font-medium text-white">{workflowName}</p>
              <p className="text-xs text-zinc-500">Click to rename</p>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-zinc-300">
          <span className={cn("inline-block size-2 rounded-full", STATUS_STYLES[status])} />
          {status}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleSave()}>
            Save
          </Button>
          <Button size="sm" disabled={isPending} onClick={() => handleSave("active")}>
            Activate
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5">
              <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
              <DropdownMenuSeparator />
<DropdownMenuItem onClick={() => window.location.href = `/org/${orgSlug}/activity`}>
              View Run History
            </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <aside className="mt-14 flex w-[260px] shrink-0 flex-col border-r border-white/10 bg-zinc-950 p-4">
        <p className="mb-4 text-xs uppercase tracking-[0.18em] text-zinc-500">Add Nodes</p>
        <div className="space-y-6">
          {NODE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">{group.title}</p>
              <div className="space-y-2">
                {group.items.map((typeKey) => {
                  const config = NODE_TYPES_CONFIG[typeKey];
                  const Icon = getWorkflowNodeIcon(config.icon) ?? FALLBACK_NODE_ICONS.FileText;
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      draggable
                      onDragStart={(event) => handleDragStart(event, typeKey)}
                      onClick={() =>
                        setNodes((current) => [
                          ...current,
                          createWorkflowNode(typeKey, current.length, 180, 180 + current.length * 80),
                        ])
                      }
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 p-3 text-left transition-colors hover:bg-zinc-900"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-white">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-white">{config.label}</p>
                          <p className="mt-1 text-[11px] leading-4 text-zinc-500">{config.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div
        ref={dropRef}
        className="relative mt-14 flex-1 overflow-hidden"
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        {nodes.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-8">
            <div className="grid max-w-5xl gap-5 md:grid-cols-3">
              {STARTER_TEMPLATES.map((template) => (
                <Card
                  key={template.title}
                  className="cursor-pointer rounded-[28px] border-white/10 bg-zinc-900/85"
                  onClick={() => applyTemplate(template)}
                >
                  <CardHeader>
                    <CardTitle className="text-xl text-white">{template.title}</CardTitle>
                    <CardDescription className="text-zinc-400">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" className="rounded-xl">
                      Start Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_event: unknown, node: Node<WorkflowNodeData>) => setSelectedNodeId(node.id)}
            nodeTypes={nodeTypes}
            fitView
            className="[&_.react-flow__renderer]:bg-zinc-950"
          >
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={() => "#f4f4f5"}
              maskColor="rgba(0,0,0,0.3)"
              style={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.08)" }}
            />
            <Controls position="bottom-left" className="[&>button]:border-white/10 [&>button]:bg-zinc-900 [&>button]:text-zinc-200" />
            <Background color="#333333" gap={24} size={1} />
          </ReactFlow>
        </ReactFlowProvider>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #333 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            opacity: 0.22,
          }}
        />
      </div>

      <Sheet open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedNodeId(null)}>
        <SheetContent>
          {selectedNode ? (
            <NodeConfigurationPanel
              node={selectedNode}
              onSave={updateNodeConfig}
              description={workflowDescription}
              setDescription={setWorkflowDescription}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NodeConfigurationPanel({
  node,
  onSave,
  description,
  setDescription,
}: {
  node: Node<WorkflowNodeData>;
  onSave: (config: Record<string, unknown>) => void;
  description: string;
  setDescription: (value: string) => void;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>(node.data.config ?? {});

  useEffect(() => {
    setConfig(node.data.config ?? {});
  }, [node.id]);

  const setField = (key: string, value: unknown) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const renderFieldset = () => {
    switch (node.data.typeKey) {
      case "trigger":
        return (
            <FieldSelect
              label="Run schedule"
              value={(config.run_schedule as string) ?? ""}
              onChange={(value) => setField("run_schedule", value)}
              options={[...NODE_TYPES_CONFIG.trigger.options]}
            />
        );
      case "email_agent":
        return (
          <>
            <FieldSelect
              label="Action"
              value={(config.action as string) ?? ""}
              onChange={(value) => setField("action", value)}
              options={["Draft replies", "Send outreach", "Prioritize inbox", "Archive low priority"]}
            />
            <FieldInput
              label="Filter"
              value={(config.filter_by as string) ?? ""}
              onChange={(value) => setField("filter_by", value)}
              placeholder="Only emails matching..."
            />
          </>
        );
      case "research_agent":
        return (
          <>
            <FieldInput
              label="Topic"
              value={(config.topic as string) ?? ""}
              onChange={(value) => setField("topic", value)}
            />
            <FieldInput
              label="Number of sources"
              type="number"
              value={String((config.sources as number) ?? 10)}
              onChange={(value) => setField("sources", Number(value))}
            />
            <FieldSelect
              label="Output"
              value={(config.output_format as string) ?? ""}
              onChange={(value) => setField("output_format", value)}
              options={["Summary report", "Bullet points", "Full document"]}
            />
          </>
        );
      case "lead_agent":
        return (
          <>
            <FieldInput
              label="Industry"
              value={(config.industry as string) ?? ""}
              onChange={(value) => setField("industry", value)}
            />
            <FieldSelect
              label="Company size"
              value={(config.company_size as string) ?? ""}
              onChange={(value) => setField("company_size", value)}
              options={["1-10", "11-50", "51-200", "200+"]}
            />
            <FieldInput
              label="Location"
              value={(config.location as string) ?? ""}
              onChange={(value) => setField("location", value)}
            />
            <FieldInput
              label="Number of leads"
              type="number"
              value={String((config.count as number) ?? 20)}
              onChange={(value) => setField("count", Number(value))}
            />
          </>
        );
      case "browser_agent":
        return (
          <>
            <FieldTextarea
              label="Task description"
              value={(config.task as string) ?? ""}
              onChange={(value) => setField("task", value)}
            />
            <FieldInput
              label="Starting URL"
              value={(config.target_url as string) ?? ""}
              onChange={(value) => setField("target_url", value)}
            />
          </>
        );
      case "content_agent":
        return (
          <>
            <div className="space-y-2">
              <Label>Platform</Label>
              <div className="flex flex-wrap gap-2">
                {["LinkedIn", "Twitter", "Email", "Blog"].map((platform) => {
                  const selected = Array.isArray(config.platform) ? config.platform.includes(platform) : false;
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => {
                        const current = Array.isArray(config.platform) ? (config.platform as string[]) : [];
                        setField(
                          "platform",
                          selected ? current.filter((item) => item !== platform) : [...current, platform]
                        );
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        selected
                          ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]"
                          : "border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--fg-tertiary)]"
                      )}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
            </div>
            <FieldSelect
              label="Tone"
              value={(config.tone as string) ?? ""}
              onChange={(value) => setField("tone", value)}
              options={["Professional", "Casual", "Bold", "Friendly"]}
            />
            <FieldInput
              label="Topic"
              value={(config.topic as string) ?? ""}
              onChange={(value) => setField("topic", value)}
            />
          </>
        );
      case "report_agent":
        return (
          <>
            <FieldInput
              label="Send to"
              type="email"
              value={(config.send_to as string) ?? ""}
              onChange={(value) => setField("send_to", value)}
            />
            <FieldSelect
              label="Format"
              value={(config.format as string) ?? ""}
              onChange={(value) => setField("format", value)}
              options={["Email digest", "Slack message", "PDF attachment"]}
            />
          </>
        );
      case "condition":
        return (
          <>
            <FieldInput
              label="Condition type"
              value={(config.condition_type as string) ?? ""}
              onChange={(value) => setField("condition_type", value)}
            />
            <FieldSelect
              label="Operator"
              value={(config.operator as string) ?? ""}
              onChange={(value) => setField("operator", value)}
              options={["equals", "contains", "greater_than", "less_than"]}
            />
            <FieldInput
              label="Value"
              value={(config.value as string) ?? ""}
              onChange={(value) => setField("value", value)}
            />
          </>
        );
      case "wait":
        return (
          <>
            <FieldInput
              label="Duration"
              type="number"
              value={String((config.duration as number) ?? 1)}
              onChange={(value) => setField("duration", Number(value))}
            />
            <FieldSelect
              label="Unit"
              value={(config.unit as string) ?? ""}
              onChange={(value) => setField("unit", value)}
              options={["minutes", "hours", "days"]}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{node.data.label}</SheetTitle>
        <SheetDescription>{node.data.description}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-auto p-5">
        {renderFieldset()}
        <FieldTextarea
          label="Workflow notes"
          value={description}
          onChange={setDescription}
        />
      </div>

      <div className="border-t border-[var(--border-subtle)] p-5">
        <Button className="w-full rounded-xl" onClick={() => onSave(config)}>
          Save Node
        </Button>
      </div>
    </>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border-[var(--border-default)] bg-[var(--bg-elevated)]"
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 rounded-xl border-[var(--border-default)] bg-[var(--bg-elevated)]"
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "")}>
        <SelectTrigger className="h-10 w-full rounded-xl border-[var(--border-default)] bg-[var(--bg-elevated)]">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
