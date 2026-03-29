import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExecuteSchema = z.object({
  source_code: z.string().min(1).max(20000),
  language_id: z.number().int().positive(),
  stdin: z.string().max(5000).optional(),
  cpu_time_limit: z.number().positive().max(20).optional(),
  memory_limit: z.number().positive().max(512000).optional(),
  wait: z.boolean().optional(),
});

function getJudge0Config() {
  const base = (process.env.JUDGE0_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.JUDGE0_API_KEY || "").trim();
  return { base, token };
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { base, token } = getJudge0Config();
  if (!base) {
    return NextResponse.json(
      {
        error: "Code execution is not configured yet. Set JUDGE0_URL to enable this endpoint.",
      },
      { status: 501 }
    );
  }

  try {
    const parsed = ExecuteSchema.parse(await req.json());
    const wait = parsed.wait ?? true;

    const createRes = await fetch(`${base}/submissions${wait ? "?wait=true" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Auth-Token": token } : {}),
      },
      body: JSON.stringify({
        source_code: parsed.source_code,
        language_id: parsed.language_id,
        stdin: parsed.stdin || "",
        cpu_time_limit: parsed.cpu_time_limit ?? 5,
        memory_limit: parsed.memory_limit ?? 256000,
      }),
      signal: AbortSignal.timeout(wait ? 25000 : 10000),
    });

    const createJson = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      return NextResponse.json(
        { error: createJson?.message || "Judge0 request failed", details: createJson },
        { status: createRes.status }
      );
    }

    if (wait) {
      return NextResponse.json({
        status: createJson?.status || null,
        stdout: createJson?.stdout || "",
        stderr: createJson?.stderr || "",
        compile_output: createJson?.compile_output || "",
        time: createJson?.time || null,
        memory: createJson?.memory || null,
        token: createJson?.token || null,
      });
    }

    return NextResponse.json({
      queued: true,
      token: createJson?.token || null,
      message: "Submission queued on Judge0. Poll /submissions/{token} on your Judge0 host for status.",
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Code execution failed" }, { status: 500 });
  }
}
