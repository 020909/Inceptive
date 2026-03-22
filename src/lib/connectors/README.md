# Connectors

| Module | Role |
|--------|------|
| `browser.ts` | Safe HTTP search (DDG) + HTML strip fetch — shared semantics with the dashboard agent. |
| `gmail.ts` | Checks `connected_accounts` for `gmail` — extend with Gmail API for true inbox automation. |
| `slack.ts` | Optional workspace bot via `SLACK_BOT_TOKEN` + `SLACK_DEFAULT_CHANNEL`. |
| `computer-use.ts` | Stub plan only — swap for Playwright/VM when ready. |

Register new connectors in `registry.ts` and extend `ALLOWED_KINDS` in `src/app/api/agent/jobs/route.ts`.
