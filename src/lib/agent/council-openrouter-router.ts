/**
 * OpenRouter-only model assignments for the 10-Agent Council (free-tier slugs with `:free`).
 *
 * Override any default via env (see COUNCIL_MODEL_* below). All IDs must be valid on OpenRouter.
 *
 * Defaults (verified OpenRouter slugs):
 * - Primary (Qwen3.6 Plus):     qwen/qwen3.6-plus:free
 * - UI / creative (Gemma 27B): google/gemma-3-27b-it:free
 * - Light (Gemma 12B):         google/gemma-3-12b-it:free
 * - Light fallback (Gemma 3n): google/gemma-3n-e4b-it:free
 */

import type { AgentRole } from "./council-types";

export type CouncilRouterTier = "primary" | "ui" | "light";

export type CouncilOpenRouterResolution = {
  /** OpenRouter model id, e.g. qwen/qwen3.6-plus:free */
  modelId: string;
  /** Short label for logs / debugging */
  label: string;
  tier: CouncilRouterTier;
};

/** Qwen3.6 Plus (free) — coding, architecture, review, planning, orchestration */
export function defaultPrimaryModelId(): string {
  return process.env.COUNCIL_MODEL_PRIMARY?.trim() || "qwen/qwen3.6-plus:free";
}

/** Gemma 3 27B (free) — UI layout, aesthetics, motion, Tailwind */
export function defaultUiModelId(): string {
  return process.env.COUNCIL_MODEL_UI?.trim() || "google/gemma-3-27b-it:free";
}

/** Gemma 3 12B (free) — lighter doc/summary-style agents */
export function defaultLightModelId(): string {
  return process.env.COUNCIL_MODEL_LIGHT?.trim() || "google/gemma-3-12b-it:free";
}

/** Gemma 3n 4B (free) — fallback when light model fails or is unavailable */
export function defaultLightFallbackModelId(): string {
  return process.env.COUNCIL_MODEL_LIGHT_FALLBACK?.trim() || "google/gemma-3n-e4b-it:free";
}

/**
 * Map each Council agent role to tier + model.
 *
 * - Primary (Qwen3.6 Plus): planner, architect, coder, critic, tester, orchestrator, deployer
 * - UI (Gemma 27B): ux-designer, visual-polish
 * - Light (Gemma 12B → fallback 3n): doc-specialist only
 */
export function getOpenRouterModelForCouncilRole(role: AgentRole): CouncilOpenRouterResolution {
  const primary = defaultPrimaryModelId();
  const ui = defaultUiModelId();
  const light = defaultLightModelId();

  switch (role) {
    case "planner":
      return { modelId: primary, label: "Qwen3.6 Plus · Planner", tier: "primary" };
    case "architect":
      return { modelId: primary, label: "Qwen3.6 Plus · Architect", tier: "primary" };
    case "coder":
      return { modelId: primary, label: "Qwen3.6 Plus · Coder", tier: "primary" };
    case "critic":
      return { modelId: primary, label: "Qwen3.6 Plus · Critic", tier: "primary" };
    case "tester":
      return { modelId: primary, label: "Qwen3.6 Plus · Tester", tier: "primary" };
    case "orchestrator":
      return { modelId: primary, label: "Qwen3.6 Plus · Orchestrator", tier: "primary" };
    case "deployer":
      return { modelId: primary, label: "Qwen3.6 Plus · Deployer", tier: "primary" };

    case "ux-designer":
      return { modelId: ui, label: "Gemma 3 27B · UX", tier: "ui" };
    case "visual-polish":
      return { modelId: ui, label: "Gemma 3 27B · Visual", tier: "ui" };

    case "doc-specialist":
      return { modelId: light, label: "Gemma 3 12B · Docs", tier: "light" };
  }
}

/** Ordered list of model IDs to try for one agent call (intended model → tier fallbacks → Qwen3.6 Plus). */
export function openRouterModelFallbackChain(role: AgentRole): string[] {
  const { modelId, tier } = getOpenRouterModelForCouncilRole(role);
  const primary = defaultPrimaryModelId();
  const lightFb = defaultLightFallbackModelId();

  const seen = new Set<string>();
  const out: string[] = [];

  const push = (id: string) => {
    const t = id.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  push(modelId);
  if (tier === "light") {
    push(lightFb);
    push(primary);
  } else if (tier === "ui") {
    push(primary);
  }

  return out;
}
