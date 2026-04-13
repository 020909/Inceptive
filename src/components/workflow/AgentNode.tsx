"use client";

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Clock,
  FileText,
  GitBranch,
  Globe,
  Mail,
  PenTool,
  Search,
  Timer,
  Users,
} from "lucide-react";
import { NODE_TYPES_CONFIG, type WorkflowNodeData } from "@/lib/workflow-nodes";
import { cn } from "@/lib/utils";

function WorkflowNodeIcon({ iconName }: { iconName: string }) {
  if (iconName === "Clock") return <Clock size={16} />;
  if (iconName === "Mail") return <Mail size={16} />;
  if (iconName === "Search") return <Search size={16} />;
  if (iconName === "Users") return <Users size={16} />;
  if (iconName === "Globe") return <Globe size={16} />;
  if (iconName === "PenTool") return <PenTool size={16} />;
  if (iconName === "FileText") return <FileText size={16} />;
  if (iconName === "GitBranch") return <GitBranch size={16} />;
  if (iconName === "Timer") return <Timer size={16} />;
  return <FileText size={16} />;
}

function BaseNode({
  data,
  selected,
  isTrigger = false,
}: {
  data: WorkflowNodeData;
  selected?: boolean;
  isTrigger?: boolean;
}) {
  const config = NODE_TYPES_CONFIG[data.typeKey];
  const configValues = Object.values(data.config ?? {})
    .flatMap((value) => {
      if (Array.isArray(value)) return value.map(String);
      if (value == null || value === "") return [];
      return [String(value)];
    })
    .slice(0, 2);

  return (
    <div
      className={cn(
        "w-[200px] rounded-[12px] border border-white/10 bg-[#111] p-[14px] shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all",
        selected && "border-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_10px_34px_rgba(255,255,255,0.08)]"
      )}
    >
      {!isTrigger ? (
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border !border-[var(--border-default)] !bg-[var(--bg-overlay)] opacity-0 transition-opacity group-hover:opacity-100"
      />
      ) : null}

      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--fg-primary)]">
          <WorkflowNodeIcon iconName={config.icon} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-bold text-[var(--fg-primary)]">{config.label}</p>
            {isTrigger ? <span className="text-xs text-[var(--fg-secondary)]">⚡</span> : null}
          </div>
        </div>
      </div>

      <div className="my-3 h-px bg-[var(--border-default)]" />

      <div className="min-h-[34px] text-[11px] leading-5 text-[var(--fg-secondary)]">
        {configValues.length > 0 ? (
          configValues.map((value) => (
            <p key={value} className="truncate">
              {value}
            </p>
          ))
        ) : (
          <p className="italic text-[var(--fg-muted)]">Click to configure</p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
        <span className={cn("inline-block size-2 rounded-full", data.configured ? "bg-emerald-400" : "bg-zinc-500")} />
        <span>{data.configured ? "configured" : "not configured"}</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border !border-[var(--border-default)] !bg-[var(--fg-primary)]"
      />
    </div>
  );
}

export function AgentNode(props: NodeProps) {
  return (
    <div className="group">
      <BaseNode data={props.data as WorkflowNodeData} selected={props.selected} />
    </div>
  );
}

export function TriggerNode(props: NodeProps) {
  return (
    <div className="group">
      <BaseNode data={props.data as WorkflowNodeData} selected={props.selected} isTrigger />
    </div>
  );
}
