import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getIpAddressFromRequest, getTenantIdFromRequest } from "@/lib/ubo/requestContext";
import { generateText } from "ai";
import { buildModel } from "@/lib/ai-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
  }

let alertId: string | undefined;
let alert: any;
const admin = createAdminClient();

try {
  const body = (await request.json()) as { alertId: string };
  alertId = body.alertId;

  if (!alertId) {
    return NextResponse.json({ error: "Missing required field: alertId" }, { status: 400 });
  }

  const { data: fetchedAlert, error: fetchError } = await admin
      .from("alerts")
      .select("*")
      .eq("id", alertId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  alert = fetchedAlert;
  if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    if (alert.status !== "new" && alert.status !== "triaging") {
      return NextResponse.json({ error: "Alert already triaged" }, { status: 409 });
    }

    await admin
      .from("alerts")
      .update({ status: "triaging", updated_at: new Date().toISOString() })
      .eq("id", alertId);

    let relatedTransactions: any[] = [];
    if (alert.transaction_ids && alert.transaction_ids.length > 0) {
      const { data: txData } = await admin
        .from("transactions")
      .select("*")
      .in("id", alert.transaction_ids)
      .eq("tenant_id", tenantId);
      relatedTransactions = txData || [];
    }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }
  const model = buildModel(apiKey, "openai", "gpt-4o");

    const prompt = `You are an AML compliance analyst. Triage the following alert and provide a structured assessment.

ALERT DETAILS:
- Alert Number: ${alert.alert_number}
- Type: ${alert.alert_type}
- Severity: ${alert.severity}
- Description: ${alert.description || "N/A"}
- Entity: ${alert.entity_name || "Unknown"} (${alert.entity_type || "unknown"})
- Source: ${alert.source || "System-generated"}

RELATED TRANSACTIONS (${relatedTransactions.length}):
${relatedTransactions.map((tx: any, i: number) => `${i + 1}. ${tx.direction} $${tx.amount} ${tx.currency} — ${tx.counterparty_name || "Unknown counterparty"} on ${tx.transaction_date} — ${tx.description || "No description"}`).join("\n")}

Provide your triage assessment as JSON with the following structure:
{
  "risk_assessment": "low" | "medium" | "high" | "critical",
  "risk_score": <number 0-100>,
  "is_false_positive": <boolean>,
  "narrative": "<detailed analysis explaining your reasoning>",
  "recommended_action": "close_false_positive" | "escalate_for_investigation" | "file_sar" | "enhanced_due_diligence",
  "red_flags": ["<list of specific red flags identified>"],
  "recommended_next_steps": ["<list of recommended actions>"]
}

Respond ONLY with valid JSON, no markdown fences.`;

    const { text } = await generateText({ model, prompt });

    let triageResult: any;
    try {
      triageResult = JSON.parse(text);
    } catch {
      triageResult = { raw_response: text };
    }

    const newStatus = triageResult.is_false_positive ? "false_positive" : triageResult.recommended_action === "close_false_positive" ? "false_positive" : triageResult.recommended_action === "escalate_for_investigation" ? "escalated" : "escalated";

    const riskScore = typeof triageResult.risk_score === "number" ? Math.min(999.99, Math.max(0, triageResult.risk_score)) : null;

    await admin
      .from("alerts")
      .update({
        status: newStatus,
        risk_score: riskScore,
        triage_result: triageResult,
        triaged_by: userId,
        triaged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    await admin.from("audit_log").insert({
      tenant_id: tenantId,
      actor_id: userId,
      actor_email: "system@inceptive-ai.com",
      action_type: "aml_triage_completed",
      entity_type: "alert",
      entity_id: alertId,
      before_state: { status: alert.status, risk_score: alert.risk_score },
      after_state: { status: newStatus, risk_score: riskScore, triage_result: triageResult },
      ai_model_used: "gpt-4o",
      decision: newStatus,
      ip_address: getIpAddressFromRequest(request),
    });

    return NextResponse.json({ success: true, triageResult, newStatus, riskScore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to triage alert";
  console.error("Error triaging alert:", error);
  try {
    if (alertId && alert) await admin.from("alerts").update({ status: alert.status }).eq("id", alertId);
  } catch (_) { /* best effort */ }
  return NextResponse.json({ error: message }, { status: 500 });
  }
}
