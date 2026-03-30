import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { isPistonConfigured, runPistonSubmission } from "@/lib/code/piston-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExecuteSchema = z.object({
  source_code: z.string().min(1).max(20000),
  language_id: z.string(),
  stdin: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = ExecuteSchema.parse(await req.json());

    const result = await runPistonSubmission({
      source_code: parsed.source_code,
      language_id: parsed.language_id,
      stdin: parsed.stdin,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Execution failed", details: result.details },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: result.status || null,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      compile_output: result.compile_output || "",
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid payload", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Code execution failed" }, { status: 500 });
  }
}
