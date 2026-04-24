export type ChurnRisk = "high" | "medium" | "healthy";

export type ChurnAccount = {
  user_id: string;
  email: string | null;
  account_name: string;
  plan: string | null;
  last_login_at: string | null;
  usage_this_week: number;
  usage_last_week: number;
  support_ticket_count: number;
  login_score: number;
  usage_score: number;
  ticket_score: number;
  health_score: number;
  churn_risk: ChurnRisk;
  analyzed_at: string;
};

export type ChurnMemory = {
  id: string;
  memory: string;
  metadata?: {
    scope?: "session" | "user" | "agent";
    [key: string]: unknown;
  };
  created_at?: string | null;
  updated_at?: string | null;
};

export type ChurnResponse = {
  last_run_at: string | null;
  count: number;
  memories?: ChurnMemory[];
  accounts: ChurnAccount[];
};

export type ChurnMemoryResponse = {
  count: number;
  memories: ChurnMemory[];
};

export type JobSchedule = {
  id: string;
  user_id: string;
  agent_id: string;
  enabled: boolean;
  interval_minutes: number;
  run_at: string | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: "success" | "failed" | "running" | "skipped" | null;
  last_error: string | null;
};

export type JobRun = {
  id: string;
  status: "running" | "success" | "failed" | "skipped";
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
};

export type JobStatusItem = {
  schedule: JobSchedule;
  last_run: JobRun | null;
};

export type JobStatusResponse = {
  count: number;
  jobs: JobStatusItem[];
};

export type RevenueSeverity = "critical" | "warning" | "info";

export type RevenueSignalType =
  | "expiring_contract"
  | "billing_anomaly"
  | "missed_upsell"
  | "payment_failure"
  | "inactive_high_value"
  | "discount_abuse";

export type RevenueSignal = {
  id: string;
  account_id: string;
  signal_type: RevenueSignalType;
  severity: RevenueSeverity;
  dollar_impact: number;
  description: string;
  recommended_action: string;
  detected_at: string;
  status: "open" | "resolved";
  resolution_note?: string | null;
  resolved_at?: string | null;
};

export type RevenueSignalsResponse = {
  count: number;
  signals: RevenueSignal[];
};

export type RevenueSummary = {
  total_open_leakage: number;
  critical_count: number;
  warning_count: number;
  signals_resolved_this_month: number;
  estimated_recovered: number;
};

export type RevenueRunResponse = {
  detected_at: string;
  total_leakage: number;
  critical_count: number;
  warning_count: number;
  findings: RevenueSignal[];
};

export type VendorSeverity = "critical" | "warning" | "info";

export type VendorAlertType =
  | "sla_breach"
  | "overbilling"
  | "upcoming_renewal"
  | "underperforming_vendor";

export type VendorAlert = {
  id: string;
  vendor_id: string;
  alert_type: VendorAlertType;
  severity: VendorSeverity;
  description: string;
  dollar_impact: number;
  detected_at: string;
  status: "open" | "resolved";
  resolution_note?: string | null;
  resolved_at?: string | null;
  vendors?: { name?: string | null } | null;
};

export type VendorAlertsResponse = {
  count: number;
  alerts: VendorAlert[];
};

export type VendorSummary = {
  total_vendors: number;
  overbilling_detected: number;
  renewals_due: number;
  sla_breaches_this_month: number;
  critical_count: number;
};

export type VendorRunResponse = {
  detected_at: string;
  total_overbilling: number;
  renewal_value_at_risk: number;
  breach_count: number;
  alerts: VendorAlert[];
};

export type ParsedInvoiceLineItem = {
  description: string;
  amount: number;
};

export type ParsedInvoicePayload = {
  vendor_name: string | null;
  amount: number | null;
  due_date: string | null;
  line_items: ParsedInvoiceLineItem[];
  raw_text: string;
};

export type ParseInvoiceResponse = {
  saved: boolean;
  extracted: ParsedInvoicePayload;
  invoice?: {
    id: string;
    vendor_id: string;
    amount: number;
    due_date: string | null;
    status: string;
  } | null;
};

export type ScheduleJobPayload = {
  user_id: string;
  agent_id?: string;
  enabled: boolean;
  interval_minutes?: number;
  run_at?: string | null;
  timezone?: string;
};

