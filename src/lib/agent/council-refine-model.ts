import { buildModel } from "@/lib/ai-model";

export type CouncilRefineKeys = {
  openrouterKey: string;
  geminiKey: string;
};

const OPENROUTER_REFINE_MODEL = process.env.COUNCIL_REFINE_MODEL?.trim() || "google/gemini-2.0-flash-001";
const GEMINI_REFINE_MODEL = process.env.COUNCIL_REFINE_GEMINI_MODEL?.trim() || "gemma-4-31b-it";

/** Prefer OpenRouter for refine (cheap Flash slug); if missing, use Gemini / Gemma 4. */
export function buildCouncilRefineModel(keys: CouncilRefineKeys) {
  const or = String(keys.openrouterKey || "").trim();
  const gem = String(keys.geminiKey || "").trim();
  if (or) return buildModel(or, "openrouter", OPENROUTER_REFINE_MODEL);
  if (gem) return buildModel(gem, "gemini", GEMINI_REFINE_MODEL);
  throw new Error("Council refine needs OPENROUTER_KEY and/or GEMINI_API_KEY");
}

export function hasCouncilRefineKey(keys: CouncilRefineKeys): boolean {
  return !!(String(keys.openrouterKey || "").trim() || String(keys.geminiKey || "").trim());
}
