import { generateText } from "ai";
import { buildModel } from "@/lib/ai-model";
import { parseCouncilSandboxFiles } from "@/lib/agent/parse-council-deliverables";

const SCAFFOLD_MODEL = process.env.COUNCIL_REFINE_MODEL?.trim() || "google/gemini-2.0-flash-001";

const NEXT_PREFIX = "next-site/";

function filterNextSiteFiles(files: { relativePath: string; content: string }[]): { relativePath: string; content: string }[] {
  return files.filter((f) => {
    const r = (f.relativePath || "").trim().replace(/^[\\/]+/, "");
    return r.startsWith(NEXT_PREFIX) && !r.includes("..");
  });
}

/**
 * Generates a minimal Next.js App Router project under `next-site/` in the user sandbox.
 * Uses the same fenced `<!-- inceptive-file: path -->` convention as Council deliverables.
 */
export async function generateNextjsScaffoldFiles(
  brief: string,
  openrouterKey: string,
  existing?: { path: string; content: string }[]
): Promise<{ relativePath: string; content: string }[] | null> {
  if (!openrouterKey.trim()) return null;

  const snippets = (existing || [])
    .filter((e) => e.path && e.content)
    .map((e) => `### ${e.path}\n${e.content.slice(0, 12_000)}`)
    .join("\n\n---\n\n");

  const model = buildModel(openrouterKey, "openrouter", SCAFFOLD_MODEL);

  const { text } = await generateText({
    model,
    system: `You scaffold a minimal Next.js 15 App Router project under the folder prefix "${NEXT_PREFIX}".
Output NOTHING but markdown fenced code blocks.
Each fence: language tag (json, tsx, ts, css), first line EXACTLY: <!-- inceptive-file: ${NEXT_PREFIX}... -->
Required paths (all under ${NEXT_PREFIX}):
- ${NEXT_PREFIX}package.json — next, react, react-dom, devDependencies typescript @types/node @types/react; scripts: dev, build, start
- ${NEXT_PREFIX}next.config.ts — minimal (can use \`import type { NextConfig } from "next"\`)
- ${NEXT_PREFIX}tsconfig.json
- ${NEXT_PREFIX}app/layout.tsx — RootLayout, metadata title from brief, import ./globals.css
- ${NEXT_PREFIX}app/page.tsx — main page; migrate structure/copy from static index.html when provided
- ${NEXT_PREFIX}app/globals.css — base styles; fold in styles/main.css ideas when provided

Rules:
- Use the App Router only (app/). No pages/ router.
- Prefer Server Components; add "use client" only if you need hooks or browser APIs.
- Keep dependencies minimal — no UI kits unless essential.`,
    prompt: `## Product brief\n${brief.slice(0, 6000)}\n\n## Existing static site files (optional)\n${snippets || "(none — infer from brief)"}`,
    maxTokens: 14_000,
  } as any);

  const parsed = parseCouncilSandboxFiles(text || "");
  const filtered = filterNextSiteFiles(parsed);
  if (filtered.length < 4) return null;
  return filtered;
}
