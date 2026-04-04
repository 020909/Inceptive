import path from "path";
import { generateText } from "ai";
import { parseCouncilSandboxFiles } from "@/lib/agent/parse-council-deliverables";
import {
  buildCouncilRefineModel,
  hasCouncilRefineKey,
  type CouncilRefineKeys,
} from "@/lib/agent/council-refine-model";
import { applyDeterministicSiteFixes } from "@/lib/sandbox/site-deterministic-fixes";

export type SiteDeliverable = { relativePath: string; content: string };

function normRel(rel: string): string | null {
  const t = (rel || "").trim().replace(/^[\\/]+/, "");
  if (!t || t.includes("..")) return null;
  return t.split(path.sep).join("/");
}

function resolveHref(entryHtmlRel: string, href: string): string | null {
  const clean = href.split("?")[0].split("#")[0].trim();
  if (!clean || /^https?:\/\//i.test(clean) || clean.startsWith("//")) return null;
  const baseDir = path.posix.dirname(entryHtmlRel.replace(/^\//, ""));
  const joined = path.posix.normalize(path.posix.join(baseDir === "." ? "" : baseDir, clean)).replace(/^\//, "");
  return normRel(joined);
}

function pickEntryHtml(map: Map<string, string>): string | null {
  for (const n of ["index.html", "Index.html", "home.html"]) {
    if (map.has(n)) return n;
  }
  for (const k of map.keys()) {
    if (/\.(html|htm)$/i.test(k)) return k;
  }
  return null;
}

/**
 * Static checks (no browser) — catches broken asset refs and missing basics before preview.
 */
export function verifyStaticSiteDeliverables(deliverables: SiteDeliverable[]): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const map = new Map<string, string>();
  for (const d of deliverables) {
    const r = normRel(d.relativePath);
    if (r) map.set(r, d.content ?? "");
  }

  const entry = pickEntryHtml(map);
  if (!entry) {
    issues.push("No HTML entry file (expected index.html or similar).");
    return { ok: false, issues };
  }

  const html = map.get(entry) || "";
  const lower = html.toLowerCase();

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    issues.push("Missing viewport meta tag (mobile / responsive).");
  }
  if (!/<meta[^>]+charset=/i.test(html) && !/<meta\s+charset=/i.test(html)) {
    issues.push("Missing charset declaration in HTML.");
  }
  if (!/<title[^>]*>[\s\S]*<\/title>/i.test(html)) {
    issues.push("Missing <title> element.");
  }

  for (const m of html.matchAll(/<link\s+[^>]+>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (!hrefMatch) continue;
    const relFile = resolveHref(entry, hrefMatch[1]);
    if (!relFile) continue;
    if (!map.has(relFile)) {
      issues.push(`Stylesheet href points to missing file: ${relFile} (from ${hrefMatch[1]}).`);
    }
  }

  for (const m of html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const src = m[1];
    if (/^https?:\/\//i.test(src) || src.startsWith("//")) continue;
    if (/type\s*=\s*["']module["']/i.test(m[0])) continue;
    const relFile = resolveHref(entry, src);
    if (!relFile) continue;
    if (!map.has(relFile)) {
      issues.push(`Script src points to missing file: ${relFile} (from ${src}).`);
    }
  }

  const mainCss = map.get("styles/main.css");
  if (mainCss !== undefined && mainCss.trim().length < 400) {
    issues.push("styles/main.css looks too thin — likely needs stronger layout, typography, and component styles.");
  }

  if (!lower.includes("<main") && !lower.includes('role="main"')) {
    issues.push("Consider semantic structure: add <main> (or role=main) for accessibility.");
  }

  return { ok: issues.length === 0, issues };
}

/**
 * One repair pass: fix listed issues while keeping multi-file fences parseable.
 */
export async function repairSiteDeliverables(
  brief: string,
  deliverables: SiteDeliverable[],
  issues: string[],
  keys: CouncilRefineKeys
): Promise<SiteDeliverable[] | null> {
  if (!issues.length || !hasCouncilRefineKey(keys)) return null;

  const model = buildCouncilRefineModel(keys);
  const fileSummary = deliverables
    .map((f) => {
      const r = normRel(f.relativePath) || f.relativePath;
      const body = (f.content || "").slice(0, 14_000);
      return `### ${r}\n${body}`;
    })
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model,
    system: `You are a senior front-end engineer shipping production static sites.
The user's site failed automated verification. Fix ONLY what is needed to resolve the issues.
Rules:
- Output NOTHING but markdown fenced code blocks.
- Each fence: language tag (html, css, or javascript), first line EXACTLY: <!-- inceptive-file: relative/path -->
- Keep paths consistent: index.html, styles/main.css, scripts/app.js unless the input used different paths (then preserve those paths).
- Deep charcoal / warm paper editorial palette; strong typography; responsive layout; accessible focus states.
- Do not add backend, frameworks, or npm packages — static HTML/CSS/JS only.`,
    prompt: `## Product brief\n${brief.slice(0, 6000)}\n\n## Verification issues (must address)\n${issues.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n## Current files\n${fileSummary}`,
    maxTokens: 16_000,
  } as any);

  const parsed = parseCouncilSandboxFiles(text || "");
  if (parsed.length < 2) return null;
  return parsed;
}

const MAX_VERIFY_REPAIR_ROUNDS = 2;

/**
 * Deterministic HTML fixes → verify → LLM repair (up to two rounds) → deterministic again after each repair.
 */
export async function runVerifyRepairLoop(
  brief: string,
  deliverables: SiteDeliverable[],
  keys: CouncilRefineKeys,
  enqueue?: (line: string) => void
): Promise<SiteDeliverable[]> {
  let current = applyDeterministicSiteFixes(deliverables, brief) as SiteDeliverable[];

  for (let round = 0; round < MAX_VERIFY_REPAIR_ROUNDS; round++) {
    const v = verifyStaticSiteDeliverables(current);
    if (v.ok || !hasCouncilRefineKey(keys)) return current;

    enqueue?.(
      `5:${JSON.stringify({
        type: "preview",
        state: "building",
        label:
          round === 0
            ? "Verify: fixing layout, assets, and semantics before preview…"
            : "Verify: second repair pass…",
        source: "verify-repair",
      })}\n`
    );

    const repaired = await repairSiteDeliverables(brief, current, v.issues, keys);
    if (!repaired || repaired.length < 2) return current;

    current = applyDeterministicSiteFixes(repaired, brief) as SiteDeliverable[];
  }

  return current;
}
