import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { trackEvent } from "@/lib/analytics";
import { inngest } from "@/lib/inngest/client";
import { createNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/supabase/activity";
import { queryActivateWorkflow, queryUpdateWorkflowStatus } from "@/lib/supabase/workflows-core";

export type GovernanceSupabaseClient = SupabaseClient<any, "public", any>;

export type ReviewQueueRequestType = "manual_run" | "workflow_activate" | "workflow_status_change";
export type ReviewQueueStatus = "pending" | "approved" | "rejected";

export interface OrganizationGovernanceSettings {
  organization_id: string;
  manual_runs_require_approval: boolean;
  workflow_changes_require_approval: boolean;
  notify_admins_on_review_requests: boolean;
  require_rejection_reason: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewQueueItem {
  id: string;
  organization_id: string;
  requested_by: string | null;
  request_type: ReviewQueueRequestType;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  status: ReviewQueueStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  resolution_metadata: Record<string, unknown>;
  reviewed_at: string | null;
  created_at: string;
}

export interface ReviewQueueItemWithRequester extends ReviewQueueItem {
  requester_email: string | null;
  requester_name: string;
  reviewer_email: string | null;
  reviewer_name: string | null;
}

type ManualRunPayload = {
  orgSlug: string;
  userId: string;
  userEmail: string;
  userName: string;
  workflows?: string[];
};

type WorkflowActivatePayload = {
  templateId: string;
  templateName?: string;
  activatedBy: string;
};

type WorkflowStatusPayload = {
  orgWorkflowId: string;
  workflowName?: string;
  nextStatus: "active" | "paused";
};

const DEFAULT_ORG_GOVERNANCE_SETTINGS = {
  manual_runs_require_approval: false,
  workflow_changes_require_approval: false,
  notify_admins_on_review_requests: true,
  require_rejection_reason: true,
} as const;

function getServiceRoleClient(): GovernanceSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey);
}

function titleCaseEmailPrefix(value: string | null | undefined) {
  const prefix = (value ?? "member").split("@")[0] ?? "member";
  return prefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function coercePayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asGovernanceSettings(
  organizationId: string,
  row?: Partial<OrganizationGovernanceSettings> | null
): OrganizationGovernanceSettings {
  return {
    organization_id: organizationId,
    manual_runs_require_approval:
      row?.manual_runs_require_approval ?? DEFAULT_ORG_GOVERNANCE_SETTINGS.manual_runs_require_approval,
    workflow_changes_require_approval:
      row?.workflow_changes_require_approval ?? DEFAULT_ORG_GOVERNANCE_SETTINGS.workflow_changes_require_approval,
    notify_admins_on_review_requests:
      row?.notify_admins_on_review_requests ?? DEFAULT_ORG_GOVERNANCE_SETTINGS.notify_admins_on_review_requests,
    require_rejection_reason:
      row?.require_rejection_reason ?? DEFAULT_ORG_GOVERNANCE_SETTINGS.require_rejection_reason,
    updated_by: row?.updated_by ?? null,
    created_at: row?.created_at ?? new Date(0).toISOString(),
    updated_at: row?.updated_at ?? new Date(0).toISOString(),
  };
}

async function getProfileMap(
  supabase: GovernanceSupabaseClient,
  userIds: string[]
): Promise<Map<string, { email: string | null; name: string }>> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return new Map<string, { email: string | null; name: string }>();
  }

  const profileClient = getServiceRoleClient() ?? supabase;
  const { data, error } = await profileClient
    .from("users")
    .select("id, email")
    .in("id", uniqueUserIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (data ?? []).map((profile) => [
      profile.id as string,
      {
        email: profile.email as string | null,
        name: titleCaseEmailPrefix(profile.email as string | null),
      },
    ])
  );
}

async function getActiveOrgAdmins(
  supabase: GovernanceSupabaseClient,
  orgId: string
): Promise<Array<{ userId: string; email: string | null; name: string }>> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "admin")
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  const userIds = (data ?? [])
    .map((row) => row.user_id as string | null)
    .filter((value): value is string => Boolean(value));

  const profileMap = await getProfileMap(supabase, userIds);

  return userIds.map((userId) => ({
    userId,
    email: profileMap.get(userId)?.email ?? null,
    name: profileMap.get(userId)?.name ?? "Admin",
  }));
}

async function getOrgSlug(
  supabase: GovernanceSupabaseClient,
  orgId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.slug as string | undefined) ?? null;
}

