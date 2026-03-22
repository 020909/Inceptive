import { NextResponse } from "next/server";

/** Liveness for Docker / load balancers — no auth, no DB. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "inceptive",
    ts: new Date().toISOString(),
  });
}
