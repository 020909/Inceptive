/**
 * Shared Judge0 submission (used by /api/code/execute and the agent runCode tool).
 */
export type Judge0RunResult = {
  ok: boolean;
  status?: unknown;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string | null;
  memory?: string | null;
  token?: string | null;
  error?: string;
  details?: unknown;
};

export function getJudge0Config() {
  const base = (process.env.JUDGE0_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.JUDGE0_API_KEY || "").trim();
  return { base, token };
}

export function isJudge0Configured(): boolean {
  return Boolean(getJudge0Config().base);
}

export async function runJudge0Submission(opts: {
  source_code: string;
  language_id: number;
  stdin?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wait?: boolean;
}): Promise<Judge0RunResult> {
  const { base, token } = getJudge0Config();
  if (!base) {
    return { ok: false, error: "Code execution is not configured. Set JUDGE0_URL (e.g. https://judge0-ce.p.rapidapi.com or your instance)." };
  }

  const wait = opts.wait ?? true;

  try {
    const createRes = await fetch(`${base}/submissions${wait ? "?wait=true" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Auth-Token": token } : {}),
      },
      body: JSON.stringify({
        source_code: opts.source_code,
        language_id: opts.language_id,
        stdin: opts.stdin || "",
        cpu_time_limit: opts.cpu_time_limit ?? 5,
        memory_limit: opts.memory_limit ?? 256000,
      }),
      signal: AbortSignal.timeout(wait ? 25000 : 10000),
    });

    const createJson = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      return {
        ok: false,
        error: (createJson as any)?.message || "Judge0 request failed",
        details: createJson,
      };
    }

    if (wait) {
      return {
        ok: true,
        status: createJson?.status ?? null,
        stdout: createJson?.stdout || "",
        stderr: createJson?.stderr || "",
        compile_output: createJson?.compile_output || "",
        time: createJson?.time ?? null,
        memory: createJson?.memory ?? null,
        token: createJson?.token ?? null,
      };
    }

    return {
      ok: true,
      token: createJson?.token ?? null,
      error: undefined,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Code execution failed" };
  }
}

/** Common Judge0 CE language ids (instance-dependent; 71/63 are widely used). */
export const JUDGE0_LANGUAGE_IDS = {
  python: 71,
  javascript: 63,
} as const;