async function executeReviewQueueApproval(
  supabase: GovernanceSupabaseClient,
  item: ReviewQueueItem
): Promise<Record<string, unknown>> {
  if (item.request_type === "manual_run") {
    const payload = item.payload as ManualRunPayload;

    await inngest.send({
      name: "agent/overnight.triggered",
      data: {
        orgId: item.organization_id,
        orgSlug: payload.orgSlug,
        userId: payload.userId,
        userEmail: payload.userEmail,
        userName: payload.userName,
        workflows: payload.workflows ?? [],
      },
    });

    void trackEvent(item.organization_id, payload.userId, "agent_run_triggered", {
      org_id: item.organization_id,
      trigger_type: "approval_queue",
    });

    await createNotification({
      userId: payload.userId,
      orgId: item.organization_id,
      title: "Workspace run approved",
      message: "Your AI run has started after admin approval.",
      type: "success",
      link: `/org/${payload.orgSlug}/activity`,
    });

    return {
      triggered: true,
      orgSlug: payload.orgSlug,
      workflows: payload.workflows ?? [],
    };
  }

  if (item.request_type === "workflow_activate") {
    const payload = item.payload as WorkflowActivatePayload;
    const activated = await queryActivateWorkflow(supabase, {
      organizationId: item.organization_id,
      templateId: payload.templateId,
      activatedBy: payload.activatedBy,
      settings: {},
    });

    await createNotification({
      userId: payload.activatedBy,
      orgId: item.organization_id,
      title: "Workflow approved",
      message: `${payload.templateName ?? "Workflow"} is now active.`,
      type: "success",
      link: undefined,
    });

    return {
      workflowId: activated.id,
      templateId: payload.templateId,
      status: activated.status,
    };
  }

  const payload = item.payload as WorkflowStatusPayload;
  const updated = await queryUpdateWorkflowStatus(supabase, payload.orgWorkflowId, payload.nextStatus);

  if (item.requested_by) {
    await createNotification({
      userId: item.requested_by,
      orgId: item.organization_id,
      title: "Workflow change approved",
      message: `${payload.workflowName ?? "Workflow"} is now ${payload.nextStatus}.`,
      type: "success",
      link: undefined,
    });
  }

  return {
    workflowId: updated.id,
    status: updated.status,
  };
}

export async function queryGetOrganizationGovernanceSettings(
  supabase: GovernanceSupabaseClient,
  organizationId: string
): Promise<OrganizationGovernanceSettings> {
  const { data, error } = await supabase
    .from("organization_settings")
    .select(
      "organization_id, manual_runs_require_approval, workflow_changes_require_approval, notify_admins_on_review_requests, require_rejection_reason, updated_by, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return asGovernanceSettings(organizationId, data as Partial<OrganizationGovernanceSettings> | null);
}

export async function queryUpsertOrganizationGovernanceSettings(
  supabase: GovernanceSupabaseClient,
  params: {
    organizationId: string;
    updatedBy: string;
    settings: Partial<
      Pick<
        OrganizationGovernanceSettings,
        | "manual_runs_require_approval"
        | "workflow_changes_require_approval"
        | "notify_admins_on_review_requests"
        | "require_rejection_reason"
      >
    >;
  }
): Promise<OrganizationGovernanceSettings> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("organization_settings")
    .upsert(
      {
        organization_id: params.organizationId,
        ...DEFAULT_ORG_GOVERNANCE_SETTINGS,
        ...params.settings,
        updated_by: params.updatedBy,
        updated_at: now,
      },
      { onConflict: "organization_id" }
    )
    .select(
      "organization_id, manual_runs_require_approval, workflow_changes_require_approval, notify_admins_on_review_requests, require_rejection_reason, updated_by, created_at, updated_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(
    {
      organizationId: params.organizationId,
      userId: params.updatedBy,
      actionType: "settings_updated",
      title: "Workspace governance updated",
      description: "Updated workspace approval and review policies.",
      metadata: {
        manual_runs_require_approval: data.manual_runs_require_approval,
        workflow_changes_require_approval: data.workflow_changes_require_approval,
        notify_admins_on_review_requests: data.notify_admins_on_review_requests,
        require_rejection_reason: data.require_rejection_reason,
      },
    },
    supabase
  );

  return data as OrganizationGovernanceSettings;
}

export async function queryGetReviewQueue(
  supabase: GovernanceSupabaseClient,
  params: {
    organizationId: string;
    statuses?: ReviewQueueStatus[];
    limit?: number;
  }
): Promise<ReviewQueueItemWithRequester[]> {
  let query = supabase
    .from("agent_review_queue")
    .select(
      "id, organization_id, requested_by, request_type, title, description, payload, status, reviewed_by, review_notes, resolution_metadata, reviewed_at, created_at"
    )
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false });

  if (params.statuses?.length) {
    query = query.in("status", params.statuses);
  }

  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map((row) => ({
    ...row,
    payload: coercePayload(row.payload),
    resolution_metadata: coercePayload(row.resolution_metadata),
  })) as ReviewQueueItem[];

  const profileMap = await getProfileMap(
    supabase,
    items.flatMap((item) => [item.requested_by ?? "", item.reviewed_by ?? ""])
  );

  return items.map((item) => ({
    ...item,
    requester_email: item.requested_by ? profileMap.get(item.requested_by)?.email ?? null : null,
    requester_name: item.requested_by
      ? profileMap.get(item.requested_by)?.name ?? "Requester"
      : "System",
    reviewer_email: item.reviewed_by ? profileMap.get(item.reviewed_by)?.email ?? null : null,
    reviewer_name: item.reviewed_by ? profileMap.get(item.reviewed_by)?.name ?? "Reviewer" : null,
  }));
}

