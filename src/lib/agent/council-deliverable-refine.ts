import { generateText } from "ai";
import { buildCouncilRefineModel, type CouncilRefineKeys } from "@/lib/agent/council-refine-model";

/** Tasks that deserve a real multi-file static site, not one generic HTML blob */
export function isWebsiteBuildTask(text: string): boolean {
  const t = (text || "").toLowerCase();
  if (
    /\b(website|web app|webapp|landing page|landing|homepage|saas|portfolio|marketing site|static site|multi-?page|full stack|fullstack)\b/.test(
      t
    )
  ) {
    return true;
  }
  if (/\b(flow|dashboard|planner|habit tracker|productivity)\b/.test(t) && /\b(app|tool|site|page|build|create)\b/.test(t)) {
    return true;
  }
  return /\b(build|create|design)\b/.test(t) && /\b(html|css|ui|frontend|page|site)\b/.test(t);
}

/**
 * Quality pass: turn thin single-file council output into a multi-file editorial site.
 * Two passes — second is stricter if the first still collapses to one file in the parser.
 */
export async function refineSynthesisToMultiFileDeliverables(
  codingRequest: string,
  synthesis: string,
  keys: CouncilRefineKeys,
  pass: 1 | 2
): Promise<string> {
  const model = buildCouncilRefineModel(keys);
  const strict =
    pass === 2
      ? `You MUST output at least THREE separate fenced code blocks:
1) html — first line inside fence: <!-- inceptive-file: index.html -->
2) css — first line: <!-- inceptive-file: styles/main.css -->
3) javascript — first line: <!-- inceptive-file: scripts/app.js -->
No exceptions. Link CSS/JS from index.html.`
      : "";

  const { text } = await generateText({
    model,
    system: `You are a principal front-end engineer at a top product studio (think Linear/Vercel editorial quality).
${strict}

Rules:
- Split into real files: index.html, styles/main.css, scripts/app.js (add more pages only if the brief needs them).
- Visual: deep charcoal bg #141413, warm paper text #f5f2eb, accents #c4b8a5 and #8a7f6b — NO purple or indigo unless the user asked.
- Structure: distinctive hero (gradient mesh, grain, or geometric accent — not a flat rectangle), credible feature grid, optional stats or testimonial band, strong CTA, polished footer.
- Typography hierarchy (sizes, letter-spacing), spacing rhythm, :focus-visible, hover states, reduced-motion fallback.
- JavaScript: progressive enhancement; keep DOM code clear.
- Output NOTHING but markdown code fences. Each fence: language tag, then first line exactly <!-- inceptive-file: relative/path -->, then file body.`,
    prompt: `## Product brief\n${codingRequest.slice(0, 8000)}\n\n## Draft from prior agents (reuse copy/features, elevate execution)\n${synthesis.slice(0, 16_000)}`,
    maxTokens: 18_000,
  } as any);

  return (text || "").trim();
}
