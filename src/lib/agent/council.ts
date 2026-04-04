/**
 * Council Engine — 10-Agent orchestration (OpenRouter only; per-role models in council-openrouter-router).
 */

import { generateText } from "ai";
import { buildModel } from "@/lib/ai-model";
import {
  getOpenRouterModelForCouncilRole,
  openRouterModelFallbackChain,
} from "@/lib/agent/council-openrouter-router";
import type {
  AgentContribution,
  CouncilAgent,
  CouncilStreamEvent,
} from "./council-types";
import { selectAgentsForTask } from "./council-types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableModelError(e: unknown): boolean {
  const msg = String((e as Error)?.message || e || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests") ||
    msg.includes("429") ||
    msg.includes("timeout") ||
    msg.includes("temporar") ||
    msg.includes("overload") ||
    msg.includes("capacity") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang up")
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(limit).fill(null).map(async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface CouncilRunOptions {
  task: string;
  openrouterKey: string;
  onAgentEvent?: (event: CouncilStreamEvent) => void;
  context?: string;
  styleMemory?: Record<string, string>;
}

export interface CouncilResult {
  contributions: AgentContribution[];
  synthesis: string;
  totalDurationMs: number;
  agentsUsed: string[];
  trustScore: number;
}

function calculateTrustScore(contributions: AgentContribution[]): number {
  const done = contributions.filter((c) => c.status === "done");
  if (done.length === 0) return 0;

  let score = 0;
  score += (done.length / contributions.length) * 40;

  const critic = contributions.find((c) => c.role === "critic" && c.status === "done");
  if (critic && critic.output.length > 100) score += 20;

  const tester = contributions.find((c) => c.role === "tester" && c.status === "done");
  if (tester && tester.output.length > 100) score += 15;

  const synth = contributions.find((c) => c.role === "orchestrator" && c.status === "done");
  if (synth && synth.output.length > 200) score += 15;

  const phase2Done = done.filter((c) => c.role !== "planner" && c.role !== "orchestrator");
  if (phase2Done.length >= 3) score += 10;

  return Math.min(100, Math.round(score));
}

function buildStyleContext(memory: Record<string, string>): string {
  if (!memory || Object.keys(memory).length === 0) return "";
  const lines = Object.entries(memory)
    .filter(([k]) => k.startsWith("global:"))
    .map(([k, v]) => `- ${k.replace("global:", "")}: ${v}`);
  if (lines.length === 0) return "";
  return `\n\n## User's Style Preferences (from memory)\n${lines.join("\n")}\nAlways respect these preferences when making design decisions.`;
}

async function runAgent(
  agent: CouncilAgent,
  prompt: string,
  openrouterKey: string,
  onEvent?: (event: CouncilStreamEvent) => void,
  styleContext?: string
): Promise<AgentContribution> {
  const start = Date.now();
  const contribution: AgentContribution = {
    role: agent.role,
    name: agent.name,
    status: "thinking",
    output: "",
    durationMs: 0,
  };

  onEvent?.({
    type: "council",
    agentRole: agent.role,
    agentName: agent.name,
    status: "thinking",
    phase: agent.phase,
  });

  const orKey = String(openrouterKey || "").trim();
  if (!orKey) {
    contribution.status = "error";
    contribution.output = "Error: OpenRouter API key missing (set OPENROUTER_KEY or OPENROUTER_API_KEY on the server).";
    contribution.durationMs = Date.now() - start;
    onEvent?.({
      type: "council",
      agentRole: agent.role,
      agentName: agent.name,
      status: "error",
      phase: agent.phase,
    });
    return contribution;
  }

  let system = agent.systemPrompt;
  if (
    styleContext &&
    (agent.role === "ux-designer" || agent.role === "visual-polish" || agent.role === "coder")
  ) {
    system += styleContext;
  }

  const maxTokens =
    agent.role === "orchestrator" ? 12_000 : agent.role === "coder" ? 8_000 : 5_000;

  const { label } = getOpenRouterModelForCouncilRole(agent.role);
  const chain = openRouterModelFallbackChain(agent.role);

  const runOnce = (model: ReturnType<typeof buildModel>) =>
    generateText({
      model,
      system,
      prompt,
      maxTokens,
    } as any);

  let lastErr: unknown = null;

  for (const modelId of chain) {
    const model = buildModel(orKey, "openrouter", modelId);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await runOnce(model);
        contribution.output = (result?.text as string) || "";
        contribution.status = "done";
        contribution.durationMs = Date.now() - start;

        onEvent?.({
          type: "council",
          agentRole: agent.role,
          agentName: agent.name,
          status: "done",
          phase: agent.phase,
          output: `${label} [${modelId}] ${contribution.output.slice(0, 280)}`,
        });
        return contribution;
      } catch (e) {
        lastErr = e;
        if (attempt < 3 && isRetriableModelError(e)) {
          const backoff = 900 * Math.pow(2, attempt) + Math.floor(Math.random() * 350);
          await sleep(backoff);
          continue;
        }
        break;
      }
    }
  }

  contribution.status = "error";
  contribution.output = `Error: ${String((lastErr as Error)?.message || lastErr)}`;
  contribution.durationMs = Date.now() - start;

  onEvent?.({
    type: "council",
    agentRole: agent.role,
    agentName: agent.name,
    status: "error",
    phase: agent.phase,
  });

  return contribution;
}

