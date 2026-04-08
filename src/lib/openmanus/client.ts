/**
 * OpenManus / AI·ML API integration (https://api.aimlapi.com).
 * Auth: Authorization: Bearer <key>. Keys: OPENMANUS_API_KEY or AIMLAPI_KEY.
 *
 * Note: POST /v2/task.create is not exposed on the public API (returns 404).
 * Default task execution uses POST /v1/chat/completions (documented). Override with OPENMANUS_TASK_ENDPOINT.
 */

const DEFAULT_BASE = "https://api.aimlapi.com";
const DEFAULT_CHAT_MODEL = "google/gemma-3-4b-it";

export type OpenManusErrorCode =
  | "missing_api_key"
  | "unauthorized"
  | "rate_limited"
  | "bad_request"
  | "not_found"
  | "server_error"
  | "network"
  | "unknown";

export class OpenManusClientError extends Error {
  readonly code: OpenManusErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  /** Safe to show in UI */
  readonly userMessage: string;
  readonly body?: unknown;

  constructor(opts: {
    code: OpenManusErrorCode;
    message: string;
    userMessage: string;
    status?: number;
    requestId?: string;
    body?: unknown;
  }) {
    super(opts.message);
    this.name = "OpenManusClientError";
    this.code = opts.code;
    this.userMessage = opts.userMessage;
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.body = opts.body;
  }
}

export function getAimlApiKey(): string | null {
  const k =
    process.env.OPENMANUS_API_KEY?.trim() ||
    process.env.AIMLAPI_KEY?.trim() ||
    "";
  return k || null;
}

/** OpenRouter key — supports free models (e.g. openrouter/free) when AIML is not configured. */
export function getOpenRouterKey(): string | null {
  const k =
    process.env.OPENROUTER_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENROUTER_DEFAULT_KEY?.trim() ||
    "";
  return k || null;
}

export type OpenManusBackend = "aiml" | "openrouter";

/**
 * Which backend runs tasks:
 * - `auto` (default): AI·ML API if OPENMANUS_API_KEY / AIMLAPI_KEY is set, else OpenRouter if OPENROUTER_KEY is set.
 * - `aimlapi`: force AI·ML API only.
 * - `openrouter`: force OpenRouter only (free models available — set OPENMANUS_OPENROUTER_MODEL).
 */
export function resolveOpenManusBackend(): OpenManusBackend | null {
  const p = process.env.OPENMANUS_PROVIDER?.trim().toLowerCase();
  if (p === "aimlapi" || p === "aiml") {
    return getAimlApiKey() ? "aiml" : null;
  }
  if (p === "openrouter") {
    return getOpenRouterKey() ? "openrouter" : null;
  }
  if (p === "auto" || !p) {
    if (getAimlApiKey()) return "aiml";
    if (getOpenRouterKey()) return "openrouter";
    return null;
  }
  return null;
}

