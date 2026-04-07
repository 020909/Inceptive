/**
 * 10-Agent Council — per-role model routing.
 *
 * Primary path: **OpenRouter** (configure with COUNCIL_OPENROUTER_* env vars).
 * Fallbacks: Gemma 4 on **Gemini API**, then additional OpenRouter models.
 *
 * Env overrides:
 * - COUNCIL_OPENROUTER_HEAVY — coder / architect / orchestrator / … (default `qwen/qwen3.6-plus:free`)
 * - COUNCIL_OPENROUTER_LIGHT — planner / doc-specialist (default `google/gemma-3-12b-it:free`)
 * - COUNCIL_OPENROUTER_UI_FALLBACK — UX / visual roles (default `google/gemma-3-27b-it:free`)
 * - COUNCIL_OPENROUTER_QWEN_FALLBACK — second OpenRouter step if primary fails (default `openrouter/free`)
 * - COUNCIL_OPENROUTER_LIGHT_NANO — last planner fallback (default `google/gemma-3n-e4b-it:free`)
 * - COUNCIL_GEMMA4_GEMINI_MODEL — Gemini API id (default `gemma-4-31b-it`)
 */

import type { AgentRole } from "./council-types";

export type CouncilModelProvider = "gemini" | "openrouter";

export type CouncilModelStep = {
  provider: CouncilModelProvider;
  /** Gemini API model id or OpenRouter slug */
  modelId: string;
  label: string;
};

/** Heavy / coding agents — first choice on OpenRouter when a key is present. */
export function defaultCouncilOpenRouterHeavyId(): string {
  return (
    process.env.COUNCIL_OPENROUTER_HEAVY?.trim() ||
    "qwen/qwen3.6-plus:free"
  );
}

export function defaultGemma4GeminiModelId(): string {
  return process.env.COUNCIL_GEMMA4_GEMINI_MODEL?.trim() || "gemma-4-31b-it";
}

export function defaultOpenRouterUiFallbackId(): string {
  return process.env.COUNCIL_OPENROUTER_UI_FALLBACK?.trim() || "google/gemma-3-27b-it:free";
}

export function defaultOpenRouterLightId(): string {
  return process.env.COUNCIL_OPENROUTER_LIGHT?.trim() || "google/gemma-3-12b-it:free";
}

export function defaultOpenRouterLightNanoId(): string {
  return process.env.COUNCIL_OPENROUTER_LIGHT_NANO?.trim() || "google/gemma-3n-e4b-it:free";
}

export function defaultOpenRouterQwenFallbackId(): string {
  return (
    process.env.COUNCIL_OPENROUTER_QWEN_FALLBACK?.trim() ||
    "openrouter/free"
  );
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
  const heavy = defaultCouncilOpenRouterHeavyId();
  const gemma4 = defaultGemma4GeminiModelId();
  const uiFb = defaultOpenRouterUiFallbackId();
  const light = defaultOpenRouterLightId();
  const lightNano = defaultOpenRouterLightNanoId();
  const qwen = defaultOpenRouterQwenFallbackId();

  const g4 = (label: string): CouncilModelStep => ({
    provider: "gemini",
    modelId: gemma4,
    label,
  });
  const or = (modelId: string, label: string): CouncilModelStep => ({
    provider: "openrouter",
    modelId,
    label,
  });

  const seen = new Set<string>();
  const out: CouncilModelStep[] = [];

  switch (role) {
    case "architect":
    case "coder":
    case "critic":
    case "tester":
    case "deployer":
      push(out, seen, or(heavy, "OpenRouter · heavy"));
      push(out, seen, g4("Gemma 4 31B · heavy"));
      push(out, seen, or(qwen, "OpenRouter · alt"));
      push(out, seen, or(light, "OpenRouter · light fallback"));
      return out;

    case "orchestrator":
      push(out, seen, or(heavy, "OpenRouter · orchestrator"));
      push(out, seen, g4("Gemma 4 31B · orchestrator"));
      push(out, seen, or(qwen, "OpenRouter · alt"));
      return out;

    case "ux-designer":
    case "visual-polish":
      push(out, seen, or(uiFb, "OpenRouter · UI"));
      push(out, seen, g4("Gemma 4 31B · UI"));
      push(out, seen, or(heavy, "OpenRouter · heavy fallback"));
      push(out, seen, or(qwen, "OpenRouter · alt"));
      return out;

    case "planner":
    case "doc-specialist":
      push(out, seen, or(light, "OpenRouter · light"));
      push(out, seen, g4("Gemma 4 31B · planner"));
      push(out, seen, or(heavy, "OpenRouter · heavy fallback"));
      push(out, seen, or(qwen, "OpenRouter · alt"));
      push(out, seen, or(lightNano, "OpenRouter · nano fallback"));
      return out;
  }
}

/** True if this chain can run with the keys available (at least one step usable). */
export function councilChainIsRunnable(
  chain: CouncilModelStep[],
  keys: { openrouterKey: string; geminiKey: string }
): boolean {
  const orK = String(keys.openrouterKey || "").trim();
  const gK = String(keys.geminiKey || "").trim();
  return chain.some((s) => {
    if (s.provider === "gemini") return !!gK;
    return !!orK;
  });
}
