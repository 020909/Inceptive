import { executeAgentJob } from "./executor";
import { claimNextDueJob, completeJob } from "./task-queue";
import type { AgentJobRow } from "./types";

/**
 * OpenManus: POST task to external server. Job kinds are primarily implemented in
 * executor.ts (executeAgentJob); openmanus.task is handled here before dispatch.
 */
async function runOpenManusTaskJob(job: AgentJobRow): Promise<void> {
  const task = String((job.payload as { task?: string }).task ?? "");
  const baseUrl = (process.env.OPENMANUS_API_URL?.trim() || "http://localhost:8000").replace(/\/$/, "");
  const url = `${baseUrl}/api/v1/tasks`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      await completeJob(job.id, {
        error: "OpenManus not connected",
        hint: "Set OPENMANUS_API_URL in your .env.local",
      });
      return;
    }
    await completeJob(job.id, data);
  } catch {
    await completeJob(job.id, {
      error: "OpenManus not connected",
      hint: "Set OPENMANUS_API_URL in your .env.local",
    });
  }
}

/**
 * Single tick: process up to `max` jobs. Invoked by cron/worker HTTP.
 */
export async function runAgentOrchestratorTick(max = 3): Promise<{ processed: number }> {
  let processed = 0;
  for (let i = 0; i < max; i++) {
    const job = await claimNextDueJob();
    if (!job) break;
    if (job.kind === "openmanus.task") {
      await runOpenManusTaskJob(job);
    } else {
      await executeAgentJob(job);
    }
    processed++;
  }
  return { processed };
}
