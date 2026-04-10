/**
 * 10-Agent Council — per-role model routing.
 *
 * Primary path: **OpenRouter**.
 * For website builds we keep the model surface intentionally small and stable:
 * Qwen (primary) → MiniMax M2 (fallback).
 *
 * Env overrides:
 * - COUNCIL_OPENROUTER_QWEN — primary OpenRouter slug (default `qwen/qwen3.6-plus:free`)
 * - COUNCIL_OPENROUTER_MINIMAX — fallback OpenRouter slug (default `minimax/minimax-m2`)
 */

import type { AgentRole } from "./council-types";

export type CouncilModelProvider = "openrouter";

export type CouncilModelStep = {
  provider: CouncilModelProvider;
  /** Gemini API model id or OpenRouter slug */
  modelId: string;
  label: string;
};

/** Heavy / coding agents — first choice on OpenRouter when a key is present. */
export function defaultCouncilOpenRouterQwenId(): string {
  return process.env.COUNCIL_OPENROUTER_QWEN?.trim() || "qwen/qwen3.6-plus:free";
}

export function defaultCouncilOpenRouterMiniMaxId(): string {
  return process.env.COUNCIL_OPENROUTER_MINIMAX?.trim() || "minimax/minimax-m2";
}

const push = (out: CouncilModelStep[], seen: Set<string>, step: CouncilModelStep) => {
  const k = `${step.provider}:${step.modelId}`;
  if (seen.has(k)) return;
  seen.add(k);
  out.push(step);
};

/**
 * Ordered attempts for one agent. Steps are skipped at runtime if the matching key is missing.
 */
export function getCouncilModelChain(role: AgentRole): CouncilModelStep[] {
  const qwen = defaultCouncilOpenRouterQwenId();
  const minimax = defaultCouncilOpenRouterMiniMaxId();
  const or = (modelId: string, label: string): CouncilModelStep => ({
    provider: "openrouter",
    modelId,
    label,
  });

  const seen = new Set<string>();
  const out: CouncilModelStep[] = [];

  // Keep routing stable across roles. Role-specific prompting already differentiates output.
  push(out, seen, or(qwen, "OpenRouter · Qwen"));
  push(out, seen, or(minimax, "OpenRouter · MiniMax fallback"));
  return out;
}

/** True if this chain can run with the keys available (at least one step usable). */
export function councilChainIsRunnable(
  chain: CouncilModelStep[],
  keys: { openrouterKey: string; geminiKey: string }
): boolean {
  const orK = String(keys.openrouterKey || "").trim();
  return chain.some((s) => {
    return !!orK;
  });
}
