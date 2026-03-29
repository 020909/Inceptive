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

  // Reports write check (requires auth token)
  if (token) {
    const res = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ template: "Weekly Summary" }),
    });
    const json = await res.json().catch(() => ({}));
    results.push({
      check: "reports_post",
      ok: res.ok && Boolean(json?.report),
      status: res.status,
      body: json,
    });
  } else {
    results.push({
      check: "reports_post",
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

