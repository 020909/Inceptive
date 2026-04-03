import path from "path";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";

export function userSandboxRoot(userId: string): string {
  return path.join(process.cwd(), ".inceptive-artifacts", userId);
}

/** Prevent path escape; returns posix-style relative path */
export function safeSandboxRelative(rel: string): string | null {
  const trimmed = rel.trim().replace(/^[\\/]+/, "");
  if (!trimmed || trimmed.length > 220) return null;
  const norm = path.normalize(trimmed);
  if (norm.startsWith("..") || norm.split(/[/\\]/).includes("..")) return null;
  return norm.split(path.sep).join("/");
}

const DEFAULT_MAX_TOTAL = 450_000;

export async function writeUserSandboxFilesBatch(
  userId: string,
  files: { relativePath: string; content: string }[],
  maxTotal: number = DEFAULT_MAX_TOTAL
): Promise<
  | { status: "success"; paths: string[]; message: string; root: string }
  | { status: "error"; message: string }
> {
  const root = userSandboxRoot(userId);
  let total = 0;
  const written: string[] = [];

  for (const f of files) {
    const rel = safeSandboxRelative(f.relativePath);
    if (!rel) {
      return { status: "error", message: `Invalid path: ${f.relativePath}` };
    }
    total += (f.content || "").length;
    if (total > maxTotal) {
      return { status: "error", message: "Batch too large — split into smaller writes." };
    }
  }

  const rootResolved = path.resolve(root);
  await mkdir(rootResolved, { recursive: true });

  for (const f of files) {
    const rel = safeSandboxRelative(f.relativePath)!;
    const full = path.resolve(path.join(rootResolved, rel));
    if (!full.startsWith(rootResolved + path.sep) && full !== rootResolved) {
      return { status: "error", message: "Path traversal blocked." };
    }
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, f.content ?? "", "utf8");
    written.push(rel);
  }

  return {
    status: "success",
    paths: written,
    message: `Wrote ${written.length} file(s) to user sandbox.`,
    root: `.inceptive-artifacts/${userId}/`,
  };
}

export async function listUserSandboxFiles(
  userId: string,
  depth: number = 4
): Promise<{ status: "success"; paths: string[]; root: string } | { status: "error"; message: string }> {
  const root = userSandboxRoot(userId);
  const rootResolved = path.resolve(root);

  const ignore = new Set([".DS_Store"]);
  const walk = async (dirAbs: string, currentDepth: number): Promise<string[]> => {
    if (currentDepth > depth) return [];
    try {
      const entries = await readdir(dirAbs, { withFileTypes: true });
      const out: string[] = [];
      for (const entry of entries) {
        if (ignore.has(entry.name)) continue;
        const abs = path.resolve(path.join(dirAbs, entry.name));
        if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) continue;
        const relRaw = path.relative(rootResolved, abs);
        const rel = relRaw.split(path.sep).join("/");
        if (entry.isDirectory()) {
          out.push(rel + "/");
          out.push(...(await walk(abs, currentDepth + 1)));
        } else {
          out.push(rel);
        }
      }
      return out;
    } catch {
      return [];
    }
  };

  const paths = await walk(rootResolved, 0);
  return { status: "success", paths: paths.slice(0, 800), root: `.inceptive-artifacts/${userId}/` };
}

export async function readUserSandboxFile(
  userId: string,
  relativePath: string
): Promise<{ status: "success"; content: string; path: string } | { status: "error"; message: string }> {
  const rel = safeSandboxRelative(relativePath);
  if (!rel) return { status: "error", message: `Invalid path: ${relativePath}` };
  const rootResolved = path.resolve(userSandboxRoot(userId));
  const full = path.resolve(path.join(rootResolved, rel));
  if (!full.startsWith(rootResolved + path.sep) && full !== rootResolved) {
    return { status: "error", message: "Path traversal blocked." };
  }
  try {
    const content = await readFile(full, "utf8");
    return { status: "success", content, path: rel };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "error", message: msg };
  }
}
