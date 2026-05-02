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

  try {
    const body = (await request.json()) as { caseId: string; fincenFormType?: string };
    const { caseId, fincenFormType } = body;

    if (!caseId) {
      return NextResponse.json({ error: "Missing required field: caseId" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: caseData, error: caseErr } = await admin
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (caseErr) throw new Error(caseErr.message);
    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const { data: relatedAlerts, error: alertErr } = await admin
      .from("alerts")
      .select("*")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId);

    if (alertErr) throw new Error(alertErr.message);

    const { data: existingSars, error: sarsErr } = await admin
      .from("sar_drafts")
      .select("narrative_version")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .order("narrative_version", { ascending: false })
      .limit(1);

    if (sarsErr) throw new Error(sarsErr.message);

    const nextVersion = (existingSars?.[0]?.narrative_version || 0) + 1;

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }
    const model = buildModel(apiKey, "openai", "gpt-4o");

    const alertSummaries = (relatedAlerts || []).map((a: any) => ({
      alert_number: a.alert_number,
      alert_type: a.alert_type,
      severity: a.severity,
      description: a.description,
      entity_name: a.entity_name,
      triage_result: a.triage_result,
    }));

    const prompt = `You are a FinCEN SAR narrative drafter. Generate a Suspicious Activity Report narrative based on the following case data.

CASE DETAILS:
- Case Number: ${caseData.case_number}
- Case Type: ${caseData.case_type}
- Title: ${caseData.title}
- Description: ${caseData.description || "N/A"}
- Priority: ${caseData.priority}

RELATED ALERTS (${alertSummaries.length}):
${alertSummaries.map((a: any, i: number) => `${i + 1}. ${a.alert_number} — ${a.alert_type} (${a.severity}) — ${a.entity_name}: ${a.description}`).join("\n")}

Generate a FinCEN-compliant SAR narrative with the following JSON structure:
{
  "suspicious_activity_type": ["<FinCEN activity type codes>"],
  "narrative": "<The full SAR narrative in FinCEN format, 3-5 paragraphs covering: who, what, when, where, why, and how>",
  "subject_entities": [{"name": "<entity name>", "role": "<subject/counterparty>", "type": "<person/company>"}],
  "activity_start_date": "<estimated date>",
  "activity_end_date": "<estimated date>",
  "fincen_form_type": "${fincenFormType || "SAR-MSB"}",
  "key_red_flags": ["<list of specific red flags>"]
}

The narrative must follow FinCEN guidance:
1. Paragraph 1: Who is conducting the suspicious activity and their role
2. Paragraph 2: What type of activity is occurring and the dollar amounts
3. Paragraph 3: When the activity occurred and any patterns
4. Paragraph 4: Why the activity is suspicious
5. Paragraph 5: How the activity was conducted (methods, accounts, instruments)

Respond ONLY with valid JSON, no markdown fences.`;

    const { text } = await generateText({ model, prompt });

    let sarResult: any;
    try {
      sarResult = JSON.parse(text);
    } catch {
      sarResult = { narrative: text, fincen_form_type: fincenFormType || "SAR-MSB", status: "draft" };
    }

    const { data: newSar, error: insertErr } = await admin
      .from("sar_drafts")
      .insert({
        tenant_id: tenantId,
        case_id: caseId,
        fincen_form_type: sarResult.fincen_form_type || fincenFormType || "SAR-MSB",
        subject_entities: sarResult.subject_entities || [],
        suspicious_activity_type: sarResult.suspicious_activity_type || [],
        activity_start_date: sarResult.activity_start_date || null,
        activity_end_date: sarResult.activity_end_date || null,
        narrative_draft: sarResult.narrative || "",
        narrative_version: nextVersion,
        status: "draft",
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    await admin.from("approval_queue").insert({
      tenant_id: tenantId,
      case_type: "sar_draft",
      entity_id: newSar.id,
      entity_type: "sar_draft",
      ai_draft: sarResult,
      ai_confidence: 0.85,
      citations: { case_id: caseId, alert_count: alertSummaries.length },
      status: "pending",
    });

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const actorEmail = authUser?.user?.email || "system@inceptive-ai.com";

    await admin.from("audit_log").insert({
      tenant_id: tenantId,
      actor_id: userId,
      actor_email: actorEmail,
      action_type: "sar_narrative_generated",
      entity_type: "sar_draft",
      entity_id: newSar.id,
      before_state: null,
      after_state: { case_id: caseId, version: nextVersion, form_type: sarResult.fincen_form_type },
      ai_model_used: "gpt-4o",
      decision: "draft_generated",
      ip_address: getIpAddressFromRequest(request),
    });

    return NextResponse.json({ success: true, sar: newSar, narrative: sarResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate SAR";
    console.error("Error generating SAR:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
