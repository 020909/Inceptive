"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Download, ShieldAlert } from "lucide-react";

type NodeData = {
  label: string;
  sublabel?: string;
  kind: "company" | "person";
  sanctionsHit?: boolean;
};

type OwnershipTreeInput = {
  root: { id: string; kind: "company" | "person"; label: string; sublabel?: string; sanctionsHit?: boolean };
  nodes?: Array<{ id: string; kind: "company" | "person"; label: string; sublabel?: string; sanctionsHit?: boolean }>;
  links: Array<{ from: string; to: string; pct?: number }>;
};

function buildLayout(input: OwnershipTreeInput): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const all = new Map<string, OwnershipTreeInput["root"]>();
  all.set(input.root.id, input.root);
  for (const n of input.nodes ?? []) all.set(n.id, n as any);
  for (const l of input.links) {
    if (!all.has(l.from)) all.set(l.from, { id: l.from, kind: "company", label: l.from });
    if (!all.has(l.to)) all.set(l.to, { id: l.to, kind: "person", label: l.to });
  }

  const children = new Map<string, string[]>();
  for (const id of all.keys()) children.set(id, []);
  for (const l of input.links) children.get(l.from)?.push(l.to);

  const depth = new Map<string, number>();
  depth.set(input.root.id, 0);
  const q = [input.root.id];
  while (q.length) {
    const cur = q.shift()!;
    const d = depth.get(cur) ?? 0;
    for (const nxt of children.get(cur) ?? []) {
      if (!depth.has(nxt)) {
        depth.set(nxt, d + 1);
        q.push(nxt);
      }
    }
  }
  for (const id of all.keys()) if (!depth.has(id)) depth.set(id, 0);

  const levels = new Map<number, string[]>();
  for (const [id, d] of depth.entries()) {
    const arr = levels.get(d) ?? [];
    arr.push(id);
    levels.set(d, arr);
  }
  for (const arr of levels.values()) arr.sort();

  const xGap = 240;
  const yGap = 140;
  const nodeW = 190;

  const nodes: Node<NodeData>[] = [];
  for (const [d, ids] of [...levels.entries()].sort((a, b) => a[0] - b[0])) {
    const startX = -((ids.length * xGap) / 2) + xGap / 2;
    ids.forEach((id, idx) => {
      const n = all.get(id)!;
      nodes.push({
        id,
        type: "uboNode",
        position: { x: startX + idx * xGap - nodeW / 2, y: d * yGap },
        data: { label: n.label, sublabel: n.sublabel, kind: n.kind, sanctionsHit: n.sanctionsHit },
      });
    });
  }

  const edges: Edge[] = input.links.map((l, idx) => ({
    id: `e-${idx}-${l.from}-${l.to}`,
    source: l.from,
    target: l.to,
    label: l.pct !== undefined ? `${l.pct}%` : undefined,
    style: { stroke: "var(--border-strong)", strokeWidth: 1 },
    labelStyle: { fill: "var(--text-secondary)", fontSize: 11, fontFamily: "var(--font-mono)" },
    labelBgStyle: { fill: "var(--surface-container)" },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
  }));

  return { nodes, edges };
}

function UboNode({ data }: { data: NodeData }) {
  const radius = 6;
  const border = data.sanctionsHit ? "1px solid rgba(220, 38, 38, 0.45)" : "1px solid var(--border-subtle)";
  const bg = data.sanctionsHit ? "var(--signal-negative-bg)" : "var(--surface-container)";
  const titleColor = data.sanctionsHit ? "var(--signal-negative)" : "var(--text-primary)";

  return (
    <div style={{ border, borderRadius: radius, background: bg, padding: 10, width: 190 }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs label-caps" style={{ color: "var(--text-secondary)" }}>
            {data.kind === "company" ? "Company" : "Person"}
          </div>
          <div className="mt-1 text-sm font-semibold truncate" style={{ color: titleColor }}>
            {data.label}
          </div>
          {data.sublabel ? (
            <div className="mt-1 text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {data.sublabel}
            </div>
          ) : null}
        </div>
        {data.sanctionsHit ? (
          <div
            title="Sanctions hit"
            style={{
              border: "1px solid rgba(220, 38, 38, 0.35)",
              borderRadius: radius,
              padding: 6,
              color: "var(--signal-negative)",
              background: "rgba(220, 38, 38, 0.08)",
            }}
          >
            <ShieldAlert size={16} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportElementToPng(element: HTMLElement, filename: string) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(cloned)}</foreignObject>
  </svg>`;

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to render PNG"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.scale(2, 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--void") || "#040506";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(url);

  const pngBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  downloadBlob(pngBlob, filename);
}

function OwnershipTreeInner({ input }: { input: OwnershipTreeInput }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildLayout(input), [input]);
  const [nodes, , onNodesChange] = useNodesState<NodeData>(initialNodes as any);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges as any);

  const nodeTypes = useMemo(() => ({ uboNode: (props: any) => <UboNode data={props.data} /> }), []);

  const exportPng = useCallback(async () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const target = (wrapper.querySelector(".react-flow") as HTMLElement | null) ?? wrapper;
    await exportElementToPng(target, "ownership-tree.png");
  }, []);

  const fit = useCallback(() => {
    rfInstance?.fitView?.({ padding: 0.25, duration: 250 });
  }, [rfInstance]);

  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--surface-container)",
        overflow: "hidden",
        height: "100%",
        minHeight: 520,
      }}
      className="relative"
      ref={wrapperRef}
    >
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2" style={{ pointerEvents: "auto" }}>
        <button
          type="button"
          onClick={exportPng}
          className="focus-ring"
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            padding: "6px 10px",
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
          }}
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <Download size={14} />
            Export PNG
          </span>
        </button>

        <button
          type="button"
          onClick={fit}
          className="focus-ring"
          style={{
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            padding: "6px 10px",
            background: "transparent",
            color: "var(--text-primary)",
          }}
        >
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">Fit view</span>
        </button>
      </div>

      <ReactFlow
        nodes={nodes as any}
        edges={edges as any}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes as any}
        fitView
        onInit={setRfInstance}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true } as any}
        style={{ background: "var(--surface-primary)" }}
      >
        <Background color="var(--border-faint)" gap={18} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(n: any) => (n?.data?.sanctionsHit ? "rgba(220,38,38,0.9)" : "rgba(138,154,168,0.65)")}
          maskColor="rgba(0,0,0,0.25)"
        />
      </ReactFlow>
    </div>
  );
}

export function OwnershipTree({ data }: { data?: Partial<OwnershipTreeInput> | null }) {
  const normalized: OwnershipTreeInput = useMemo(() => {
    if (data?.root && Array.isArray(data?.links)) {
      return { root: data.root as any, links: data.links as any, nodes: (data.nodes as any) ?? [] };
    }
    return {
      root: { id: "co", kind: "company", label: "Acme Holdings Ltd", sublabel: "Root company" },
      nodes: [
        { id: "p1", kind: "person", label: "Jane Doe", sublabel: "Direct owner" },
        { id: "p2", kind: "person", label: "Ivan Petrov", sublabel: "Indirect owner", sanctionsHit: true },
        { id: "co2", kind: "company", label: "Cobalt Ventures", sublabel: "Intermediate entity" },
      ],
      links: [
        { from: "co", to: "p1", pct: 55 },
        { from: "co", to: "co2", pct: 45 },
        { from: "co2", to: "p2", pct: 100 },
      ],
    };
  }, [data]);

  return (
    <ReactFlowProvider>
      <OwnershipTreeInner input={normalized} />
    </ReactFlowProvider>
  );
}