export async function queryCreateReviewRequest(
  supabase: GovernanceSupabaseClient,
  params: {
    organizationId: string;
    requestedBy: string;
    requestType: ReviewQueueRequestType;
    title: string;
    description?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<ReviewQueueItem> {
  const { data, error } = await supabase
    .from("agent_review_queue")
    .insert({
      organization_id: params.organizationId,
      requested_by: params.requestedBy,
      request_type: params.requestType,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      payload: params.payload ?? {},
      status: "pending",
    })
    .select(
      "id, organization_id, requested_by, request_type, title, description, payload, status, reviewed_by, review_notes, resolution_metadata, reviewed_at, created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logActivity(
    {
      organizationId: params.organizationId,
      userId: params.requestedBy,
      actionType: "approval_requested",
      title: params.title.trim(),
      description: params.description?.trim() || "Queued for admin review.",
      metadata: {
        review_queue_id: data.id,
        request_type: data.request_type,
      },
    },
    supabase
  );

  return {
    ...(data as ReviewQueueItem),
    payload: coercePayload((data as ReviewQueueItem).payload),
    resolution_metadata: coercePayload((data as ReviewQueueItem).resolution_metadata),
  };
}

export async function createReviewRequestWithNotifications(
  supabase: GovernanceSupabaseClient,
  params: {
    organizationId: string;
    requestedBy: string;
    requestType: ReviewQueueRequestType;
    title: string;
    description?: string | null;
    payload?: Record<string, unknown>;
  }
) {
  const [settings, item, orgSlug] = await Promise.all([
    queryGetOrganizationGovernanceSettings(supabase, params.organizationId),
    queryCreateReviewRequest(supabase, params),
    getOrgSlug(supabase, params.organizationId),
  ]);

  if (settings.notify_admins_on_review_requests) {
    const admins = await getActiveOrgAdmins(supabase, params.organizationId);
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.userId,
          orgId: params.organizationId,
          title: "Approval needed",
          message: params.title,
          type: "warning",
          link: orgSlug ? `/org/${orgSlug}/settings` : undefined,
        })
      )
    );
  }

  return item;
}

export async function queryResolveReviewRequest(
  supabase: GovernanceSupabaseClient,
  params: {
    reviewRequestId: string;
    reviewerId: string;
    status: Exclude<ReviewQueueStatus, "pending">;
    reviewNotes?: string | null;
  }
): Promise<ReviewQueueItem> {
  const { data: existing, error } = await supabase
    .from("agent_review_queue")
    .select(
      "id, organization_id, requested_by, request_type, title, description, payload, status, reviewed_by, review_notes, resolution_metadata, reviewed_at, created_at"
    )
    .eq("id", params.reviewRequestId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const item = {
    ...(existing as ReviewQueueItem),
    payload: coercePayload((existing as ReviewQueueItem).payload),
    resolution_metadata: coercePayload((existing as ReviewQueueItem).resolution_metadata),
  };

  if (item.status !== "pending") {
    return item;
  }

  const settings = await queryGetOrganizationGovernanceSettings(supabase, item.organization_id);
  const notes = params.reviewNotes?.trim() || null;

  if (params.status === "rejected" && settings.require_rejection_reason && !notes) {
    throw new Error("A rejection reason is required by workspace policy.");
  }

  const resolutionMetadata =
    params.status === "approved" ? await executeReviewQueueApproval(supabase, item) : {};

  const { data: updated, error: updateError } = await supabase
    .from("agent_review_queue")
    .update({
      status: params.status,
      reviewed_by: params.reviewerId,
      review_notes: notes,
      reviewed_at: new Date().toISOString(),
      resolution_metadata: resolutionMetadata,
    })
    .eq("id", params.reviewRequestId)
    .select(
      "id, organization_id, requested_by, request_type, title, description, payload, status, reviewed_by, review_notes, resolution_metadata, reviewed_at, created_at"
    )
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logActivity(
    {
      organizationId: item.organization_id,
      userId: params.reviewerId,
      actionType: params.status === "approved" ? "approval_approved" : "approval_rejected",
      title: item.title,
      description:
        params.status === "approved"
          ? "Approved and executed."
          : notes ?? "Rejected by workspace admin.",
      metadata: {
        review_queue_id: item.id,
        request_type: item.request_type,
      },
    },
    supabase
  );

  if (item.requested_by) {
    const orgSlug = await getOrgSlug(supabase, item.organization_id);
    await createNotification({
      userId: item.requested_by,
      orgId: item.organization_id,
      title: params.status === "approved" ? "Request approved" : "Request rejected",
      message:
        params.status === "approved"
          ? `${item.title} was approved by an admin.`
          : notes ?? `${item.title} was rejected by an admin.`,
      type: params.status === "approved" ? "success" : "error",
      link: orgSlug ? `/org/${orgSlug}/activity` : undefined,
    });
  }

  return {
    ...(updated as ReviewQueueItem),
    payload: coercePayload((updated as ReviewQueueItem).payload),
    resolution_metadata: coercePayload((updated as ReviewQueueItem).resolution_metadata),
  };
}