function getBaseUrl(): string {
  return (process.env.AIMLAPI_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.inceptive-ai.com";

function errorMessageFromBody(body: Record<string, unknown>): string {
  const nested = body.error;
  if (typeof nested === "object" && nested !== null && "message" in nested) {
    const m = (nested as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  if (typeof body.message === "string") return body.message;
  return "Request failed";
}

function mapStatusToError(status: number, body: Record<string, unknown>): OpenManusClientError {
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
  const msg = errorMessageFromBody(body) || `Request failed (${status})`;

  if (status === 401) {
    return new OpenManusClientError({
      code: "unauthorized",
      message: msg,
      status,
      requestId,
      body,
      userMessage: "API key was rejected. Check OPENMANUS_API_KEY (or AIMLAPI_KEY) in Vercel / .env.local.",
    });
  }
  if (status === 429) {
    return new OpenManusClientError({
      code: "rate_limited",
      message: msg,
      status,
      requestId,
      body,
      userMessage: "AI·ML API rate limit reached. Wait a moment or upgrade your plan at aimlapi.com.",
    });
  }
  if (status === 400) {
    return new OpenManusClientError({
      code: "bad_request",
      message: msg,
      status,
      requestId,
      body,
      userMessage: msg || "Invalid request to AI·ML API.",
    });
  }
  if (status === 404) {
    return new OpenManusClientError({
      code: "not_found",
      message: msg,
      status,
      requestId,
      body,
      userMessage: msg || "Endpoint or resource not found. Check OPENMANUS_TASK_ENDPOINT.",
    });
  }
  if (status >= 500) {
    return new OpenManusClientError({
      code: "server_error",
      message: msg,
      status,
      requestId,
      body,
      userMessage: "AI·ML API had a temporary error. Try again shortly.",
    });
  }
  return new OpenManusClientError({
    code: "unknown",
    message: msg,
    status,
    requestId,
    body,
    userMessage: msg || "Something went wrong calling AI·ML API.",
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

type FetchJsonResult<T> = { ok: true; data: T; status: number } | { ok: false; error: OpenManusClientError };

/**
 * Low-level JSON request with retries on transient failures.
 */
export async function aimlFetchJson<T = unknown>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
  retryOptions?: { maxRetries?: number }
): Promise<FetchJsonResult<T>> {
  const apiKey = getAimlApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: new OpenManusClientError({
        code: "missing_api_key",
        message: "Missing OPENMANUS_API_KEY or AIMLAPI_KEY",
        userMessage: "AI·ML API is not configured. Set OPENMANUS_API_KEY in Vercel or .env.local.",
      }),
    };
  }

  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const maxRetries = retryOptions?.maxRetries ?? 3;
  const timeoutMs = init.timeoutMs ?? 120_000;

  let lastErr: OpenManusClientError | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const method = (init.method || "GET").toUpperCase();
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" }),
          ...(init.headers as Record<string, string>),
        },
      });
      clearTimeout(t);

      const text = await res.text();
      let data: unknown = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (res.ok) {
        return { ok: true, data: data as T, status: res.status };
      }

      const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
      const err = mapStatusToError(res.status, body);

      const retryable = res.status === 502 || res.status === 503 || res.status === 504;
      if (retryable && attempt < maxRetries - 1) {
        await sleep(300 * Math.pow(2, attempt));
        lastErr = err;
        continue;
      }

      return { ok: false, error: err };
    } catch (e) {
      clearTimeout(t);
      const aborted = e instanceof Error && e.name === "AbortError";
      const network = new OpenManusClientError({
        code: "network",
        message: e instanceof Error ? e.message : String(e),
        userMessage: aborted
          ? "The AI·ML API request timed out. Try a shorter task or retry."
          : "Could not reach AI·ML API. Check your network and DNS.",
      });
      if (attempt < maxRetries - 1) {
        await sleep(300 * Math.pow(2, attempt));
        lastErr = network;
        continue;
      }
      return { ok: false, error: network };
    }
  }

  return { ok: false, error: lastErr! };
}

function mapOpenRouterStatusToError(status: number, body: Record<string, unknown>): OpenManusClientError {
  const msg = errorMessageFromBody(body) || `Request failed (${status})`;

  if (status === 401) {
    return new OpenManusClientError({
      code: "unauthorized",
      message: msg,
      status,
      body,
      userMessage: "OpenRouter rejected the API key. Check OPENROUTER_KEY in .env.local or Vercel.",
    });
  }
  if (status === 429) {
    return new OpenManusClientError({
      code: "rate_limited",
      message: msg,
      status,
      body,
      userMessage: "OpenRouter rate limit reached. Wait a few minutes or try again.",
    });
  }
  if (status === 400) {
    return new OpenManusClientError({
      code: "bad_request",
      message: msg,
      status,
      body,
      userMessage: msg || "Invalid request to OpenRouter.",
    });
  }
  if (status >= 500) {
    return new OpenManusClientError({
      code: "server_error",
      message: msg,
      status,
      body,
      userMessage: "OpenRouter had a temporary error. Try again shortly.",
    });
  }
  return new OpenManusClientError({
    code: "unknown",
    message: msg,
    status,
    body,
    userMessage: msg || "Something went wrong calling OpenRouter.",
  });
}

/**
 * OpenRouter chat completions (free models available, e.g. openrouter/free).
 */
