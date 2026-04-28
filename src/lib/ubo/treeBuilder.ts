import "server-only";

import type { UboExtractionResult } from "@/types/compliance";

export type ReactFlowNode = {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
};

export type ReactFlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: Record<string, unknown>;
};

export type OwnershipTreeBuildResult = {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  effectiveOwnership: Record<string, number>;
  uboOver25: Array<{ person_name: string; effective_ownership: number; paths: string[] }>;
  circular: Array<{ cycle: string[] }>;
};

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function makeId(prefix: string, name: string) {
  return `${prefix}:${normName(name)}`;
}

export function buildOwnershipTree(extraction: UboExtractionResult): OwnershipTreeBuildResult {
  const companies = extraction.companies || [];
  const persons = extraction.persons || [];
  const rels = extraction.ownership_relationships || [];

  const companyIds = new Map<string, string>();
  const personIds = new Map<string, string>();

  for (const c of companies) companyIds.set(normName(c.name), makeId("company", c.name));
  for (const p of persons) personIds.set(normName(p.full_name), makeId("person", p.full_name));

  const nodes: ReactFlowNode[] = [];
  const edges: ReactFlowEdge[] = [];

  const ensureCompanyNode = (name: string) => {
    const key = normName(name);
    const id = companyIds.get(key) || makeId("company", name);
    if (!companyIds.has(key)) companyIds.set(key, id);
    if (!nodes.some((n) => n.id === id)) {
      nodes.push({
        id,
        type: "company",
        data: { label: name, kind: "company" },
        position: { x: 0, y: 0 },
      });
    }
    return id;
  };

  const ensurePersonNode = (fullName: string) => {
    const key = normName(fullName);
    const id = personIds.get(key) || makeId("person", fullName);
    if (!personIds.has(key)) personIds.set(key, id);
    if (!nodes.some((n) => n.id === id)) {
      nodes.push({
        id,
        type: "person",
        data: { label: fullName, kind: "person" },
        position: { x: 0, y: 0 },
      });
    }
    return id;
  };

  // Create nodes for all known entities
  for (const c of companies) ensureCompanyNode(c.name);
  for (const p of persons) ensurePersonNode(p.full_name);

  // Build adjacency list from relationships: parent -> child (ownership edge)
  const adj = new Map<string, Array<{ to: string; pct: number | null; label: string }>>();
  const rev = new Map<string, Array<{ from: string; pct: number | null }>>();

  for (const r of rels) {
    const parentCompanyId = companyIds.get(normName(r.parent_name));
    const parentId = parentCompanyId || (personIds.get(normName(r.parent_name)) ?? ensureCompanyNode(r.parent_name));
    const childCompanyId = companyIds.get(normName(r.child_name));
    const childId = childCompanyId || (personIds.get(normName(r.child_name)) ?? ensurePersonNode(r.child_name));

    const pct = r.ownership_percentage ?? null;
    const label = pct == null ? r.relationship_type : `${r.relationship_type} ${pct}%`;

    if (!adj.has(parentId)) adj.set(parentId, []);
    adj.get(parentId)!.push({ to: childId, pct, label });

    if (!rev.has(childId)) rev.set(childId, []);
    rev.get(childId)!.push({ from: parentId, pct });

    edges.push({
      id: `edge:${parentId}->${childId}:${edges.length}`,
      source: parentId,
      target: childId,
      label,
      data: { ownership_percentage: pct, relationship_type: r.relationship_type },
    });
  }

  // Identify a root company: a company that is never a child, else the first company
  const companyNodeIds = [...companyIds.values()];
  const childSet = new Set<string>();
  for (const children of adj.values()) for (const c of children) childSet.add(c.to);
  const root =
    companyNodeIds.find((id) => !childSet.has(id)) ||
    companyNodeIds[0] ||
    (companies[0] ? ensureCompanyNode(companies[0].name) : "company:root");

  if (!nodes.some((n) => n.id === root)) {
    nodes.push({
      id: root,
      type: "company",
      data: { label: companies[0]?.name || "Root", kind: "company" },
      position: { x: 0, y: 0 },
    });
  }

  // Circular detection (DFS on graph)
  const circular: Array<{ cycle: string[] }> = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const stack: string[] = [];
  const dfs = (node: string) => {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) circular.push({ cycle: stack.slice(idx).concat(node) });
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    visiting.add(node);
    stack.push(node);
    for (const e of adj.get(node) || []) dfs(e.to);
    stack.pop();
    visiting.delete(node);
  };

  dfs(root);

  // Effective ownership: enumerate paths from root to persons
  const effectiveOwnership: Record<string, number> = {};
  const pathsByPerson: Record<string, string[]> = {};

  const walk = (node: string, ownership: number, path: string[]) => {
    const children = adj.get(node) || [];
    if (children.length === 0) return;
    for (const c of children) {
      const pct = c.pct == null ? null : Number(c.pct);
      const nextOwnership = pct == null ? ownership : ownership * (pct / 100);
      const nextPath = path.concat(c.to);

      if (c.to.startsWith("person:")) {
        effectiveOwnership[c.to] = (effectiveOwnership[c.to] || 0) + nextOwnership;
        if (!pathsByPerson[c.to]) pathsByPerson[c.to] = [];
        pathsByPerson[c.to].push(nextPath.join(" -> "));
      }

      // Continue walking through intermediate companies even if pct is null (treat as pass-through)
      if (c.to.startsWith("company:")) walk(c.to, nextOwnership, nextPath);
    }
  };

  walk(root, 1, [root]);

  const uboOver25 = Object.entries(effectiveOwnership)
    .map(([personId, frac]) => ({
      person_name: personId.replace(/^person:/, "").replace(/_/g, " "),
      effective_ownership: Number((frac * 100).toFixed(2)),
      paths: pathsByPerson[personId] || [],
    }))
    .filter((p) => p.effective_ownership > 25);

  // Layout: simple layered positioning from root (BFS levels)
  const level = new Map<string, number>([[root, 0]]);
  const q: string[] = [root];
  while (q.length) {
    const cur = q.shift()!;
    const curLevel = level.get(cur)!;
    for (const c of adj.get(cur) || []) {
      if (!level.has(c.to)) {
        level.set(c.to, curLevel + 1);
        q.push(c.to);
      }
    }
  }

  const byLevel = new Map<number, string[]>();
  for (const n of nodes) {
    const l = level.get(n.id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(n.id);
  }

  for (const n of nodes) {
    const l = level.get(n.id) ?? 0;
    const ids = byLevel.get(l) || [];
    const idx = ids.indexOf(n.id);
    n.position = { x: l * 380, y: idx * 120 };
  }

  return { nodes, edges, effectiveOwnership, uboOver25, circular };
}

