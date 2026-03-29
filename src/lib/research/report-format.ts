/**
 * Normalize model output: remove markdown # headers, convert to numbered sections where needed.
 * Used server-side before saving reports.
 */
export function normalizeReportFormatting(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
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
