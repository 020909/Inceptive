/**
 * 10-Agent Council — per-role model routing.
 *
 * Primary heavy path: **Gemma 4 31B** on the **Gemini API** (Google AI Studio key).
 * Fallbacks: OpenRouter slugs (Gemma 3 27B, Gemma 3 12B, Qwen3.6 Plus, etc.).
 *
 * Env overrides:
 * - COUNCIL_GEMMA4_GEMINI_MODEL — default `gemma-4-31b-it`
 * - COUNCIL_OPENROUTER_UI_FALLBACK — default `google/gemma-3-27b-it:free`
 * - COUNCIL_OPENROUTER_LIGHT — default `google/gemma-3-12b-it:free`
 * - COUNCIL_OPENROUTER_LIGHT_NANO — default `google/gemma-3n-e4b-it:free`
 * - COUNCIL_OPENROUTER_QWEN_FALLBACK — default `qwen/qwen3.6-plus:free`
 */

import type { AgentRole } from "./council-types";

export type CouncilModelProvider = "gemini" | "openrouter";

export type CouncilModelStep = {
  provider: CouncilModelProvider;
  /** Gemini API id (e.g. gemma-4-31b-it) or OpenRouter slug */
  modelId: string;
  label: string;
};

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
  return process.env.COUNCIL_OPENROUTER_QWEN_FALLBACK?.trim() || "qwen/qwen3.6-plus:free";
}

const push = (out: CouncilModelStep[], seen: Set<string>, step: CouncilModelStep) => {
  const k = `${step.provider}:${step.modelId}`;
  if (seen.has(k)) return;
  seen.add(k);
  out.push(step);
};

/**
 * Ordered attempts for one agent. Gemini steps are skipped at runtime if no Gemini key.
 * OpenRouter steps are skipped if no OpenRouter key.
 */
export function getCouncilModelChain(role: AgentRole): CouncilModelStep[] {
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
    /* ── Heavy: Gemma 4 31B → Qwen fallback ───────────────────────── */
    case "architect":
    case "coder":
    case "critic":
    case "tester":
    case "deployer":
      push(out, seen, g4("Gemma 4 31B · heavy"));
      push(out, seen, or(qwen, "Qwen3.6 Plus · fallback"));
      return out;

    case "orchestrator":
      push(out, seen, g4("Gemma 4 31B · orchestrator"));
      push(out, seen, or(qwen, "Qwen3.6 Plus · fallback"));
      return out;

    /* ── UI / creative: Gemma 4 → Gemma 3 27B → Qwen ───────────────── */
    case "ux-designer":
    case "visual-polish":
      push(out, seen, g4("Gemma 4 31B · UI"));
      push(out, seen, or(uiFb, "Gemma 3 27B · UI fallback"));
      push(out, seen, or(qwen, "Qwen3.6 Plus · fallback"));
      return out;

    /* ── Light / fast: 12B → Qwen → nano (OpenRouter) ─────────────── */
    case "planner":
    case "doc-specialist":
      push(out, seen, or(light, "Gemma 3 12B · light"));
      push(out, seen, or(qwen, "Qwen3.6 Plus · fallback"));
      push(out, seen, or(lightNano, "Gemma 3n · fallback"));
      return out;
  }
}

/** True if this chain can run with the keys available (at least one step usable). */
export function councilChainIsRunnable(chain: CouncilModelStep[], openrouterKey: string, geminiKey: string): boolean {
  const orK = String(openrouterKey || "").trim();
  const gK = String(geminiKey || "").trim();
  return chain.some((s) => (s.provider === "gemini" ? !!gK : !!orK));
}