type RequestOptions = {
  accessToken?: string | null;
  method?: "GET" | "POST";
  body?: unknown;
};

function getBackendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
}

async function backendRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Backend request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listChurnSignals(accessToken?: string | null) {
  return backendRequest<ChurnResponse>("/api/agents/churn", { accessToken });
}

export async function runChurnAgent(accessToken?: string | null) {
  return backendRequest<ChurnResponse>("/api/agents/churn/run", {
    method: "POST",
    accessToken,
  });
}

export async function listChurnMemories(userId: string, accessToken?: string | null) {
  return backendRequest<ChurnMemoryResponse>(
    `/api/agents/churn/memories?user_id=${encodeURIComponent(userId)}`,
    { accessToken }
  );
}

export async function scheduleAgentRun(payload: ScheduleJobPayload, accessToken?: string | null) {
  return backendRequest<{ schedule: JobSchedule }>("/api/jobs/schedule", {
    method: "POST",
    body: payload,
    accessToken,
  });
}

export async function getJobStatus(userId: string, agentId = "churn_agent", accessToken?: string | null) {
  return backendRequest<JobStatusResponse>(
    `/api/jobs/status?user_id=${encodeURIComponent(userId)}&agent_id=${encodeURIComponent(agentId)}`,
    { accessToken }
  );
}

export async function getRevenueSummary(accessToken?: string | null) {
  return backendRequest<RevenueSummary>("/api/agents/revenue/summary", { accessToken });
}

export async function listRevenueSignals(
  params: {
    severity?: RevenueSeverity | null;
    signalType?: RevenueSignalType | null;
    limit?: number;
  } = {},
  accessToken?: string | null
) {
  const search = new URLSearchParams();
  if (params.severity) search.set("severity", params.severity);
  if (params.signalType) search.set("signal_type", params.signalType);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return backendRequest<RevenueSignalsResponse>(
    `/api/agents/revenue/signals${query ? `?${query}` : ""}`,
    { accessToken }
  );
}

export async function runRevenueAgent(accessToken?: string | null) {
  return backendRequest<RevenueRunResponse>("/api/agents/revenue/run", {
    method: "POST",
    accessToken,
  });
}

export async function resolveRevenueSignal(
  signalId: string,
  resolution_note: string | null,
  accessToken?: string | null
) {
  return backendRequest<{ signal: RevenueSignal }>(`/api/agents/revenue/resolve/${encodeURIComponent(signalId)}`, {
    method: "POST",
    body: { resolution_note },
    accessToken,
  });
}

export async function getVendorSummary(accessToken?: string | null) {
  return backendRequest<VendorSummary>("/api/agents/vendor/summary", { accessToken });
}

export async function listVendorAlerts(
  params: {
    severity?: VendorSeverity | null;
    alertType?: VendorAlertType | null;
    limit?: number;
  } = {},
  accessToken?: string | null
) {
  const search = new URLSearchParams();
  if (params.severity) search.set("severity", params.severity);
  if (params.alertType) search.set("alert_type", params.alertType);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return backendRequest<VendorAlertsResponse>(
    `/api/agents/vendor/alerts${query ? `?${query}` : ""}`,
    { accessToken }
  );
}

export async function runVendorAgent(accessToken?: string | null) {
  return backendRequest<VendorRunResponse>("/api/agents/vendor/run", {
    method: "POST",
    accessToken,
  });
}

export async function resolveVendorAlert(
  alertId: string,
  resolution_note: string | null,
  accessToken?: string | null
) {
  return backendRequest<{ alert: VendorAlert }>(`/api/agents/vendor/resolve/${encodeURIComponent(alertId)}`, {
    method: "POST",
    body: { resolution_note },
    accessToken,
  });
}

export async function parseVendorInvoice(
  file: File,
  options: {
    confirm?: boolean;
    vendorId?: string | null;
  } = {},
  accessToken?: string | null
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("confirm", String(Boolean(options.confirm)));
  if (options.vendorId) formData.append("vendor_id", options.vendorId);

  const response = await fetch(`${getBackendUrl()}/api/vendors/parse-invoice`, {
    method: "POST",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Backend request failed with status ${response.status}`);
  }

  return response.json() as Promise<ParseInvoiceResponse>;
}
