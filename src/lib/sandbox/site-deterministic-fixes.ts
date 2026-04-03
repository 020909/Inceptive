export type SiteDeliverableInput = { relativePath: string; content: string };

function normRel(rel: string): string | null {
  const t = (rel || "").trim().replace(/^[\\/]+/, "");
  if (!t || t.includes("..")) return null;
  return t.replace(/\\/g, "/");
}

function escapeTitle(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 120);
}

/** Derive a short title from the user brief (first line / first sentence). */
export function titleFromBrief(brief?: string): string {
  const b = (brief || "").trim();
  if (!b) return "Site";
  const line = b.split(/\n/)[0]?.trim() || b;
  const cut = line.slice(0, 72).replace(/\s+/g, " ");
  return cut.length < 3 ? "Site" : cut;
}

/**
 * Inject charset, viewport, title, and html lang without calling an LLM.
 * Safe for full documents; if the fragment has no <head>, wraps a minimal shell.
 */
export function fixHtmlDocument(html: string, title: string): string {
  let h = html || "";
  const t = escapeTitle(title);

  const hasDoctype = /<!DOCTYPE/i.test(h);
  const hasHtml = /<html[\s>]/i.test(h);
  const hasHead = /<head[\s>]/i.test(h);
  const hasBody = /<body[\s>]/i.test(h);

  if (!hasHead || !hasBody) {
    if (!hasDoctype && !hasHtml) {
      h = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
</head>
<body>
${h.trim()}
</body>
</html>`;
    }
  }

  if (/<html(\s[^>]*)?>/i.test(h) && !/<html[^>]+lang=/i.test(h)) {
    h = h.replace(/<html(\s[^>]*)?>/i, (_m, attrs: string | undefined) => {
      const a = attrs || "";
      if (/lang\s*=/.test(a)) return `<html${a}>`;
      return `<html lang="en"${a}>`;
    });
  }

  if (/<head(\s[^>]*)?>/i.test(h)) {
    if (!/<meta[^>]+charset=/i.test(h) && !/<meta\s+charset=/i.test(h)) {
      h = h.replace(/<head(\s[^>]*)?>/i, `<head$1>\n<meta charset="utf-8" />`);
    }
    if (!/<meta[^>]+name=["']viewport["']/i.test(h)) {
      h = h.replace(
        /<head(\s[^>]*)?>/i,
        `<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1" />`
      );
    }
    if (!/<title[^>]*>[\s\S]*<\/title>/i.test(h)) {
      h = h.replace(/<head(\s[^>]*)?>/i, `<head$1>\n<title>${t}</title>`);
    }
  }

  return h;
}

export function applyDeterministicSiteFixes(
  deliverables: SiteDeliverableInput[],
  brief?: string
): SiteDeliverableInput[] {
  const title = titleFromBrief(brief);
  return deliverables.map((d) => {
    const r = normRel(d.relativePath);
    if (!r || !/\.html?$/i.test(r)) return d;
    return { ...d, content: fixHtmlDocument(d.content || "", title) };
  });
}
