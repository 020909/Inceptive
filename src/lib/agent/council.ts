/**
 * Council Engine — tiered agents (4 / 6 / 10 by plan). OpenRouter + Gemini fallbacks (see council-model-router).
 */

import { generateText } from "ai";
import { buildModel } from "@/lib/ai-model";
import {
  councilChainIsRunnable,
  getCouncilModelChain,
} from "@/lib/agent/council-model-router";
import type { PlanId } from "@/lib/stripe";
import type {
  AgentContribution,
  AgentRole,
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
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("cancel") ||
    msg.includes("temporar") ||
    msg.includes("overload") ||
    msg.includes("capacity") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("socket hang up")
  );
}

/** Huge accumulatedContext + task blows context windows and makes free models crawl; keep task + ends. */
function truncateCouncilPrompt(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt;
  const head = Math.floor(maxChars * 0.38);
  const tail = maxChars - head - 140;
  const omitted = prompt.length - head - tail;
  return `${prompt.slice(0, head)}\n\n[… ${omitted} characters omitted for speed — follow ## Task above and the tail below …]\n\n${prompt.slice(-Math.max(0, tail))}`;
}

function maxPromptCharsForRole(role: AgentRole): number {
  switch (role) {
    case "coder":
      return 32_000;
    case "orchestrator":
      return 40_000;
    case "critic":
    case "tester":
    case "visual-polish":
    case "deployer":
      return 28_000;
    default:
      return 48_000;
  }
}

/** Tighter caps on Free / Pro keep each Vercel segment under ~300s wall time. */
function generateTimeoutMsForRole(role: AgentRole, plan: PlanId = "unlimited"): number {
  const tier: "free" | "mid" | "full" =
    plan === "free" ? "free" : plan === "basic" || plan === "pro" ? "mid" : "full";
  switch (role) {
    case "coder":
      // Websites: give the coder most of the wall-time budget.
      if (tier === "free") return 210_000;
      if (tier === "mid") return 240_000;
      return 270_000;
    case "orchestrator":
      if (tier === "free") return 120_000;
      if (tier === "mid") return 180_000;
      return 240_000;
    default:
      // Keep planner / UX / architect fast so coder has time to implement within 300s.
      if (tier === "free") return 35_000;
      if (tier === "mid") return 55_000;
      return 75_000;
  }
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

/** Saved after a checkpoint (e.g. planner done); next invocation runs phase 2+. */
export type CouncilResumeState = {
  task: string;
  accumulatedContext: string;
  contributions: AgentContribution[];
};

const WEBSITE_COUNCIL_PHASE2_ROLES: AgentRole[] = [
  "ux-designer",
  "architect",
  "coder",
  "doc-specialist",
];
const WEBSITE_COUNCIL_PHASE3_ROLES: AgentRole[] = [
  "critic",
  "tester",
  "visual-polish",
  "deployer",
];

/**
 * Multi-request website builds: infer whether the next HTTP call should run phase 2 only or phase 3 + orchestrator only.
 */
export function inferWebsiteCouncilContinueStep(
  contributions: AgentContribution[]
): "run_phase2" | "run_phase3" | "invalid" {
  if (!contributions.length) return "invalid";
  const roles = new Set(contributions.map((c) => c.role));
  if (roles.has("orchestrator")) return "invalid";
  const hasPhase2 = WEBSITE_COUNCIL_PHASE2_ROLES.some((r) => roles.has(r));
  const hasPhase3 = WEBSITE_COUNCIL_PHASE3_ROLES.some((r) => roles.has(r));
  if (hasPhase2 && !hasPhase3) return "run_phase3";
  if (roles.has("planner") && !hasPhase2) return "run_phase2";
  return "invalid";
}

/** Validate client-supplied resume JSON (best-effort; same user session only). */
export function parseCouncilResumePayload(x: unknown): CouncilResumeState | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.task !== "string" || o.task.trim().length < 3) return null;
  if (typeof o.accumulatedContext !== "string") return null;
  if (!Array.isArray(o.contributions) || o.contributions.length === 0) return null;
  const contributions: AgentContribution[] = [];
  for (const raw of o.contributions) {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    if (typeof c.role !== "string" || typeof c.name !== "string") return null;
    if (typeof c.status !== "string" || typeof c.output !== "string") return null;
    contributions.push({
      role: c.role as AgentContribution["role"],
      name: c.name,
      status: c.status as AgentContribution["status"],
      output: c.output,
      durationMs: typeof c.durationMs === "number" ? c.durationMs : 0,
    });
  }
  return { task: o.task.trim(), accumulatedContext: o.accumulatedContext, contributions };
}

export type CouncilProviderKeys = {
  openrouterKey: string;
  geminiKey: string;
};

