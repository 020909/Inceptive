export type PistonRunResult = {
  ok: boolean;
  status?: string;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  error?: string;
  details?: unknown;
};

export const PISTON_LANGUAGE_IDS: Record<string, string> = {
  python: "python",
  javascript: "javascript",
};

export function isPistonConfigured(): boolean {
  return true; // Piston API is free and public
}

export async function runPistonSubmission(opts: {
  source_code: string;
  language_id: string; // 'python' or 'javascript'
  stdin?: string;
}): Promise<PistonRunResult> {
  try {
    const res = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: opts.language_id,
        version: "*", // Auto-resolves to latest available
        files: [{ content: opts.source_code }],
        stdin: opts.stdin || "",
      }),
      signal: AbortSignal.timeout(25000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, error: data?.message || "Piston request failed", details: data };
    }

    if (!data.run) {
      return { ok: false, error: "No run output from Piston", details: data };
    }

    return {
      ok: true,
      status: "Accepted",
      stdout: data.run.stdout || "",
      stderr: data.run.stderr || "",
      compile_output: data.compile?.output || "",
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Code execution failed" };
  }
}
