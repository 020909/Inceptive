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
    const body = (await request.json()) as {
      vendorId: string;
      vendorName: string;
      assessmentType?: string;
      reportContent?: string;
    };

    const { vendorId, vendorName, assessmentType = "soc2", reportContent } = body;

    if (!vendorId || !vendorName) {
      return NextResponse.json({ error: "vendorId and vendorName are required" }, { status: 400 });
    }

    const admin = createAdminClient();

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }
  const model = buildModel(apiKey, "openai", "gpt-4o");

    let prompt: string;

    if (reportContent) {
      prompt = `You are a vendor risk analyst. Analyze the following ${assessmentType.toUpperCase()} report for vendor "${vendorName}" and provide a structured risk assessment.

REPORT CONTENT:
${reportContent.slice(0, 6000)}

Provide your assessment as JSON:
{
  "risk_score": <number 0-100>,
  "risk_tier": "low" | "medium" | "high" | "critical",
  "findings": [{"category": "<category>", "severity": "low"|"medium"|"high"|"critical", "description": "<finding detail>", "recommendation": "<action>"}],
  "recommendations": "<overall recommendation summary>",
  "approval_recommendation": "approved" | "rejected" | "requires_review"
}

Respond ONLY with valid JSON, no markdown fences.`;
    } else {
      prompt = `You are a vendor risk analyst. Generate a preliminary risk assessment for vendor "${vendorName}" based on general due diligence principles. Since no specific report was provided, generate a placeholder assessment indicating review is needed.

Provide your assessment as JSON:
{
  "risk_score": <estimated score 0-100>,
  "risk_tier": "low" | "medium" | "high" | "critical",
  "findings": [{"category": "<category>", "severity": "low"|"medium"|"high"|"critical", "description": "<finding>", "recommendation": "<action>"}],
  "recommendations": "<recommendation>",
  "approval_recommendation": "requires_review"
}

Respond ONLY with valid JSON, no markdown fences.`;
    }

    const { text } = await generateText({ model, prompt });

    let assessmentResult: any;
    try {
      assessmentResult = JSON.parse(text);
    } catch {
      assessmentResult = { raw_response: text, risk_score: 50, risk_tier: "medium", approval_recommendation: "requires_review" };
    }

    const riskScore = typeof assessmentResult.risk_score === "number" ? assessmentResult.risk_score : null;
  const riskTier = ["low", "medium", "high", "critical"].includes(assessmentResult.risk_tier) ? assessmentResult.risk_tier : "medium";

  const validStatuses = ["pending", "approved", "rejected", "requires_review"] as const;
  const status = validStatuses.includes(assessmentResult.approval_recommendation as any)
    ? assessmentResult.approval_recommendation
    : "requires_review";

  const { data: assessment, error: insertErr } = await admin
    .from("vendor_assessments")
    .insert({
      tenant_id: tenantId,
      vendor_id: vendorId,
      assessment_type: assessmentType,
      risk_score: riskScore,
      risk_tier: riskTier,
      findings: assessmentResult.findings || [],
      recommendations: assessmentResult.recommendations || null,
      assessed_by: userId,
      assessed_at: new Date().toISOString(),
      status,
    })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    if (status === "requires_review" || status === "rejected") {
      await admin.from("approval_queue").insert({
        tenant_id: tenantId,
        case_type: "vendor_review",
        entity_id: assessment.id,
        entity_type: "vendor_assessment",
        ai_draft: assessmentResult,
        ai_confidence: riskScore !== null ? Math.max(0.1, 1 - riskScore / 100) : 0.5,
        citations: { vendor_name: vendorName, assessment_type: assessmentType },
        status: "pending",
      });
    }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const actorEmail = authUser?.user?.email || "system@inceptive-ai.com";

  await admin.from("audit_log").insert({
    tenant_id: tenantId,
    actor_id: userId,
    actor_email: actorEmail,
      action_type: "vendor_assessment_completed",
      entity_type: "vendor_assessment",
      entity_id: assessment.id,
      after_state: { vendor_name: vendorName, risk_score: riskScore, risk_tier: riskTier, recommendation: status },
      ai_model_used: "gpt-4o",
      ip_address: getIpAddressFromRequest(request),
    });

    return NextResponse.json({ success: true, assessment, result: assessmentResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment failed";
    console.error("Error in vendor assessment:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getTenantIdFromRequest(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: assessments, error } = await admin
      .from("vendor_assessments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ assessments: assessments || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch assessments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
