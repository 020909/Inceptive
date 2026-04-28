import "server-only";

import { generateObject } from "ai";
import { buildModel } from "@/lib/ai-model";
import { UboExtractionResultSchema, type UboExtractionResult } from "@/types/compliance";

const UBO_SYSTEM_PROMPT = `
You are a compliance analyst extracting Ultimate Beneficial Ownership (UBO) information from noisy OCR/document text.

Rules:
- Output MUST match the provided JSON schema exactly.
- Use citations. Every extracted company/person/relationship MUST include a citation with an excerpt that supports the claim.
- Ownership percentages may be null if not specified.
- relationship_type must be one of: direct, indirect, nominee, unknown.
- Be conservative: do not invent entities or relationships not evidenced in the text.
`.trim();

function computeExtractionConfidence(result: UboExtractionResult): number {
  const companyCount = result.companies?.length ?? 0;
  const personCount = result.persons?.length ?? 0;
  const relCount = result.ownership_relationships?.length ?? 0;

  const citationCount =
    (result.companies?.filter((c) => c.citation?.excerpt?.length > 0).length ?? 0) +
    (result.persons?.filter((p) => p.citation?.excerpt?.length > 0).length ?? 0) +
    (result.ownership_relationships?.filter((r) => r.citation?.excerpt?.length > 0).length ?? 0);

  const totalItems = companyCount + personCount + relCount;
  const citationRatio = totalItems > 0 ? citationCount / totalItems : 0;

  const structureScore =
    Math.min(companyCount, 5) / 5 * 0.25 +
    Math.min(personCount, 10) / 10 * 0.25 +
    Math.min(relCount, 15) / 15 * 0.3;

  const citationScore = citationRatio * 0.2;

  const raw = 0.2 + structureScore + citationScore;
  return Math.max(0, Math.min(1, Number(raw.toFixed(2))));
}

export async function extractUboFromText(text: string): Promise<{
  result: UboExtractionResult;
  extraction_confidence: number;
  gate_passed: boolean;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const model = buildModel(apiKey, "openrouter", process.env.OPENROUTER_EXTRACTOR_MODEL || "anthropic/claude-3.5-sonnet");

  const { object } = await generateObject({
    model,
    temperature: 0,
    system: UBO_SYSTEM_PROMPT,
    schema: UboExtractionResultSchema,
    prompt:
      `Extract UBO entities and ownership relationships from the following document text:\n\n` +
      text.slice(0, 200_000),
  });

  const base = UboExtractionResultSchema.parse(object);
  const confidence = computeExtractionConfidence(base);

  const result: UboExtractionResult = {
    ...base,
    extraction_confidence: confidence,
  };

  return {
    result,
    extraction_confidence: confidence,
    gate_passed: confidence >= 0.7,
  };
}

