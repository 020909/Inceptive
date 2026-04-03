import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { listUserSandboxFiles } from "@/lib/sandbox/user-artifacts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await listUserSandboxFiles(userId, 4);
  if (res.status === "error") {
    return NextResponse.json({ error: res.message }, { status: 500 });
  }

  return NextResponse.json(
    { root: res.root, paths: res.paths },
    { status: 200, headers: { "Cache-Control": "private, no-store" } }
  );
}

