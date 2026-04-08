import { executeAgentJob } from "./executor";
import { claimNextDueJob, completeJob } from "./task-queue";
import type { AgentJobRow } from "./types";
import { createOpenManusTask, resultToJobRecord } from "@/lib/openmanus/client";

/**
 * OpenManus / AI·ML API: task jobs are handled here (executor.ts handles other kinds).
 */
async function runOpenManusTaskJob(job: AgentJobRow): Promise<void> {
  const task = String((job.payload as { task?: string }).task ?? "");
  const model =
    typeof (job.payload as { model?: string }).model === "string"
      ? (job.payload as { model?: string }).model
      : undefined;

  const result = await createOpenManusTask({ task, model });
  await completeJob(job.id, resultToJobRecord(result));
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
