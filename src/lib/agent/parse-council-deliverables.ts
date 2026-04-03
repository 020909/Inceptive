/**
 * Extract multi-file deliverables from Council orchestrator synthesis.
 * Orchestrator is prompted to emit fenced blocks with <!-- inceptive-file: path --> on the first line.
 */

export function parseCouncilSandboxFiles(synthesis: string): { relativePath: string; content: string }[] {
  if (!synthesis?.trim()) return [];

  const out: { relativePath: string; content: string }[] = [];
  const re =
    /```(?:html|css|javascript|js|txt|json)?\s*\n<!--\s*inceptive-file:\s*([^>\n]+?)\s*-->\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(synthesis)) !== null) {
    const rel = m[1].trim().replace(/^[/\\]+/, "");
    const content = m[2].trim();
    if (rel && content) out.push({ relativePath: rel, content });
  }

  if (out.length === 0) {
    const htmlFence = /```html\s*\n([\s\S]*?)```/i;
    const hm = htmlFence.exec(synthesis);
    if (hm?.[1]?.trim()) {
      out.push({ relativePath: "index.html", content: hm[1].trim() });
    }
  }

  return out;
}
