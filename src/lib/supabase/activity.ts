import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AgentActivityActionType =
  | "email_drafted"
  | "email_sent"
  | "research_completed"
  | "lead_generated"
  | "report_generated"
  | "content_created"
  | "task_completed"
  | "browser_task"
  | "overnight_run_complete";

export type AgentActivityStatus = "completed" | "failed" | "in_progress";
export type ActivityFilterGroup = "all" | "emails" | "research" | "content" | "tasks";
export type ActivityDateRange = "today" | "this_week" | "this_month";

export interface AgentActivityLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action_type: AgentActivityActionType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  status: AgentActivityStatus;
  created_at: string;
}

export interface AgentActivityLogWithUser extends AgentActivityLog {
  user_name: string;
  user_email: string | null;
}

export interface ActivityFilters {
  actionGroup?: ActivityFilterGroup;
  dateRange?: ActivityDateRange;
  limit?: number;
  workflowSlug?: string;
}

type ActivitySupabaseClient = SupabaseClient<any, "public", any>;

const ACTION_GROUP_MAP: Record<Exclude<ActivityFilterGroup, "all">, AgentActivityActionType[]> = {
  emails: ["email_drafted", "email_sent"],
  research: ["research_completed", "lead_generated", "report_generated"],
  content: ["content_created"],
  tasks: ["task_completed"],
};

async function getSupabaseClient(client?: ActivitySupabaseClient) {
  return client ?? createServerSupabaseClient();
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey);
}

function titleCaseEmailPrefix(value: string | null | undefined) {
  const prefix = (value ?? "agent").split("@")[0] ?? "agent";
  return prefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStartDate(dateRange?: ActivityDateRange) {
  if (!dateRange) return null;

  const now = new Date();
  if (dateRange === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  if (dateRange === "this_week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export async function logActivity(
  params: {
    organizationId: string;
    userId?: string | null;
    actionType: AgentActivityActionType;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    status?: AgentActivityStatus;
  },
  client?: ActivitySupabaseClient
) {
  const supabase = await getSupabaseClient(client);

  const { data, error } = await supabase
    .from("agent_activity_log")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId ?? null,
      action_type: params.actionType,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      metadata: params.metadata ?? {},
      status: params.status ?? "completed",
    })
    .select("id, organization_id, user_id, action_type, title, description, metadata, status, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AgentActivityLog;
}

export async function getOrgActivity(
  orgId: string,
  filters: ActivityFilters = {},
  client?: ActivitySupabaseClient
): Promise<AgentActivityLogWithUser[]> {
  const supabase = await getSupabaseClient(client);

  let query = supabase
    .from("agent_activity_log")
    .select("id, organization_id, user_id, action_type, title, description, metadata, status, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters.actionGroup && filters.actionGroup !== "all") {
    query = query.in("action_type", ACTION_GROUP_MAP[filters.actionGroup]);
  }

  const startDate = getStartDate(filters.dateRange);
  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  let logs = (data ?? []) as AgentActivityLog[];
  if (filters.workflowSlug) {
    logs = logs.filter((log) => log.metadata?.workflow_slug === filters.workflowSlug);
  }
  const userIds = logs
    .map((log) => log.user_id)
    .filter((value): value is string => Boolean(value));

  const profileClient = getServiceRoleClient() ?? supabase;
  const profiles = userIds.length
    ? await profileClient.from("users").select("id, email").in("id", userIds)
    : { data: [], error: null };

  if (profiles.error) {
    throw new Error(profiles.error.message);
  }

  const profileMap = new Map(
    (profiles.data ?? []).map((profile) => [
      profile.id as string,
      {
        email: profile.email as string | null,
        name: titleCaseEmailPrefix(profile.email as string | null),
      },
    ])
  );

  return logs.map((log) => {
    const profile = log.user_id ? profileMap.get(log.user_id) : null;

    return {
      ...log,
      user_email: profile?.email ?? null,
      user_name: profile?.name ?? "Inceptive Agent",
    };
  });
}
