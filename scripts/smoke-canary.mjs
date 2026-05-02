#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL || "https://app.inceptive-ai.com";
const token = process.env.SMOKE_BEARER_TOKEN || "";

async function run() {
  const results = [];

  // Health check
  {
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json().catch(() => ({}));
    results.push({
      check: "health",
      ok: res.ok && json.ok === true,
      status: res.status,
      body: json,
    });
  }

  // Approval-queue read check (requires auth token)
  if (token) {
    const res = await fetch(`${baseUrl}/api/approval-queue`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    results.push({
      check: "approval_queue",
      ok: res.ok,
      status: res.status,
      body: json,
    });
  } else {
    results.push({
      check: "approval_queue",
      ok: false,
      status: 0,
      body: { error: "SMOKE_BEARER_TOKEN not set" },
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
  if (failed.length) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

