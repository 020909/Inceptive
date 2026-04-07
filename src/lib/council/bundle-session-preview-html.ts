/**
 * Session Council outputs markdown + optional multi-file fences. Blob/iframe previews
 * cannot load relative styles.css — merge CSS into the HTML document for a real-looking page.
 */

import { parseCouncilSandboxFiles } from "@/lib/agent/parse-council-deliverables";

function injectCssInHead(html: string, css: string): string {
  const trimmed = css.trim();
  if (!trimmed) return html;
  const styleTag = `<style data-inceptive-inlined="1">\n${trimmed}\n</style>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleTag}\n</head>`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (h) => `${h}\n${styleTag}`);
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${styleTag}</head><body>\n${html}\n</body></html>`;
}

/** Remove <link rel="stylesheet" href="...path..."> when that sheet was inlined. */
function stripMatchingStylesheetLinks(html: string, cssRelativePath: string): string {
  const base = cssRelativePath.split("/").pop() || cssRelativePath;
  const noQuery = base.replace(/\?.*$/, "");
  const escaped = noQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<link[^>]+href=["'][^"']*${escaped}[^"']*["'][^>]*>`, "gi");
  return html.replace(re, "");
}

function stripAllLocalStylesheetLinks(html: string): string {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag)) return tag;
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return tag;
    const href = hrefMatch[1].trim();
    if (/^https?:\/\//i.test(href) || href.startsWith("//")) return tag;
    if (/\.css(\?|#|$)/i.test(href)) return "";
    return tag;
  });
}

/**
 * Returns one HTML string suitable for srcDoc / blob preview, or null if no HTML found.
 */
export function bundleSessionCouncilOutputForPreview(raw: string): string | null {
  if (!raw?.trim()) return null;

  const files = parseCouncilSandboxFiles(raw);
  if (files.length > 0) {
    const htmlFiles = files.filter((f) => /\.html?$/i.test(f.relativePath));
    const cssFiles = files.filter((f) => f.relativePath.endsWith(".css"));
    const main =
      htmlFiles.find((f) => /(^|\/)index\.html$/i.test(f.relativePath))?.content ??
      htmlFiles[0]?.content;
    if (!main?.trim()) return null;

    let html = main.trim();
    if (cssFiles.length > 0) {
      const combined = cssFiles
        .map((f) => `/* --- ${f.relativePath} --- */\n${f.content.trim()}`)
        .join("\n\n");
      html = injectCssInHead(html, combined);
      for (const f of cssFiles) {
        html = stripMatchingStylesheetLinks(html, f.relativePath);
        html = stripMatchingStylesheetLinks(html, f.relativePath.split("/").pop() || f.relativePath);
      }
    } else {
      const looseCss = [...raw.matchAll(/```css\s*\n([\s\S]*?)```/gi)]
        .map((m) => m[1].trim())
        .filter(Boolean);
      if (looseCss.length > 0) {
        html = injectCssInHead(html, looseCss.join("\n\n"));
      }
      html = stripAllLocalStylesheetLinks(html);
    }
    return html;
  }

  const htmlMatches = [...raw.matchAll(/```html\s*\n([\s\S]*?)```/gi)];
  const cssMatches = [...raw.matchAll(/```css\s*\n([\s\S]*?)```/gi)];

  if (htmlMatches.length === 0) return null;

  let html = htmlMatches[0][1].trim();
  if (cssMatches.length > 0) {
    const css = cssMatches.map((m) => m[1].trim()).join("\n\n");
    html = injectCssInHead(html, css);
  }
  html = stripAllLocalStylesheetLinks(html);
  return html.trim() || null;
}
