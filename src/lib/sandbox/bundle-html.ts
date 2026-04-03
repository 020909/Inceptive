import path from "path";
import { readFile, readdir } from "fs/promises";
import { userSandboxRoot, safeSandboxRelative } from "./user-artifacts";
import { EDITORIAL_BASE_CSS, mergeCssWithEditorialBase } from "./editorial-base-css";

function isRemoteHref(h: string): boolean {
  return /^https?:\/\//i.test(h) || h.startsWith("//");
}

/** Resolve href relative to HTML file's directory */
function resolveRelative(fromHtmlRel: string, href: string): string | null {
  const clean = href.split("?")[0].split("#")[0].trim();
  if (!clean || isRemoteHref(clean)) return null;
  const baseDir = path.posix.dirname(fromHtmlRel.replace(/^\//, ""));
  const joined = path.posix.normalize(path.posix.join(baseDir === "." ? "" : baseDir, clean)).replace(/^\//, "");
  return safeSandboxRelative(joined);
}

async function readSandboxFile(rootResolved: string, rel: string): Promise<string | null> {
  const full = path.resolve(path.join(rootResolved, rel));
  if (!full.startsWith(rootResolved + path.sep) && full !== rootResolved) return null;
  try {
    return await readFile(full, "utf8");
  } catch {
    return null;
  }
}

async function pickEntryHtml(rootResolved: string): Promise<string | null> {
  for (const name of ["index.html", "Index.html", "home.html"]) {
    const rel = safeSandboxRelative(name);
    if (!rel) continue;
    const txt = await readSandboxFile(rootResolved, rel);
    if (txt) return rel;
  }
  try {
    const entries = await readdir(rootResolved, { withFileTypes: true });
    const html = entries.find((e) => e.isFile() && /\.(html|htm)$/i.test(e.name));
    return html ? safeSandboxRelative(html.name) : null;
  } catch {
    return null;
  }
}

/**
 * Inline relative CSS/JS into HTML so srcDoc/iframe preview works without a static file server.
 * External URLs on link/script are left unchanged.
 */
export async function bundleSandboxIndexForPreview(userId: string): Promise<string | null> {
  const rootResolved = path.resolve(userSandboxRoot(userId));
  const entryRel = await pickEntryHtml(rootResolved);
  if (!entryRel) return null;

  const rawHtml = await readSandboxFile(rootResolved, entryRel);
  if (!rawHtml) return null;

  let out = rawHtml;
  const linkTags = [...rawHtml.matchAll(/<link\s+[^>]+>/gi)];
  for (const m of linkTags) {
    const tag = m[0];
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (!/rel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    if (isRemoteHref(href)) continue;
    const relFile = resolveRelative(entryRel, href);
    if (!relFile) continue;
    const css = await readSandboxFile(rootResolved, relFile);
    if (!css) continue;
    const merged = mergeCssWithEditorialBase(css);
    out = out.replace(tag, `<style data-inceptive-inlined="${relFile}">\n${merged}\n</style>`);
  }

  let strippedUnresolved = false;
  out = out.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (!hrefMatch) return tag;
    const href = hrefMatch[1];
    if (isRemoteHref(href)) return tag;
    strippedUnresolved = true;
    return "";
  });
  if (strippedUnresolved) {
    out = out.replace(/<\/head>/i, `  <style data-inceptive-fallback="missing-css">\n${EDITORIAL_BASE_CSS}\n</style>\n</head>`);
  }

  const scriptTags = [...out.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi)];
  for (const m of scriptTags) {
    const full = m[0];
    const src = m[1];
    if (isRemoteHref(src)) continue;
    if (/type\s*=\s*["']module["']/i.test(full)) continue;
    const relFile = resolveRelative(entryRel, src);
    if (!relFile) continue;
    const js = await readSandboxFile(rootResolved, relFile);
    if (!js) continue;
    out = out.replace(full, `<script data-inceptive-inlined="${relFile}">\n${js}\n</script>`);
  }

  return out;
}
