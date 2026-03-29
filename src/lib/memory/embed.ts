/**
 * Lightweight deterministic embedding (64-dim) for free-tier launch.
 * This is not SOTA semantic quality, but enables pgvector retrieval now with zero paid APIs.
 */
export function embedText64(text: string): number[] {
  const v = new Array<number>(64).fill(0);
  const t = (text || "").toLowerCase();
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    v[i % 64] += ((c % 97) + 1) / 100;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => Number(n.toFixed(6))).join(",")}]`;
}

