/**
 * 10-Agent Council — per-role model routing.
 *
 * Primary path: **OpenRouter**.
 * Optional fallback: **Gemini** (Google AI Studio) when `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` is present.
 *
 * For website builds we keep the model surface intentionally small and stable:
 * OpenRouter Qwen (primary) → OpenRouter MiniMax M2 (fallback) → Gemini (fallback).
 *
 * Env overrides:
 * - COUNCIL_OPENROUTER_QWEN — primary OpenRouter slug (default `qwen/qwen3.6-plus:free`)
 * - COUNCIL_OPENROUTER_MINIMAX — fallback OpenRouter slug (default `minimax/minimax-m2`)
 * - COUNCIL_GEMINI_FALLBACK_MODEL — Gemini model id (default `gemini-2.0-flash`)
 */

import type { AgentRole } from "./council-types";

export type CouncilModelProvider = "openrouter" | "gemini";

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

export function defaultCouncilGeminiFallbackId(): string {
  return process.env.COUNCIL_GEMINI_FALLBACK_MODEL?.trim() || "gemini-2.0-flash";
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
  const gemini = defaultCouncilGeminiFallbackId();
  const or = (modelId: string, label: string): CouncilModelStep => ({
    provider: "openrouter",
    modelId,
    label,
  });
  const gm = (modelId: string, label: string): CouncilModelStep => ({
    provider: "gemini",
    modelId,
    label,
  });

  const seen = new Set<string>();
  const out: CouncilModelStep[] = [];

  // Keep routing stable across roles. Role-specific prompting already differentiates output.
  push(out, seen, or(qwen, "OpenRouter · Qwen"));
  push(out, seen, or(minimax, "OpenRouter · MiniMax fallback"));
  push(out, seen, gm(gemini, "Gemini fallback"));
  return out;
}

/** True if this chain can run with the keys available (at least one step usable). */
export function councilChainIsRunnable(
  chain: CouncilModelStep[],
  keys: { openrouterKey: string; geminiKey: string }
): boolean {
  const orK = String(keys.openrouterKey || "").trim();
  const gmK = String(keys.geminiKey || "").trim();
  return chain.some((s) => {
    if (s.provider === "openrouter") return !!orK;
    if (s.provider === "gemini") return !!gmK;
    return false;
  });
}
