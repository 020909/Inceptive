export type AgentJobStatus = "pending" | "running" | "completed" | "failed" | "paused";

export interface AgentJobRow {
  id: string;
  user_id: string;
  status: AgentJobStatus;
  kind: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  logs: unknown[];
  attempts: number;
  max_attempts: number;
  schedule_cron: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}