async function openRouterFetchJson<T = unknown>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
  retryOptions?: { maxRetries?: number }
): Promise<FetchJsonResult<T>> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    return {
      ok: false,
      error: new OpenManusClientError({
        code: "missing_api_key",
        message: "Missing OPENROUTER_KEY",
        userMessage:
          "No OpenRouter key. Add OPENROUTER_KEY to .env.local (free models: set OPENMANUS_OPENROUTER_MODEL=openrouter/free).",
      }),
    };
  }

  const url = path.startsWith("http") ? path : `${OPENROUTER_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const maxRetries = retryOptions?.maxRetries ?? 3;
  const timeoutMs = init.timeoutMs ?? 120_000;

  let lastErr: OpenManusClientError | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const method = (init.method || "GET").toUpperCase();
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": OPENROUTER_APP_URL,
          "X-Title": "Inceptive AI",
          ...(method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" }),
          ...(init.headers as Record<string, string>),
        },
      });
      clearTimeout(t);

      const text = await res.text();
      let data: unknown = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (res.ok) {
        return { ok: true, data: data as T, status: res.status };
      }

      const body = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
      const err = mapOpenRouterStatusToError(res.status, body);

      const retryable = res.status === 502 || res.status === 503 || res.status === 504;
      if (retryable && attempt < maxRetries - 1) {
        await sleep(300 * Math.pow(2, attempt));
        lastErr = err;
        continue;
      }

      return { ok: false, error: err };
    } catch (e) {
      clearTimeout(t);
      const aborted = e instanceof Error && e.name === "AbortError";
      const network = new OpenManusClientError({
        code: "network",
        message: e instanceof Error ? e.message : String(e),
        userMessage: aborted
          ? "OpenRouter request timed out. Try a shorter task."
          : "Could not reach OpenRouter. Check your network.",
      });
      if (attempt < maxRetries - 1) {
        await sleep(300 * Math.pow(2, attempt));
        lastErr = network;
        continue;
      }
      return { ok: false, error: network };
    }
  }

  return { ok: false, error: lastErr! };
}

export type CreateTaskInput = {
  /** Natural-language task (mapped to chat user message by default). */
  task: string;
  /** Model id for chat completions (e.g. google/gemma-2-9b-it). */
  model?: string;
};

/**
 * Create / execute a task.
 * - **AI·ML API** when a key is available (or `OPENMANUS_PROVIDER=aimlapi`): POST `/v1/chat/completions` by default.
 * - **OpenRouter** (free models possible) when no AIML key and `OPENROUTER_KEY` is set, or `OPENMANUS_PROVIDER=openrouter`.
 */
export async function createOpenManusTask(input: CreateTaskInput): Promise<FetchJsonResult<Record<string, unknown>>> {
  const backend = resolveOpenManusBackend();
  if (!backend) {
    return {
      ok: false,
      error: new OpenManusClientError({
        code: "missing_api_key",
        message: "No backend configured",
        userMessage:
          "Add OPENMANUS_API_KEY (AI·ML API) or OPENROUTER_KEY (free-tier models). See OPENMANUS_INTEGRATION.md.",
      }),
    };
  }

  if (backend === "openrouter") {
    const model =
      input.model?.trim() ||
      process.env.OPENMANUS_OPENROUTER_MODEL?.trim() ||
      "openrouter/free";
    const body = {
      model,
      messages: [{ role: "user" as const, content: input.task }],
    };
    const r = await openRouterFetchJson<Record<string, unknown>>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!r.ok) return r;
    return { ok: true, data: { provider: "openrouter", ...r.data }, status: r.status };
  }

  const endpoint = (process.env.OPENMANUS_TASK_ENDPOINT?.trim() || "/v1/chat/completions").replace(
    /^([^/])/,
    "/$1"
  );
  const model =
    input.model?.trim() ||
    process.env.OPENMANUS_DEFAULT_MODEL?.trim() ||
    DEFAULT_CHAT_MODEL;

  const body = {
    model,
    messages: [{ role: "user" as const, content: input.task }],
  };

  const r = await aimlFetchJson<Record<string, unknown>>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) return r;
  return { ok: true, data: { provider: "aimlapi", ...r.data }, status: r.status };
}

/**
 * Poll async generation status (e.g. video) — GET /v2/video/generations?generation_id=
 */
export async function getGenerationStatus(generationId: string): Promise<FetchJsonResult<Record<string, unknown>>> {
  if (!getAimlApiKey()) {
    return {
      ok: false,
      error: new OpenManusClientError({
        code: "missing_api_key",
        message: "AIML key required for video status",
        userMessage:
          "Polling video generations requires AI·ML API (OPENMANUS_API_KEY). OpenRouter-only mode supports chat tasks only.",
      }),
    };
  }
  const q = new URLSearchParams({ generation_id: generationId });
  return aimlFetchJson<Record<string, unknown>>(`/v2/video/generations?${q.toString()}`, {
    method: "GET",
  });
}

export function resultToJobRecord(
  result: FetchJsonResult<Record<string, unknown>>
): Record<string, unknown> {
  if (result.ok) {
    return { ...result.data };
  }
  return {
    error: result.error.userMessage,
    code: result.error.code,
    requestId: result.error.requestId,
    hint: "Set OPENMANUS_API_KEY (AI·ML) or OPENROUTER_KEY (free). See OPENMANUS_INTEGRATION.md.",
  };
}
