#!/usr/bin/env node
/**
 * Polls the Next.js app to drain agent_jobs. Run under Docker Compose, PM2, or systemd.
 * Required env: CRON_SECRET. Optional: AGENT_TICK_URL (default http://localhost:3000)
 */
const BASE = (process.env.AGENT_TICK_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const INTERVAL_MS = Number(process.env.AGENT_TICK_INTERVAL_MS || 30_000);

if (!SECRET) {
  console.error("[agent-worker] CRON_SECRET is required");
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(`${BASE}/api/internal/agent-tick`, {
      method: "POST",
      headers: { "x-cron-secret": SECRET },
    });
    const text = await res.text();
    console.log(`[agent-worker] ${new Date().toISOString()} ${res.status} ${text}`);
  } catch (e) {
    console.error("[agent-worker] tick failed", e);
  }
}

await tick();
setInterval(tick, INTERVAL_MS);