export async function runCouncil(options: CouncilRunOptions): Promise<CouncilResult> {
  const { task, openrouterKey, onAgentEvent, context, styleMemory } = options;
  const totalStart = Date.now();
  const styleContext = buildStyleContext(styleMemory || {});

  const selectedAgents = selectAgentsForTask(task);
  const contributions: AgentContribution[] = [];
  let accumulatedContext = "";

  if (context) {
    accumulatedContext = `\n\n## Project Context\n${context}`;
  }

  const phase1Agents = selectedAgents.filter((a) => a.phase === 1);
  for (const agent of phase1Agents) {
    const prompt = `## Task\n${task}${accumulatedContext}`;
    const result = await runAgent(agent, prompt, openrouterKey, onAgentEvent);
    contributions.push(result);
    if (result.status === "done") {
      accumulatedContext += `\n\n## ${agent.name} Output\n${result.output}`;
    }
  }

  const phase2Agents = selectedAgents.filter((a) => a.phase === 2);
  if (phase2Agents.length > 0) {
    const phase2Prompt = `## Task\n${task}${accumulatedContext}\n\nProvide your specialized analysis and output.`;
    const phase2Results = await mapWithConcurrency(phase2Agents, 1, (agent) =>
      runAgent(agent, phase2Prompt, openrouterKey, onAgentEvent, styleContext)
    );
    for (const result of phase2Results) {
      contributions.push(result);
      if (result.status === "done") {
        accumulatedContext += `\n\n## ${result.name} Output\n${result.output}`;
      }
    }
  }

  const phase3Agents = selectedAgents.filter((a) => a.phase === 3);
  if (phase3Agents.length > 0) {
    const phase3Prompt = `## Original Task\n${task}\n\n## All Agent Outputs So Far\n${accumulatedContext}\n\nReview the above outputs and provide your specialized analysis.`;
    const phase3Results = await mapWithConcurrency(phase3Agents, 1, (agent) =>
      runAgent(agent, phase3Prompt, openrouterKey, onAgentEvent, styleContext)
    );
    for (const result of phase3Results) {
      contributions.push(result);
      if (result.status === "done") {
        accumulatedContext += `\n\n## ${result.name} Output\n${result.output}`;
      }
    }
  }

  const orchestrator = selectedAgents.find((a) => a.role === "orchestrator");
  let synthesis = "";
  if (orchestrator) {
    const synthPrompt = `## Original Task\n${task}\n\n## Complete Council Deliberation\n${accumulatedContext}\n\nSynthesize the ultimate, production-ready output.`;
    const synthResult = await runAgent(orchestrator, synthPrompt, openrouterKey, onAgentEvent);
    contributions.push(synthResult);
    synthesis = synthResult.output;
  }

  const trustScore = calculateTrustScore(contributions);

  return {
    contributions,
    synthesis,
    totalDurationMs: Date.now() - totalStart,
    agentsUsed: selectedAgents.map((a) => a.name),
    trustScore,
  };
}
