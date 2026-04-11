import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");
    const orgSlug = url.searchParams.get("orgSlug");

    if (!orgId || !orgSlug) {
      return NextResponse.json({ error: "orgId and orgSlug are required." }, { status: 400 });
    }

    const admin = getAdmin();
    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: orgRow, error: orgErr } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .maybeSingle();

    if (orgErr) {
      throw new Error(orgErr.message);
    }

    if (!orgRow?.slug || orgRow.slug !== orgSlug) {
      return NextResponse.json({ error: "Invalid organization." }, { status: 400 });
    }

    const [workflowTemplatesResult, activityResult] = await Promise.all([
      admin
        .from("workflow_templates")
        .select("id, name, description, category, slug")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      admin
        .from("agent_activity_log")
        .select("id, title, description, action_type, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (workflowTemplatesResult.error) {
      throw new Error(workflowTemplatesResult.error.message);
    }

    if (activityResult.error) {
      throw new Error(activityResult.error.message);
    }

    const pages = [
      { id: "dashboard", title: "Dashboard", subtitle: "Workspace overview", href: "/dashboard", category: "Pages", icon: "LayoutGrid" },
      { id: "activity", title: "Activity Log", subtitle: "Review recent AI actions", href: `/org/${orgSlug}/activity`, category: "Pages", icon: "ListChecks" },
      { id: "analytics", title: "Analytics", subtitle: "Usage and activity metrics", href: `/org/${orgSlug}/analytics`, category: "Pages", icon: "BarChart2" },
      { id: "team", title: "Team", subtitle: "Workspace members and invites", href: `/org/${orgSlug}/dashboard`, category: "Pages", icon: "Users" },
      { id: "browser-agent", title: "Browser Agent", subtitle: "Run browser tasks", href: "/browser-agent", category: "Pages", icon: "Globe" },
      { id: "code-agent", title: "Code Agent", subtitle: "Work with autonomous agents", href: "/agent", category: "Pages", icon: "Bot" },
      { id: "workflows", title: "Workflows", subtitle: "Activate workflow templates", href: `/org/${orgSlug}/workflows`, category: "Pages", icon: "GitBranch" },
    ];

    return NextResponse.json({
      workflows: (workflowTemplatesResult.data ?? []).map((template) => ({
        id: template.id,
        title: template.name,
        subtitle: template.description ?? template.category,
        href: `/org/${orgSlug}/workflows`,
        category: "Workflows",
        icon: "GitBranch",
      })),
      activity: (activityResult.data ?? []).map((activity) => ({
        id: activity.id,
        title: activity.title,
        subtitle: activity.description ?? activity.action_type,
        href: `/org/${orgSlug}/activity`,
        category: "Activity",
        icon: "ListChecks",
      })),
      pages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load global search data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
