import { executeAgentJob } from "./executor";
import { claimNextDueJob } from "./task-queue";

/**
 * Single tick: process up to `max` jobs. Invoked by cron/worker HTTP.
 */
export async function runAgentOrchestratorTick(max = 3): Promise<{ processed: number }> {
  let processed = 0;
  for (let i = 0; i < max; i++) {
    const job = await claimNextDueJob();
    if (!job) break;
    await executeAgentJob(job);
    processed++;
  }
  return { processed };
}
