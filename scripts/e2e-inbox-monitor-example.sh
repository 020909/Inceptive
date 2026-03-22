#!/usr/bin/env bash
# Example: enqueue inbox monitor stub + trigger worker tick (local dev).
# Usage: export BASE_URL=http://localhost:3000 CRON_SECRET=... ACCESS_TOKEN=...
set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"
: "${CRON_SECRET:?Set CRON_SECRET}"
: "${ACCESS_TOKEN:?Supabase JWT for a test user}"

echo "1) Enqueue inbox.monitor.stub"
curl -sS -X POST "$BASE/api/agent/jobs" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind":"inbox.monitor.stub","payload":{}}' | jq .

echo "2) Drain queue (tick)"
curl -sS -X POST "$BASE/api/internal/agent-tick" \
  -H "x-cron-secret: $CRON_SECRET" | jq .

echo "3) List jobs"
curl -sS "$BASE/api/agent/jobs" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
