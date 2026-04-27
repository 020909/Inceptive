import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UBOAgent } from "@/lib/agents/ubo-agent";

// ─── POST /api/agents/ubo ────────────────────────────────────────────────────
// Triggers the UBO Unwrapper agent

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ─── Auth Check ──────────────────────────────────────────────────────────

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Parse Request ───────────────────────────────────────────────────────

    const body = await request.json();
    const { case_id, org_id, document_ids } = body;

    if (!case_id || !org_id || !document_ids || !Array.isArray(document_ids)) {
      return NextResponse.json(
        { error: "Missing required fields: case_id, org_id, document_ids" },
        { status: 400 }
      );
    }

    // ─── Verify User Belongs to Org ─────────────────────────────────────────

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied to this organization" },
        { status: 403 }
      );
    }

    // ─── Create Agent Run Record ─────────────────────────────────────────────

    const { data: agentRun, error: runError } = await supabase
      .from("agent_runs")
      .insert({
        org_id,
        agent_type: "ubo_unwrapper",
        status: "running",
        input_data: { case_id, document_ids },
        current_phase: 1,
        logs: [],
      })
      .select()
      .single();

    if (runError || !agentRun) {
      return NextResponse.json(
        { error: `Failed to create agent run: ${runError?.message}` },
        { status: 500 }
      );
    }

    // ─── Execute Agent ───────────────────────────────────────────────────────

    const agent = new UBOAgent(agentRun.id, supabase);

    // Run agent asynchronously (don't await - let it run in background)
    agent.execute(case_id, org_id, document_ids).catch((error) => {
      console.error("UBO Agent execution error:", error);
    });

    // ─── Response ────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      agent_run_id: agentRun.id,
      status: "running",
      message: "UBO Unwrapper agent started successfully",
    });
  } catch (error) {
    console.error("Error in UBO agent API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── GET /api/agents/ubo ──────────────────────────────────────────────────────
// Get agent run status and logs

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ─── Auth Check ──────────────────────────────────────────────────────────

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ─── Get Query Params ────────────────────────────────────────────────────

    const { searchParams } = new URL(request.url);
    const agent_run_id = searchParams.get("agent_run_id");

    if (!agent_run_id) {
      return NextResponse.json(
        { error: "Missing agent_run_id parameter" },
        { status: 400 }
      );
    }

    // ─── Fetch Agent Run ─────────────────────────────────────────────────────

    const { data: agentRun, error } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("id", agent_run_id)
      .single();

    if (error || !agentRun) {
      return NextResponse.json(
        { error: "Agent run not found" },
        { status: 404 }
      );
    }

    // ─── Verify Access ───────────────────────────────────────────────────────

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", agentRun.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // ─── Response ────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      agent_run: agentRun,
    });
  } catch (error) {
    console.error("Error fetching agent status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
