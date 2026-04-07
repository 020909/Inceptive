"use client";

import { useState, useCallback, useRef } from "react";
import { AGENT_LABELS } from "@/lib/council/config";

export type AgentStatus = "waiting" | "running" | "done" | "error";

export interface AgentResult {
  agent: string;
  label: string;
  output: string;
  status: AgentStatus;
}

export interface CouncilState {
  sessionId: string | null;
  plan: string | null;
  chain: string[];
  agents: AgentResult[];
  currentAgent: string | null;
  finalOutput: string | null;
  status: "idle" | "running" | "done" | "error";
  error: string | null;
}

const initialState: CouncilState = {
  sessionId: null,
  plan: null,
  chain: [],
  agents: [],
  currentAgent: null,
  finalOutput: null,
  status: "idle",
  error: null,
};

export type CouncilStartResult =
  | { ok: true; finalOutput: string }
  | { ok: false; error: string };

export function useCouncil(getAccessToken: () => string | null | undefined) {
  const [state, setState] = useState<CouncilState>(initialState);
  const abortRef = useRef(false);

  const updateAgent = (agent: string, patch: Partial<AgentResult>) => {
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((a) => (a.agent === agent ? { ...a, ...patch } : a)),
    }));
  };

  const authHeaders = (): HeadersInit => {
    const t = getAccessToken();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  const startCouncil = useCallback(
    async (prompt: string): Promise<CouncilStartResult> => {
      abortRef.current = false;
      setState({ ...initialState, status: "running" });

      let sessionId: string;
      let chain: string[];
      let firstAgent: string;
      let plan: string;

      try {
        const res = await fetch("/api/council/start", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to start council");

        sessionId = data.session_id;
        chain = data.chain;
        firstAgent = data.first_agent;
        plan = data.plan;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, status: "error", error: msg }));
        return { ok: false, error: msg };
      }

      const initialAgents: AgentResult[] = chain.map((a) => ({
        agent: a,
        label: AGENT_LABELS[a] ?? a,
        output: "",
        status: "waiting" as AgentStatus,
      }));

      setState((prev) => ({
        ...prev,
        sessionId,
        plan,
        chain,
        currentAgent: firstAgent,
        agents: initialAgents,
      }));

      let nextAgent: string | null = firstAgent;
      let lastFinal: string | null = null;

      while (nextAgent !== null) {
        if (abortRef.current) {
          setState((prev) => ({ ...prev, status: "idle", error: "Cancelled", currentAgent: null }));
          return { ok: false, error: "Cancelled" };
        }

        const agentKey = nextAgent;
        updateAgent(agentKey, { status: "running" });
        setState((prev) => ({ ...prev, currentAgent: agentKey }));

        try {
          const agentRes = await fetch(`/api/council/${encodeURIComponent(agentKey)}`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ session_id: sessionId }),
          });
          const payload = (await agentRes.json()) as {
            output?: string;
            done?: boolean;
            next?: string | null;
            error?: string;
            detail?: string;
          };

          if (!agentRes.ok) {
            const detail =
              typeof payload.detail === "string" && payload.detail.trim()
                ? payload.detail.trim()
                : "";
            throw new Error(detail || payload.error || `Agent ${agentKey} failed`);
          }

          updateAgent(agentKey, { status: "done", output: payload.output ?? "" });

          if (payload.done) {
            lastFinal = payload.output ?? null;
            setState((prev) => ({
              ...prev,
              currentAgent: null,
              finalOutput: payload.output ?? null,
              status: "done",
            }));
            nextAgent = null;
          } else {
            nextAgent = payload.next ?? null;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          updateAgent(agentKey, { status: "error" });
          setState((prev) => ({
            ...prev,
            status: "error",
            error: `${agentKey} failed: ${msg}`,
            currentAgent: null,
          }));
          return { ok: false, error: msg };
        }
      }

      const out = lastFinal ?? "";
      return { ok: true, finalOutput: out };
    },
    [getAccessToken]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((prev) => ({
      ...prev,
      status: "idle",
      currentAgent: null,
      error: "Cancelled",
    }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState(initialState);
  }, []);

  return {
    ...state,
    startCouncil,
    cancel,
    reset,
  };
}
