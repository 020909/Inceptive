/**
 * Remove inline numeric citation markers like [1], [1, 2] from report body (sources belong in Sources section).
 */
export function stripInlineNumericCitations(raw: string): string {
  return raw
    .replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "")
    .replace(/\s*\[N\]/gi, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

/**
 * Append any retrieval URLs not already present so every browsed source appears at the end.
 */
export function ensureRetrievalUrlsListed(content: string, urls: string[]): string {
  const trimmed = content.trim();
  if (urls.length === 0) return trimmed;
  const missing = urls.filter((u) => u && !trimmed.includes(u));
  if (missing.length === 0) return trimmed;
  const tail = trimmed.slice(-1200);
  const alreadyHasSourcesHeading = /\bSources\b/i.test(tail);
  const bullets = missing.map((u) => `• ${u}`).join("\n");
  if (alreadyHasSourcesHeading) {
    return `${trimmed}\n${bullets}`;
  }
  return `${trimmed}\n\nSources\n${bullets}`;
}

/**
 * Normalize model output: remove markdown # headers, convert to numbered sections where needed.
 * Used server-side before saving reports.
 */
export function normalizeReportFormatting(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let sectionNum = 1;
  const out: string[] = [];

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      const level = m[1].length;
      const title = m[2].trim();
      if (level >= 2) {
        out.push(`${sectionNum}. ${title}`);
        sectionNum += 1;
      } else {
        out.push(title);
      }
      continue;
    }
    out.push(line);
  }

  return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}
