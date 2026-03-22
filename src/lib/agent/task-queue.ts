import { createClient } from "@supabase/supabase-js";
import type { AgentJobRow } from "./types";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function enqueueJob(input: {
  userId: string;
  kind: string;
  payload?: Record<string, unknown>;
  scheduleCron?: string | null;
  nextRunAt?: string | null;
}) {
  const { data, error } = await admin()
    .from("agent_jobs")
    .insert({
      user_id: input.userId,
      kind: input.kind,
      payload: input.payload ?? {},
      schedule_cron: input.scheduleCron ?? null,
      next_run_at: input.nextRunAt ?? new Date().toISOString(),
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as AgentJobRow;
}

export async function listJobsForUser(userId: string, limit = 50) {
  const { data, error } = await admin()
    .from("agent_jobs")
    .select(
      "id, user_id, status, kind, payload, result, error, logs, attempts, max_attempts, schedule_cron, next_run_at, last_run_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AgentJobRow[];
}

/** Claim the next due job (service role only). */
export async function claimNextDueJob(): Promise<AgentJobRow | null> {
  const now = new Date().toISOString();
  const { data: rows, error } = await admin()
    .from("agent_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("next_run_at", now)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !rows?.length) return null;
  const job = rows[0] as AgentJobRow;

  const { data: updated, error: upErr } = await admin()
    .from("agent_jobs")
    .update({ status: "running", last_run_at: now, attempts: job.attempts + 1 })
    .eq("id", job.id)
    .eq("status", "pending")
    .select()
    .single();
  if (upErr || !updated) return null;
  return updated as AgentJobRow;
}

export async function appendLog(jobId: string, line: string) {
  const { data: row } = await admin().from("agent_jobs").select("logs").eq("id", jobId).single();
  const logs = Array.isArray(row?.logs) ? [...(row!.logs as unknown[])] : [];
  logs.push({ t: new Date().toISOString(), m: line });
  await admin().from("agent_jobs").update({ logs }).eq("id", jobId);
}

export async function completeJob(jobId: string, result: Record<string, unknown>) {
  await admin()
    .from("agent_jobs")
    .update({ status: "completed", result, error: null })
    .eq("id", jobId);
}

export async function failJob(jobId: string, message: string) {
  await admin().from("agent_jobs").update({ status: "failed", error: message }).eq("id", jobId);
}

export async function requeueOrFail(job: AgentJobRow, message: string) {
  if (job.attempts >= job.max_attempts) {
    await failJob(job.id, message);
    return;
  }
  await admin()
    .from("agent_jobs")
    .update({
      status: "pending",
      error: message,
      next_run_at: new Date(Date.now() + 60_000).toISOString(),
    })
    .eq("id", job.id);
}
