# OpenManus / AI·ML API + OpenRouter (free option)

This app can run `openmanus.task` jobs via **AI·ML API** (paid) or **OpenRouter** (free models available). Authenticated HTTP APIs live under `/api/openmanus/*`.

## Free / zero-AIML setup (OpenRouter)

You do **not** need `OPENMANUS_API_KEY` if you use OpenRouter:

1. Create a key at [openrouter.ai](https://openrouter.ai) (free tier includes access to free models).
2. Set **`OPENROUTER_KEY`** in `.env.local` / Vercel (you may already have this for the rest of Inceptive).
3. Optionally set **`OPENMANUS_PROVIDER=auto`** (default): if no AIML key is present, tasks automatically use OpenRouter.
4. Optional: **`OPENMANUS_OPENROUTER_MODEL=openrouter/free`** — routes to a free model (default in code). You can switch to another OpenRouter slug if needed.

**Limits:** “Free” still means provider terms, rate limits, and availability — not unlimited. Video polling (`GET /api/openmanus/task/[id]`) still requires **AI·ML API** for AIML’s video endpoints.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENMANUS_PROVIDER` | No | `auto` (default): AIML if `OPENMANUS_API_KEY` / `AIMLAPI_KEY` is set, else OpenRouter if `OPENROUTER_KEY` is set. `aimlapi` / `openrouter` to force one backend. |
| `OPENMANUS_API_KEY` | For AIML only | Bearer token for [aimlapi.com](https://aimlapi.com). |
| `AIMLAPI_KEY` | Alternative to above | Used if `OPENMANUS_API_KEY` is empty. |
| `OPENROUTER_KEY` | For free tier path | Used when AIML is not configured or `OPENMANUS_PROVIDER=openrouter`. |
| `OPENMANUS_OPENROUTER_MODEL` | No | Default `openrouter/free`. Only used for the OpenRouter backend. |
| `AIMLAPI_BASE_URL` | No | Default `https://api.aimlapi.com`. |
| `OPENMANUS_TASK_ENDPOINT` | No | AIML only. Default `/v1/chat/completions`. |
| `OPENMANUS_DEFAULT_MODEL` | No | AIML chat model when using AIML backend (see client default). |
| `OPENMANUS_WEBHOOK_SECRET` | No | If set, `POST /api/openmanus/webhook` requires header `X-OpenManus-Secret` to match. |

**Vercel:** add the same variables to Production and Preview. Never commit keys to git.

**Local:** add to `.env.local` (ignored by git).

## Important: `/v2/task.create`

A direct `POST https://api.aimlapi.com/v2/task.create` returns **404** on the public API (verified). Until AIML exposes that route, this integration **defaults to** `POST /v1/chat/completions` with your task string as the user message — the standard, documented way to run a model on AIML.

To use **video generation** (async), set `OPENMANUS_TASK_ENDPOINT=/v2/video/generations` and extend the request body in code to match [the video model docs](https://docs.aimlapi.com/) (model + prompt, etc.). Poll with `GET /api/openmanus/task/[generation_id]` which maps to AIML `GET /v2/video/generations?generation_id=…`.

## Agent jobs (`openmanus.task`)

- Enqueue via `POST /api/agent/jobs` with `{ "kind": "openmanus.task", "payload": { "task": "…", "model": "optional/model-id" } }`.
- The orchestrator calls `createOpenManusTask` and stores the JSON result (or a user-safe error) on the job row.

## App routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/openmanus/task/create` | Supabase session or `Authorization: Bearer <jwt>` | Run a task (default: chat completion). Body: `{ "task": string, "model"?: string }`. |
| `GET` | `/api/openmanus/task/[taskId]` | Same | Poll async generation status (video). `taskId` = AIML `generation_id`. |
| `POST` | `/api/openmanus/webhook` | Optional `X-OpenManus-Secret` | Acknowledge provider webhooks; extend to persist updates. |

## Errors

The client maps HTTP status to safe messages: **401** (bad key), **429** (rate limit), **5xx** (retry with backoff), network/timeouts. See `OpenManusClientError` in `src/lib/openmanus/client.ts`.

## Code map

- `src/lib/openmanus/client.ts` — Bearer auth, retries, typed errors.
- `src/lib/agent/orchestrator.ts` — runs `openmanus.task` jobs.
- `src/app/api/openmanus/**` — Next.js Route Handlers.

## References

- [AI·ML API docs](https://docs.aimlapi.com/)
- [Errors and messages](https://docs.aimlapi.com/errors-and-messages)
