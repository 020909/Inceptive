import { NextResponse } from "next/server";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getTenantIdFromRequest } from "@/lib/ubo/requestContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapePostgrest(str: string): string {
  return str.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let query = admin
      .from("policies")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });

    if (category && category !== "all") query = query.eq("category", category);
    if (status && status !== "all") query = query.eq("status", status);
    if (search?.trim()) {
      query = query.or(`title.ilike.%${escapePostgrest(search.trim())}%,policy_number.ilike.%${escapePostgrest(search.trim())}%,content.ilike.%${escapePostgrest(search.trim())}%`);
    }

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error: qErr, count } = await query;
    if (qErr) throw new Error(qErr.message);

    return NextResponse.json({ policies: data || [], total: count || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch policies";
    console.error("Error fetching policies:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
      title: string;
      policy_number?: string;
      category?: string;
      version?: string;
      status?: string;
      content?: string;
      summary?: string;
      effective_date?: string;
      review_date?: string;
      owner?: string;
      tags?: string[];
      file_url?: string;
      file_name?: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: policy, error: insertErr } = await admin
      .from("policies")
      .insert({
        tenant_id: tenantId,
        title: body.title.trim(),
        policy_number: body.policy_number || null,
        category: body.category || "general",
        version: body.version || "1.0",
        status: body.status || "draft",
        content: body.content || null,
        summary: body.summary || null,
        effective_date: body.effective_date || null,
        review_date: body.review_date || null,
        owner: body.owner || null,
        tags: body.tags || [],
        file_url: body.file_url || null,
        file_name: body.file_name || null,
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const actorEmail = authUser?.user?.email || "system@inceptive-ai.com";

  const { error: auditErr } = await admin.from("audit_log").insert({
    tenant_id: tenantId,
    actor_id: userId,
    actor_email: actorEmail,
    action_type: "policy_created",
    entity_type: "policy",
    entity_id: policy.id,
    after_state: { title: body.title, category: body.category, status: body.status || "draft" },
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  });
  if (auditErr) console.error("Audit log insert failed:", auditErr.message);

  return NextResponse.json({ success: true, policy }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create policy";
    console.error("Error creating policy:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
