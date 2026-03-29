/**
 * Optional Apache Tika server (self-hosted). PUT /tika returns plain text.
 * Set TIKA_URL e.g. https://your-tika.example.com (no trailing slash).
 */
export async function extractTextWithTika(buffer: Buffer, mimeType: string): Promise<string | null> {
  const base = process.env.TIKA_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/tika`, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        Accept: "text/plain",
        "User-Agent": "InceptiveAI/1.0 (tika-client)",
      },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.warn("[tika-extract]", res.status, await res.text().catch(() => ""));
      return null;
    }
    const text = await res.text();
    const trimmed = text?.trim();
    return trimmed || null;
  } catch (e) {
    console.warn("[tika-extract] failed", e);
    return null;
  }
}
