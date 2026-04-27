import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CaseFilters {
  caseType?: string;
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface CreateCaseBody {
  title: string;
  case_type: string;
  priority: string;
  description?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Generate a unique case number
 * Format: CASE-YYYYMMDD-XXXX (where XXXX is a sequential number)
 */
async function generateCaseNumber(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>): Promise<string> {
  const now = new Date();
  const datePrefix = `CASE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  
  // Get the count of cases created today to generate sequential number
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const { count, error } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString());
  
  if (error) {
    console.error("Error generating case number:", error);
    // Fallback to timestamp-based number
    return `${datePrefix}-${String(now.getTime()).slice(-4)}`;
  }
  
  const sequence = (count || 0) + 1;
  return `${datePrefix}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Build Supabase query with filters
 */
function buildCasesQuery(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orgId: string,
  filters: CaseFilters
) {
  let query = supabase
    .from("cases")
    .select(
      "id, case_number, title, case_type, status, priority, description, assigned_to, org_id, created_at, due_date, assigned_user:assigned_to(full_name, email)",
      { count: "exact" }
    )
    .eq("org_id", orgId);

  // Apply filters
  if (filters.caseType && filters.caseType !== "all") {
    query = query.eq("case_type", filters.caseType);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }

  if (filters.search?.trim()) {
    const searchTerm = filters.search.trim();
    query = query.or(`case_number.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`);
  }

  // Pagination
  const limit = filters.limit || 25;
  const page = filters.page || 1;
  const from = (page - 1) * limit;
  
  query = query.order("created_at", { ascending: false }).range(from, from + limit - 1);

  return query;
}

// ─── GET Handler ───────────────────────────────────────────────────────────────

/**
 * GET /api/cases
 * List cases with optional filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's org_id from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.org_id) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters: CaseFilters = {
      caseType: searchParams.get("caseType") || undefined,
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      search: searchParams.get("search") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "25", 10),
    };

    // Fetch cases
    const { data: cases, error: casesError, count } = await buildCasesQuery(supabase, profile.org_id, filters);

    if (casesError) {
      console.error("Error fetching cases:", casesError);
      return NextResponse.json(
        { error: "Failed to fetch cases" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      cases: cases || [],
      total: count || 0,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil((count || 0) / (filters.limit || 25)),
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/cases:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/cases
 * Create a new case with auto-generated case_number
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's org_id from user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.org_id) {
      console.error("Error fetching user profile:", profileError);
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 403 }
      );
    }

    // Parse request body
    let body: CreateCaseBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!body.case_type) {
      return NextResponse.json(
        { error: "Case type is required" },
        { status: 400 }
      );
    }

    if (!body.priority) {
      return NextResponse.json(
        { error: "Priority is required" },
        { status: 400 }
      );
    }

    // Validate case_type
    const validCaseTypes = ["kyb_review", "sar_draft", "vendor_review", "aml_triage", "reconciliation"];
    if (!validCaseTypes.includes(body.case_type)) {
      return NextResponse.json(
        { error: "Invalid case type" },
        { status: 400 }
      );
    }

    // Validate priority
    const validPriorities = ["low", "normal", "high", "urgent"];
    if (!validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { error: "Invalid priority" },
        { status: 400 }
      );
    }

    // Generate case number
    const caseNumber = await generateCaseNumber(supabase);

    // Create the case
    const { data: newCase, error: insertError } = await supabase
      .from("cases")
      .insert({
        case_number: caseNumber,
        title: body.title.trim(),
        case_type: body.case_type,
        priority: body.priority,
        description: body.description?.trim() || null,
        assigned_to: body.assigned_to || null,
        due_date: body.due_date || null,
        org_id: profile.org_id,
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating case:", insertError);
      return NextResponse.json(
        { error: "Failed to create case" },
        { status: 500 }
      );
    }

    // Create audit trail entry
    await supabase.from("case_events").insert({
      case_id: newCase.id,
      event_type: "case_created",
      event_description: `Case ${caseNumber} created: ${body.title}`,
      actor: user.id,
      metadata: {
        case_type: body.case_type,
        priority: body.priority,
        assigned_to: body.assigned_to,
      },
    });

    return NextResponse.json({
      success: true,
      case: newCase,
    }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/cases:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