export interface CouncilRunOptions {
  task: string;
  openrouterKey: string;
  /** Google AI Studio / Gemini API — enables Gemma 4 31B for heavy agents */
  geminiKey?: string;
  onAgentEvent?: (event: CouncilStreamEvent) => void;
  context?: string;
  styleMemory?: Record<string, string>;
  /** Run phase 1 only, then return (multi-request / Vercel timeout workaround). */
  stopAfterPlanner?: boolean;
  /** After phase 2 (UX / architect / coder / docs), return — next request runs phase 3 + orchestrator. */
  stopAfterPhase2?: boolean;
  /** Continue from a prior checkpoint; skips phase 1. */
  resume?: CouncilResumeState;
  /** When resuming, last user message (theme / preferences) injected before phase 2. */
  userBridgingNote?: string;
  /** Multi-request: resume has phase 1+2 outputs; run only phase 3 agents + orchestrator. */
  phase3AndOrchestratorOnly?: boolean;
  /** Subscription tier — controls agent count and per-call timeouts. */
  plan?: PlanId;
}

export interface CouncilResult {
  contributions: AgentContribution[];
  synthesis: string;
  totalDurationMs: number;
  agentsUsed: string[];
  trustScore: number;
  /** Present when a multi-request checkpoint ended the run early (Vercel time limits). */
  checkpoint?: "after_planner" | "after_phase2";
  /** Internal context string to send back as `council_resume` (must match next `resume.accumulatedContext`). */
  accumulatedContextForResume?: string;
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
  keys: CouncilProviderKeys,
  onEvent?: (event: CouncilStreamEvent) => void,
  styleContext?: string,
  plan: PlanId = "unlimited"
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

