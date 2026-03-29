import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { isJudge0Configured, runJudge0Submission } from "@/lib/code/judge0-client";

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

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isJudge0Configured()) {
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

    const result = await runJudge0Submission({
      source_code: parsed.source_code,
      language_id: parsed.language_id,
      stdin: parsed.stdin,
      cpu_time_limit: parsed.cpu_time_limit,
      memory_limit: parsed.memory_limit,
      wait,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Judge0 failed", details: result.details },
        { status: 502 }
      );
    }

    if (wait) {
      return NextResponse.json({
        status: result.status || null,
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        compile_output: result.compile_output || "",
        time: result.time || null,
        memory: result.memory || null,
        token: result.token || null,
      });
    }

    return NextResponse.json({
      queued: true,
      token: result.token || null,
      message: "Submission queued on Judge0. Poll /submissions/{token} on your Judge0 host for status.",
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Code execution failed" }, { status: 500 });
  }
}
