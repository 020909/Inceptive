/**
 * Council Engine v2 — Enhanced 10-Agent orchestration with style memory.
 *
 * Key improvements over v1:
 *  - Style memory: loads user preferences and injects into UX/Visual agents
 *  - Smarter phase routing: complex tasks get more agents, simple ones skip review
 *  - Trust scoring: each contribution gets a 0-100 reliability score
 *  - Better error resilience: individual agent failures don't block the pipeline
 */

import { generateText } from "ai";
import { buildModel } from "@/lib/ai-model";
import type {
  AgentContribution,
  AgentRole,
  CouncilAgent,
  CouncilStreamEvent,
} from "./council-types";
import { selectAgentsForTask, getAgentsByPhase } from "./council-types";

const MODEL_IDS: Record<"qwen" | "minimax", string> = {
  qwen: "qwen/qwen-plus",
  minimax: "minimax/minimax-01",
};

interface CouncilRunOptions {
  task: string;
  openrouterKey: string;
  onAgentEvent?: (event: CouncilStreamEvent) => void;
  context?: string;
  /** Injected style preferences from Supabase */
  styleMemory?: Record<string, string>;
}

interface CouncilResult {
  contributions: AgentContribution[];
  synthesis: string;
  totalDurationMs: number;
  agentsUsed: string[];
  trustScore: number;
}

/** Calculate a basic trust score based on agent outputs */
function calculateTrustScore(contributions: AgentContribution[]): number {
  const done = contributions.filter((c) => c.status === "done");
  if (done.length === 0) return 0;

  let score = 0;
  // Base: % of agents that completed successfully
  score += (done.length / contributions.length) * 40;

  // Bonus: critic reviewed and found issues (means quality check happened)
  const critic = contributions.find((c) => c.role === "critic" && c.status === "done");
  if (critic && critic.output.length > 100) score += 20;

  // Bonus: tester provided test cases
  const tester = contributions.find((c) => c.role === "tester" && c.status === "done");
  if (tester && tester.output.length > 100) score += 15;

  // Bonus: orchestrator produced substantial synthesis
  const synth = contributions.find((c) => c.role === "orchestrator" && c.status === "done");
  if (synth && synth.output.length > 200) score += 15;

  // Bonus: multiple parallel agents contributed
  const phase2Done = done.filter((c) => c.role !== "planner" && c.role !== "orchestrator");
  if (phase2Done.length >= 3) score += 10;

  return Math.min(100, Math.round(score));
}

/** Build style memory context string for design-related agents */
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

  try {
    const modelId = MODEL_IDS[agent.model];
    const model = buildModel(openrouterKey, "openrouter", modelId);

    // Inject style memory for design agents
    let system = agent.systemPrompt;
    if (styleContext && (agent.role === "ux-designer" || agent.role === "visual-polish" || agent.role === "coder")) {
      system += styleContext;
    }

    const result = await generateText({
      model,
      system,
      prompt,
      maxTokens: 4000,
    } as any);

    contribution.output = result.text || "";
    contribution.status = "done";
    contribution.durationMs = Date.now() - start;

    onEvent?.({
      type: "council",
      agentRole: agent.role,
      agentName: agent.name,
      status: "done",
      phase: agent.phase,
      output: contribution.output.slice(0, 300),
    });
  } catch (err: any) {
    contribution.status = "error";
    contribution.output = `Error: ${err.message}`;
    contribution.durationMs = Date.now() - start;

    onEvent?.({
      type: "council",
      agentRole: agent.role,
      agentName: agent.name,
      status: "error",
      phase: agent.phase,
    });
  }

  return contribution;
}

/**
 * Run the full Council workflow with style memory and trust scoring.
 */
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

  // ── Phase 1: Planning ──
  const phase1Agents = selectedAgents.filter((a) => a.phase === 1);
  for (const agent of phase1Agents) {
    const prompt = `## Task\n${task}${accumulatedContext}`;
    const result = await runAgent(agent, prompt, openrouterKey, onAgentEvent);
    contributions.push(result);
    if (result.status === "done") {
      accumulatedContext += `\n\n## ${agent.name} Output\n${result.output}`;
    }
  }

  // ── Phase 2: Parallel Expertise ──
  const phase2Agents = selectedAgents.filter((a) => a.phase === 2);
  if (phase2Agents.length > 0) {
    const phase2Prompt = `## Task\n${task}${accumulatedContext}\n\nProvide your specialized analysis and output.`;
    const phase2Results = await Promise.all(
      phase2Agents.map((agent) =>
        runAgent(agent, phase2Prompt, openrouterKey, onAgentEvent, styleContext)
      )
    );
    for (const result of phase2Results) {
      contributions.push(result);
      if (result.status === "done") {
        accumulatedContext += `\n\n## ${result.name} Output\n${result.output}`;
      }
    }
  }

  // ── Phase 3: Review ──
  const phase3Agents = selectedAgents.filter((a) => a.phase === 3);
  if (phase3Agents.length > 0) {
    const phase3Prompt = `## Original Task\n${task}\n\n## All Agent Outputs So Far\n${accumulatedContext}\n\nReview the above outputs and provide your specialized analysis.`;
    const phase3Results = await Promise.all(
      phase3Agents.map((agent) =>
        runAgent(agent, phase3Prompt, openrouterKey, onAgentEvent, styleContext)
      )
    );
    for (const result of phase3Results) {
      contributions.push(result);
      if (result.status === "done") {
        accumulatedContext += `\n\n## ${result.name} Output\n${result.output}`;
      }
    }
  }

  // ── Phase 4: Synthesis (Orchestrator) ──
  const orchestrator = selectedAgents.find((a) => a.role === "orchestrator");
  let synthesis = "";
  if (orchestrator) {
    const synthPrompt = `## Original Task\n${task}\n\n## Complete Council Deliberation\n${accumulatedContext}\n\nSynthesize the ultimate, production-ready output.`;
    const synthResult = await runAgent(
      orchestrator,
      synthPrompt,
      openrouterKey,
      onAgentEvent
    );
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
