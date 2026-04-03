/**
 * Resolves which provider + model id each Council agent uses.
 * Covers: Qwen + Minimax via OpenRouter, Gemini via OpenRouter, NVIDIA NIM for heavy code/synthesis.
 */

import { nvidiaModelForTask } from "@/lib/ai/nvidia-model-router";

export type CouncilProviderKind =
  | "openrouter-qwen"
  | "openrouter-minimax"
  | "openrouter-gemini"
  | "nvidia-code"
  | "nvidia-design"
  | "nvidia-default";

const OR_QWEN = () => process.env.COUNCIL_QWEN_MODEL?.trim() || "qwen/qwen-plus";
const OR_MINIMAX = () => process.env.COUNCIL_MINIMAX_MODEL?.trim() || "minimax/minimax-01";
const OR_GEMINI = () =>
  process.env.COUNCIL_OPENROUTER_GEMINI_MODEL?.trim() || "google/gemini-2.0-flash-001";

export type ResolvedCouncilModel = {
  provider: "openrouter" | "nvidia";
  modelId: string;
  /** Short label for logs */
  label: string;
};

/**
 * Pick runtime model for one agent. When `nvidiaAvailable` is false, NVIDIA kinds fall back to OpenRouter.
 */
export function resolveCouncilModel(
  kind: CouncilProviderKind,
  task: string,
  nvidiaAvailable: boolean
): ResolvedCouncilModel {
  if (kind === "openrouter-qwen") {
    return { provider: "openrouter", modelId: OR_QWEN(), label: "OpenRouter · Qwen" };
  }
  if (kind === "openrouter-minimax") {
    return { provider: "openrouter", modelId: OR_MINIMAX(), label: "OpenRouter · Minimax" };
  }
  if (kind === "openrouter-gemini") {
    return { provider: "openrouter", modelId: OR_GEMINI(), label: "OpenRouter · Gemini" };
  }

  const useNv = (nvidiaModel: string, reason: string): ResolvedCouncilModel => ({
    provider: "nvidia",
    modelId: nvidiaModel,
    label: `NVIDIA · ${reason}`,
  });

  if (!nvidiaAvailable) {
    /* Fallbacks when NIM key missing — keep council usable on OpenRouter only */
    if (kind === "nvidia-code") {
      return { provider: "openrouter", modelId: OR_QWEN(), label: "OpenRouter · Qwen (fallback, no NVIDIA key)" };
    }
    if (kind === "nvidia-design") {
      return { provider: "openrouter", modelId: OR_MINIMAX(), label: "OpenRouter · Minimax (fallback, no NVIDIA key)" };
    }
    return { provider: "openrouter", modelId: OR_GEMINI(), label: "OpenRouter · Gemini (fallback, no NVIDIA key)" };
  }

  if (kind === "nvidia-code") {
    const env = process.env.NVIDIA_MODEL_CODE?.trim();
    const nim = nvidiaModelForTask(`${task} typescript code implement`);
    return useNv(env || nim.model, "code");
  }
  if (kind === "nvidia-design") {
    const env = process.env.NVIDIA_MODEL_DESIGN?.trim();
    const nim = nvidiaModelForTask(`ui design layout css ${task}`);
    return useNv(env || nim.model, "design");
  }
  /* nvidia-default */
  const env = process.env.NVIDIA_MODEL_DEFAULT?.trim() || process.env.NVIDIA_MODEL_REASONING?.trim();
  const nim = nvidiaModelForTask(task);
  return useNv(env || nim.model, "general");
}
