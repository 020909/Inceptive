import { NextResponse } from "next/server";

/** Liveness for Docker / load balancers — no auth, no DB. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "inceptive",
    ts: new Date().toISOString(),
    vercel: {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
    },
  });
}
