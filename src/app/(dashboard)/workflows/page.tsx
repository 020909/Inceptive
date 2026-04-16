"use client";

import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Handle,
  Position,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Play,
  Save,
  Zap,
  Mail,
  Search,
  FileText,
  Globe,
  MessageSquare,
  GitBranch,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type WorkflowNodeData = {
  label: string;
  description?: string;
  icon?: string;
};

type LibraryNodeType = "trigger" | "agent" | "action";

type LibraryItem = {
  label: string;
  description: string;
  type: LibraryNodeType;
  icon?: string;
  iconComponent: React.ComponentType<{ size?: number; className?: string }>;
};

type FlowViewportApi = {
  screenToFlowPosition: (clientPosition: { x: number; y: number }) => { x: number; y: number };
};

type PanelPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center-left"
  | "center-right";

const handleStyle = {
  background: "var(--accent)",
  width: 10,
  height: 10,
  border: "2px solid var(--bg-surface)",
};

const iconMap = {
  search: Search,
  sparkles: Sparkles,
  mail: Mail,
  zap: Zap,
  file: FileText,
  globe: Globe,
  message: MessageSquare,
  clock: Clock,
  check: CheckCircle2,
};

function Panel({
  position = "top-left",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { position?: PanelPosition }) {
  return (
    <div
      className={["react-flow__panel", ...position.split("-"), className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

function TriggerNode({ data }: NodeProps) {
  const nodeData = data as WorkflowNodeData;

  return (
    <div
      className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 min-w-[180px] shadow-lg cursor-pointer hover:border-[var(--border-strong)] transition-all duration-200"
      style={{ borderLeft: "4px solid var(--accent)" }}
    >
      <div className="mb-3 inline-flex rounded-full bg-[rgba(245,165,36,0.14)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
        Trigger
      </div>
      <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{nodeData.label}</h3>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">Starts the workflow</p>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

function AgentNode({ data }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const Icon = nodeData.icon ? iconMap[nodeData.icon as keyof typeof iconMap] ?? Sparkles : Sparkles;

  return (
    <div
      className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 min-w-[200px] shadow-lg cursor-pointer hover:border-[var(--border-strong)] transition-all duration-200"
      style={{ borderLeft: "4px solid rgba(255,255,255,0.4)" }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-[rgba(59,130,246,0.15)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7cb7ff]">
          Agent
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]">
          <Icon size={16} />
        </span>
      </div>
      <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{nodeData.label}</h3>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">{nodeData.description}</p>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

function ActionNode({ data }: NodeProps) {
  const nodeData = data as WorkflowNodeData;

  return (
    <div
      className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 min-w-[180px] shadow-lg cursor-pointer hover:border-[var(--border-strong)] transition-all duration-200"
      style={{ borderLeft: "4px solid var(--success)" }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div className="mb-3 inline-flex rounded-full bg-[rgba(52,199,89,0.14)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--success)]">
        Action
      </div>
      <h3 className="text-sm font-semibold text-[var(--fg-primary)]">{nodeData.label}</h3>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">Delivers output</p>
    </div>
  );
}

const nodeTypes = { trigger: TriggerNode, agent: AgentNode, action: ActionNode };

const initialNodes: Node[] = [
  {
    id: "1",
    type: "trigger",
    position: { x: 80, y: 200 },
    data: { label: "Email Received", description: "New email in Gmail inbox" },
  },
  {
    id: "2",
    type: "agent",
    position: { x: 340, y: 120 },
    data: { label: "Research Agent", description: "Enriches sender with web research", icon: "search" },
  },
  {
    id: "3",
    type: "agent",
    position: { x: 340, y: 300 },
    data: { label: "Summarize Agent", description: "Extracts key asks and tone", icon: "sparkles" },
  },
  {
    id: "4",
    type: "agent",
    position: { x: 600, y: 200 },
    data: { label: "Draft Reply Agent", description: "Writes reply in your voice", icon: "mail" },
  },
  {
    id: "5",
    type: "action",
    position: { x: 860, y: 200 },
    data: { label: "Send for Approval", description: "Routes to human review queue" },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true, style: { stroke: "var(--accent)", strokeWidth: 2 } },
  { id: "e1-3", source: "1", target: "3", animated: true, style: { stroke: "var(--accent)", strokeWidth: 2 } },
  { id: "e2-4", source: "2", target: "4", animated: true, style: { stroke: "var(--fg-muted)", strokeWidth: 1.5 } },
  { id: "e3-4", source: "3", target: "4", animated: true, style: { stroke: "var(--fg-muted)", strokeWidth: 1.5 } },
  { id: "e4-5", source: "4", target: "5", animated: true, style: { stroke: "var(--success)", strokeWidth: 2 } },
];

const triggerLibrary: LibraryItem[] = [
  { label: "Email Received", description: "Starts when a new email arrives", type: "trigger", iconComponent: Mail },
  { label: "Schedule", description: "Runs on a recurring cron schedule", type: "trigger", iconComponent: Clock },
  { label: "Webhook", description: "Starts from an external system event", type: "trigger", iconComponent: Zap },
  { label: "File Upload", description: "Starts when a file lands in storage", type: "trigger", iconComponent: FileText },
];

const agentLibrary: LibraryItem[] = [
  { label: "Research", description: "Finds context and supporting facts", type: "agent", icon: "search", iconComponent: Search },
  { label: "Summarize", description: "Condenses long inputs into decisions", type: "agent", icon: "sparkles", iconComponent: Sparkles },
  { label: "Draft Email", description: "Writes human-quality replies", type: "agent", icon: "mail", iconComponent: Mail },
  { label: "Analyze Data", description: "Interprets trends and anomalies", type: "agent", icon: "file", iconComponent: FileText },
  { label: "Search Web", description: "Finds fresh public information", type: "agent", icon: "globe", iconComponent: Globe },
  { label: "Code Runner", description: "Executes deterministic code tasks", type: "agent", icon: "message", iconComponent: MessageSquare },
];

const actionLibrary: LibraryItem[] = [
  { label: "Send Email", description: "Delivers an outbound email", type: "action", iconComponent: Mail },
  { label: "Send Slack Message", description: "Pushes the result to Slack", type: "action", iconComponent: MessageSquare },
  { label: "Save to Report", description: "Stores the output in reports", type: "action", iconComponent: FileText },
  { label: "Human Approval", description: "Routes to a review queue", type: "action", iconComponent: CheckCircle2 },
  { label: "Export PDF", description: "Creates a portable deliverable", type: "action", iconComponent: FileText },
];

function LibrarySection({
  title,
  items,
  onAdd,
}: {
  title: string;
  items: LibraryItem[];
  onAdd: (item: LibraryItem) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-muted)]">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.iconComponent;

          return (
            <motion.button
              key={`${title}-${item.label}`}
              type="button"
              onClick={() => onAdd(item)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 text-left transition-all duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--fg-primary)]">
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--fg-primary)]">{item.label}</p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">{item.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlow, setReactFlow] = useState<FlowViewportApi | null>(null);
  const [canvasWrapper, setCanvasWrapper] = useState<HTMLDivElement | null>(null);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((currentEdges) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "var(--accent)", strokeWidth: 2 },
          },
          currentEdges,
        ),
      ),
    [setEdges],
  );

  const addNode = useCallback(
    (item: LibraryItem) => {
      if (!reactFlow) return;

      const bounds = canvasWrapper?.getBoundingClientRect();
      const centerX = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
      const centerY = bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2;
      const flowPosition = reactFlow.screenToFlowPosition({ x: centerX, y: centerY });

      setNodes((currentNodes) => {
        const nextIndex = currentNodes.length + 1;
        const nextId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `node-${Date.now()}-${nextIndex}`;

        return [
          ...currentNodes,
          {
            id: nextId,
            type: item.type,
            position: {
              x: flowPosition.x - 100,
              y: flowPosition.y - 40 + ((nextIndex % 4) - 1.5) * 36,
            },
            data: {
              label: item.label,
              description: item.description,
              icon: item.icon,
            },
          },
        ];
      });
    },
    [canvasWrapper, reactFlow, setNodes],
  );

  const handleRunWorkflow = useCallback(() => {
    toast.success("Workflow queued — 5 agents running");
  }, []);

  const handleSaveWorkflow = useCallback(() => {
    toast.success("Workflow saved");
  }, []);

  const handleNewWorkflow = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    toast.success("New workflow ready");
  }, [setEdges, setNodes]);

  const rfStyle = { background: "var(--bg-base)" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="flex flex-col h-screen overflow-hidden"
    >
      <div ref={setCanvasWrapper} className="min-h-0 flex-1 bg-[var(--bg-base)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlow}
          fitView
          style={rfStyle}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "var(--accent)", strokeWidth: 2 },
          }}
        >
          <Panel position="center-left" className="ml-4">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08, duration: 0.2 }}
              className="pointer-events-auto w-[300px] max-h-[calc(100vh-4rem)] overflow-y-auto no-scrollbar rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)]/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur"
            >
              <div className="mb-5">
                <p className="text-sm font-semibold text-[var(--fg-primary)]">Node Library</p>
              </div>

              <div className="space-y-5">
                <LibrarySection title="Triggers" items={triggerLibrary} onAdd={addNode} />
                <LibrarySection title="Agents" items={agentLibrary} onAdd={addNode} />
                <LibrarySection title="Actions" items={actionLibrary} onAdd={addNode} />
              </div>
            </motion.div>
          </Panel>

          <Panel position="top-right" className="mr-4 mt-4">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.2 }}
              className="pointer-events-auto flex items-center gap-2"
            >
              <button
                type="button"
                onClick={handleRunWorkflow}
                className="bg-[var(--accent)] text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-2"
              >
                <Play size={15} />
                Run Workflow
              </button>
              <button
                type="button"
                onClick={handleSaveWorkflow}
                className="border border-[var(--border-default)] bg-[var(--bg-surface)] rounded-xl px-4 py-2 text-sm flex items-center gap-2 text-[var(--fg-primary)]"
              >
                <Save size={15} />
                Save
              </button>
              <button
                type="button"
                onClick={handleNewWorkflow}
                className="border border-[var(--border-default)] bg-[var(--bg-surface)] rounded-xl px-4 py-2 text-sm flex items-center gap-2 text-[var(--fg-primary)]"
              >
                <Plus size={15} />
                New Workflow
              </button>
            </motion.div>
          </Panel>

          <MiniMap
            position="bottom-right"
            maskColor="rgba(0,0,0,0.3)"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
            }}
          />
          <Controls
            position="bottom-right"
            orientation="horizontal"
            style={{
              marginBottom: "175px",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          />
          <Background
            variant="dots"
            color="var(--border-subtle)"
            gap={20}
            size={1}
          />
        </ReactFlow>
      </div>
      <style jsx global>{`
        .react-flow__controls {
          background: var(--bg-surface);
        }

        .react-flow__controls-button {
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-default);
        }

        .react-flow__controls-button svg {
          fill: var(--fg-primary);
          stroke: var(--fg-primary);
        }

        .react-flow__attribution {
          display: none !important;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  );
}