  const orKey = String(keys.openrouterKey || "").trim();
  const geminiKey = String(keys.geminiKey || "").trim();
  const chain = getCouncilModelChain(agent.role);
  if (!councilChainIsRunnable(chain, { openrouterKey: orKey, geminiKey })) {
    contribution.status = "error";
    contribution.output =
      "Error: Council needs OpenRouter (OPENROUTER_KEY / OPENROUTER_API_KEY) and/or Google AI Studio (GEMINI_API_KEY / GOOGLE_AI_API_KEY). BYOK in Settings supports OpenRouter or Google.";
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

  const maxOutputTokens =
    agent.role === "orchestrator" ? 12_000 : agent.role === "coder" ? 6_000 : 5_000;

  const promptLimit = maxPromptCharsForRole(agent.role);
  const promptForModel = truncateCouncilPrompt(prompt, promptLimit);
  if (promptForModel.length < prompt.length) {
    console.warn(`[council] ${agent.role} prompt truncated`, { from: prompt.length, to: promptForModel.length });
  }
  const callTimeoutMs = generateTimeoutMsForRole(agent.role, plan);

  const runOnce = (model: ReturnType<typeof buildModel>) =>
    generateText({
      model,
      system,
      prompt: promptForModel,
      maxOutputTokens,
      maxRetries: 0,
      timeout: callTimeoutMs,
    });

  let lastErr: unknown = null;

  for (const step of chain) {
    if (!String(orKey).trim()) continue;
    const model = buildModel(orKey.trim(), "openrouter", step.modelId);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await runOnce(model);
        const text = ((result?.text as string) || "").trim();
        if (!text) {
          lastErr = new Error("Empty model response");
          if (attempt < 3) {
            await sleep(400 + Math.floor(Math.random() * 400));
            continue;
          }
          break;
        }
        contribution.output = text;
    contribution.status = "done";
    contribution.durationMs = Date.now() - start;

    onEvent?.({
      type: "council",
      agentRole: agent.role,
      agentName: agent.name,
      status: "done",
      phase: agent.phase,
          output: `${step.label} [${step.provider}:${step.modelId}] ${contribution.output.slice(0, 280)}`,
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
  const {
    task,
    openrouterKey,
    geminiKey: geminiKeyOpt,
    onAgentEvent,
    context,
    styleMemory,
    stopAfterPlanner,
    stopAfterPhase2,
    resume,
    userBridgingNote,
    phase3AndOrchestratorOnly,
    plan: planOpt,
  } = options;
  const plan: PlanId = planOpt ?? "unlimited";
  const keys: CouncilProviderKeys = {
    openrouterKey,
    geminiKey: String(geminiKeyOpt || "").trim(),
  };
  const totalStart = Date.now();
  const styleContext = buildStyleContext(styleMemory || {});

  const selectedAgents = selectAgentsForTask(task, plan);
  const contributions: AgentContribution[] = [];
  let accumulatedContext = "";

  if (resume && phase3AndOrchestratorOnly) {
    accumulatedContext = resume.accumulatedContext;
    contributions.push(...resume.contributions.map((c) => ({ ...c })));
    const note = String(userBridgingNote || "").trim();
    if (note) {
      accumulatedContext += `\n\n## User preferences (before design & code)\n${note}`;
    }
    const phase3Agents = selectedAgents.filter((a) => a.phase === 3);
    if (phase3Agents.length > 0) {
      const phase3Prompt = `## Original Task\n${task}\n\n## All Agent Outputs So Far\n${accumulatedContext}\n\nReview the above outputs and provide your specialized analysis.`;
      const phase3Results = await mapWithConcurrency(phase3Agents, 1, (agent) =>
        runAgent(agent, phase3Prompt, keys, onAgentEvent, styleContext, plan)
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
      const synthResult = await runAgent(orchestrator, synthPrompt, keys, onAgentEvent, undefined, plan);
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

  if (resume) {
    accumulatedContext = resume.accumulatedContext;
    contributions.push(...resume.contributions.map((c) => ({ ...c })));
    const note = String(userBridgingNote || "").trim();
    if (note) {
      accumulatedContext += `\n\n## User preferences (before design & code)\n${note}`;
    }
  } else {
  if (context) {
    accumulatedContext = `\n\n## Project Context\n${context}`;
  }

  const phase1Agents = selectedAgents.filter((a) => a.phase === 1);
  for (const agent of phase1Agents) {
    const prompt = `## Task\n${task}${accumulatedContext}`;
      const result = await runAgent(agent, prompt, keys, onAgentEvent, undefined, plan);
    contributions.push(result);
    if (result.status === "done") {
      accumulatedContext += `\n\n## ${agent.name} Output\n${result.output}`;
    }
  }

    if (stopAfterPlanner) {
      return {
        contributions,
        synthesis: "",
        totalDurationMs: Date.now() - totalStart,
        agentsUsed: selectedAgents.map((a) => a.name),
        trustScore: calculateTrustScore(contributions),
        checkpoint: "after_planner",
        accumulatedContextForResume: accumulatedContext,
      };
    }
  }

  const phase2Agents = selectedAgents.filter((a) => a.phase === 2);
  /** UX / Architect / Docs only need the task + planner (phase 1) context — run in parallel before Coder. */
  const phase2ParallelRoles = new Set<AgentRole>(["ux-designer", "architect", "doc-specialist"]);
  const phase2Parallel = phase2Agents.filter((a) => phase2ParallelRoles.has(a.role));
  const phase2After = phase2Agents.filter((a) => !phase2ParallelRoles.has(a.role));

  if (phase2Parallel.length > 0) {
    const phase2ParallelPrompt = `## Task\n${task}${accumulatedContext}\n\nProvide your specialized analysis and output.`;
    const parallelConcurrency = Math.min(3, phase2Parallel.length);
    const phase2ParallelResults = await mapWithConcurrency(
      phase2Parallel,
      parallelConcurrency,
      (agent) => runAgent(agent, phase2ParallelPrompt, keys, onAgentEvent, styleContext, plan)
    );
    for (const result of phase2ParallelResults) {
      contributions.push(result);
      if (result.status === "done") {
        accumulatedContext += `\n\n## ${result.name} Output\n${result.output}`;
      }
    }
  }

  if (phase2After.length > 0) {
    const phase2AfterPrompt = `## Task\n${task}${accumulatedContext}\n\nProvide your specialized analysis and output.`;
    const phase2AfterResults = await mapWithConcurrency(phase2After, 1, (agent) =>
      runAgent(agent, phase2AfterPrompt, keys, onAgentEvent, styleContext, plan)
    );
    for (const result of phase2AfterResults) {
      contributions.push(result);
      if (result.status === "done") {
        accumulatedContext += `\n\n## ${result.name} Output\n${result.output}`;
      }
    }
  }

  if (stopAfterPhase2) {
    return {
      contributions,
      synthesis: "",
      totalDurationMs: Date.now() - totalStart,
      agentsUsed: selectedAgents.map((a) => a.name),
      trustScore: calculateTrustScore(contributions),
      checkpoint: "after_phase2",
      accumulatedContextForResume: accumulatedContext,
    };
  }

  const phase3Agents = selectedAgents.filter((a) => a.phase === 3);
  if (phase3Agents.length > 0) {
    const phase3Prompt = `## Original Task\n${task}\n\n## All Agent Outputs So Far\n${accumulatedContext}\n\nReview the above outputs and provide your specialized analysis.`;
    const phase3Results = await mapWithConcurrency(phase3Agents, 1, (agent) =>
      runAgent(agent, phase3Prompt, keys, onAgentEvent, styleContext, plan)
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
    const synthResult = await runAgent(orchestrator, synthPrompt, keys, onAgentEvent, undefined, plan);
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
