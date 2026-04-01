/**
 * Council Engine — Orchestrates the 10-agent debate workflow.
 *
 * Uses ONLY existing free models: Qwen 3.6 Plus Preview + Minimax M2.5
 * via OpenRouter. No paid APIs, no new dependencies.
 *
 * Flow:
 *   Phase 1: Planner creates execution plan
 *   Phase 2: Architect + Coder + contextual agents run in parallel
 *   Phase 3: Critic + Tester review in parallel
 *   Phase 4: Orchestrator synthesizes final output
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
  /** Callback emitting stream events as each agent progresses */
  onAgentEvent?: (event: CouncilStreamEvent) => void;
  /** Optional previous context (e.g. project file contents) */
  context?: string;
}

interface CouncilResult {
  contributions: AgentContribution[];
  synthesis: string;
  totalDurationMs: number;
  agentsUsed: string[];
}

/**
 * Run a single agent — call the LLM with the agent's persona.
 */
async function runAgent(
  agent: CouncilAgent,
  prompt: string,
  openrouterKey: string,
  onEvent?: (event: CouncilStreamEvent) => void
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

    const result = await generateText({
      model,
      system: agent.systemPrompt,
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
      output: contribution.output.slice(0, 200),
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
 * Run the full Council workflow.
 *
 * Phases execute sequentially, but agents within the same phase run in parallel.
 */
export async function runCouncil(options: CouncilRunOptions): Promise<CouncilResult> {
  const { task, openrouterKey, onAgentEvent, context } = options;
  const totalStart = Date.now();

  // Select which agents participate based on task content
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
        runAgent(agent, phase2Prompt, openrouterKey, onAgentEvent)
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
        runAgent(agent, phase3Prompt, openrouterKey, onAgentEvent)
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

  return {
    contributions,
    synthesis,
    totalDurationMs: Date.now() - totalStart,
    agentsUsed: selectedAgents.map((a) => a.name),
  };
}
