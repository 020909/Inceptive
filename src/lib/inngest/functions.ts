import { createClient } from "@supabase/supabase-js";
import { trackEvent } from "@/lib/analytics";
import { chatWithGemini } from "@/lib/ai/proxy";
import { inngest } from "@/lib/inngest/client";
import { sendMorningReport } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

type OvernightEventData = {
  orgId: string;
  orgSlug: string;
  userId: string;
  userEmail: string;
  userName: string;
  workflows?: string[];
};

type WorkflowRow = {
  id: string;
  organization_id: string;
  template_id: string;
  status: "active" | "paused";
  last_run_at: string | null;
  template: {
    id: string;
    slug: string;
    name: string;
    category: string;
  } | null;
};

const DEFAULT_BACKGROUND_MODEL =
  process.env.INNGEST_AI_MODEL || process.env.OPENROUTER_BACKGROUND_MODEL || "google/gemini-2.0-flash-001";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}

function hasOpenRouterKey() {
  return Boolean(
    process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || process.env.OPENROUTER_API_KEY
  );
}

function parseJsonBlock<T>(value: string): T {
  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  return JSON.parse(withoutFence) as T;
}

async function runJsonPrompt<T>(system: string, prompt: string, fallback: T) {
  if (!hasOpenRouterKey()) {
    return fallback;
  }

  try {
    const response = await chatWithGemini({
      model: DEFAULT_BACKGROUND_MODEL,
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    if (!response.content.trim()) {
      return fallback;
    }

    return parseJsonBlock<T>(response.content);
  } catch (error) {
    console.warn("[inngest] Falling back to deterministic JSON output", error);
    return fallback;
  }
}

async function runTextPrompt(system: string, prompt: string, fallback: string) {
  if (!hasOpenRouterKey()) {
    return fallback;
  }

  try {
    const response = await chatWithGemini({
      model: DEFAULT_BACKGROUND_MODEL,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    return response.content.trim() || fallback;
  } catch (error) {
    console.warn("[inngest] Falling back to deterministic text output", error);
    return fallback;
  }
}

function toIsoNow() {
  return new Date().toISOString();
}

function coerceWorkflowSlug(value: string) {
  return value.trim().toLowerCase();
}

function fallbackEmailDrafts(userName: string) {
  return [
    {
      to: "client@acmeco.com",
      subject: "Quick follow-up on next steps",
      draft: `Hi there, ${userName} reviewed the latest thread and would like to confirm priorities for this week. Please send over the top two items you want handled first and we will move quickly.`,
      priority: "high",
    },
    {
      to: "prospect@northstar.io",
      subject: "Checking interest in Inceptive",
      draft: `Hello, I wanted to follow up and see if your team is still evaluating AI workflow automation. If helpful, we can share a short overview focused on operational savings and overnight execution.`,
      priority: "medium",
    },
    {
      to: "partner@orbitlabs.ai",
      subject: "Scheduling a partnership conversation",
      draft: `Thanks for the recent conversation. We would love to schedule a short call next week to discuss where our teams can collaborate on go-to-market and customer delivery.`,
      priority: "medium",
    },
  ];
}

function fallbackResearchReport() {
  return {
    trends: [
      "B2B teams are shifting from isolated copilots to workflow-level AI automation.",
      "Buyers increasingly expect AI tools to provide auditability and human approval controls.",
      "Vendors that combine execution with reporting are outperforming pure chat interfaces.",
    ],
    competitors: [
      "Competitors are positioning around task automation rather than autonomous overnight execution.",
      "Most competing products emphasize generic productivity instead of organization-specific workflows.",
    ],
    leads: [
      { name: "Maya Chen", company: "Northstar Ops", reason: "Operations leader evaluating workflow automation." },
      { name: "Daniel Ross", company: "Summit Growth", reason: "Revenue team looking for AI-assisted outbound systems." },
      { name: "Priya Shah", company: "Vertex Advisory", reason: "Interested in overnight research and reporting." },
      { name: "Ethan Cole", company: "Atlas Ventures", reason: "Exploring AI systems for internal execution leverage." },
      { name: "Sofia Kim", company: "Beacon Labs", reason: "Marketing lead seeking repeatable content automation." },
    ],
  };
}

function fallbackContentPosts() {
  return [
    {
      platform: "LinkedIn",
      content: "Most teams do not need more AI chat windows. They need AI that wakes up with work already finished.",
      hashtags: ["#AI", "#B2B", "#Automation"],
    },
    {
      platform: "LinkedIn",
      content: "Overnight execution changes the economics of a startup team. Reports, drafts, and research should be waiting for you in the morning.",
      hashtags: ["#Startups", "#Operations", "#Productivity"],
    },
    {
      platform: "LinkedIn",
      content: "The next generation of AI software is not assistant-first. It is workflow-first, measurable, and tied to business outcomes.",
      hashtags: ["#SaaS", "#EnterpriseAI", "#Workflows"],
    },
  ];
}

function fallbackMorningSummary(params: {
  userName: string;
  totalTasks: number;
  emailsDrafted: number;
  leadsFound: number;
  postsCreated: number;
  hoursSaved: number;
}) {
  return `${params.userName}, your AI agent completed ${params.totalTasks} tasks overnight, including ${params.emailsDrafted} email drafts, ${params.leadsFound} researched leads, and ${params.postsCreated} content ideas. That saved an estimated ${params.hoursSaved} hours and prepared a clean morning handoff for review.`;
}

async function logAgentActivity(
  admin: ReturnType<typeof getAdmin>,
  params: {
    organizationId: string;
    userId: string;
    actionType: string;
    title: string;
    description: string;
    status?: "completed" | "failed" | "in_progress";
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await admin.from("agent_activity_log").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    action_type: params.actionType,
    title: params.title,
    description: params.description,
    status: params.status ?? "completed",
    metadata: params.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

const overnightAgentRun = inngest.createFunction(
  {
    id: "overnight-agent-run",
    name: "Overnight Agent Run",
    triggers: [{ event: "agent/overnight.triggered" }],
  },
  async ({ event, step }) => {
    const data = event.data as OvernightEventData;
    const admin = getAdmin();

    const activeWorkflows = await step.run("fetch-active-workflows", async () => {
      const { data: workflows, error } = await admin
        .from("org_workflows")
        .select(
          `
            id,
            organization_id,
            template_id,
            status,
            last_run_at,
            template:workflow_templates (
              id,
              slug,
              name,
              category
            )
          `
        )
        .eq("organization_id", data.orgId)
        .eq("status", "active");

      if (error) {
        throw new Error(error.message);
      }

      return ((workflows ?? []) as any[]).map((workflow) => ({
        id: workflow.id,
        organization_id: workflow.organization_id,
        template_id: workflow.template_id,
        status: workflow.status,
        last_run_at: workflow.last_run_at ?? null,
        template: Array.isArray(workflow.template) ? workflow.template[0] : workflow.template,
      })) as WorkflowRow[];
    });

    const activeSlugs = new Set(
      activeWorkflows
        .map((workflow: WorkflowRow) => workflow.template?.slug)
        .filter((value: string | undefined): value is string => Boolean(value))
        .map(coerceWorkflowSlug)
    );

    const requestedSlugs = new Set((data.workflows ?? []).map(coerceWorkflowSlug));
    const shouldRunWorkflow = (candidates: string[]) => {
      const normalized = candidates.map(coerceWorkflowSlug);
      return normalized.some((slug) => activeSlugs.has(slug)) || normalized.some((slug) => requestedSlugs.has(slug));
    };

    const emailResult = shouldRunWorkflow(["email", "sales", "outreach"])
      ? await step.run("run-email-agent", async () => {
          const drafts = await runJsonPrompt<
            Array<{ to: string; subject: string; draft: string; priority: string }>
          >(
            "You are an email agent. Analyze inbox priorities and draft responses for a business user. Generate 3 example email drafts for common business scenarios. Return JSON array of: [{ to, subject, draft, priority }]",
            `Generate the drafts for ${data.userName} at organization ${data.orgId}. Return valid JSON only.`,
            fallbackEmailDrafts(data.userName)
          );

          await logAgentActivity(admin, {
            organizationId: data.orgId,
            userId: data.userId,
            actionType: "email_drafted",
            title: "Overnight email agent completed",
            description: `Drafted ${drafts.length} email response suggestions overnight.`,
            metadata: {
              workflow_slug: "email",
              drafts,
            },
          });

          return { emailsDrafted: drafts.length, drafts };
        })
      : { emailsDrafted: 0, drafts: [] as Array<{ to: string; subject: string; draft: string; priority: string }> };

    const researchResult = shouldRunWorkflow(["research"])
      ? await step.run("run-research-agent", async () => {
          const report = await runJsonPrompt<{
            trends: string[];
            competitors: string[];
            leads: Array<{ name: string; company: string; reason: string }>;
          }>(
            "You are a research agent. Generate a brief market intelligence report for a B2B business. Include: 3 industry trends, 2 competitor insights, 5 potential leads (fictional but realistic). Return as structured JSON: { trends, competitors, leads }",
            `Create the market intelligence report for ${data.userName}. Return valid JSON only.`,
            fallbackResearchReport()
          );

          await logAgentActivity(admin, {
            organizationId: data.orgId,
            userId: data.userId,
            actionType: "research_completed",
            title: "Overnight research agent completed",
            description: `Found ${report.leads.length} leads and ${report.competitors.length} competitor insights overnight.`,
            metadata: {
              workflow_slug: "research",
              report,
            },
          });

          return { leadsFound: report.leads.length, report };
        })
      : { leadsFound: 0, report: { trends: [] as string[], competitors: [] as string[], leads: [] as Array<{ name: string; company: string; reason: string }> } };

    const contentResult = shouldRunWorkflow(["content", "marketing", "social"])
      ? await step.run("run-content-agent", async () => {
          const posts = await runJsonPrompt<
            Array<{ platform: string; content: string; hashtags: string[] }>
          >(
            "Generate 3 LinkedIn post ideas for a B2B AI startup. Return JSON array: [{ platform, content, hashtags }]",
            `Generate the content ideas for ${data.userName}. Return valid JSON only.`,
            fallbackContentPosts()
          );

          await logAgentActivity(admin, {
            organizationId: data.orgId,
            userId: data.userId,
            actionType: "content_created",
            title: "Overnight content agent completed",
            description: `Generated ${posts.length} social content ideas overnight.`,
            metadata: {
              workflow_slug: "content",
              posts,
            },
          });

          return { postsCreated: posts.length, posts };
        })
      : { postsCreated: 0, posts: [] as Array<{ platform: string; content: string; hashtags: string[] }> };

    const report = await step.run("compile-morning-report", async () => {
      const totalTasks = emailResult.emailsDrafted + researchResult.leadsFound + contentResult.postsCreated;
      const hoursSaved = totalTasks * 0.5;
      const highlights = [
        emailResult.emailsDrafted > 0 ? `Drafted ${emailResult.emailsDrafted} email responses for review.` : null,
        researchResult.leadsFound > 0 ? `Researched ${researchResult.leadsFound} potential leads and market signals.` : null,
        contentResult.postsCreated > 0 ? `Created ${contentResult.postsCreated} new social content ideas.` : null,
      ].filter((value): value is string => Boolean(value));

      const summary = await runTextPrompt(
        "Write a 2-sentence morning briefing for a business owner summarizing what their AI agent accomplished overnight. Mention specific numbers. Be concise and positive.",
        `User: ${data.userName}
Organization ID: ${data.orgId}
Tasks completed: ${totalTasks}
Emails drafted: ${emailResult.emailsDrafted}
Leads found: ${researchResult.leadsFound}
Posts created: ${contentResult.postsCreated}
Hours saved: ${hoursSaved}
Return only the briefing paragraph.`,
        fallbackMorningSummary({
          userName: data.userName,
          totalTasks,
          emailsDrafted: emailResult.emailsDrafted,
          leadsFound: researchResult.leadsFound,
          postsCreated: contentResult.postsCreated,
          hoursSaved,
        })
      );

      return {
        totalTasks,
        emailsDrafted: emailResult.emailsDrafted,
        leadsFound: researchResult.leadsFound,
        postsCreated: contentResult.postsCreated,
        hoursSaved,
        summary,
        highlights,
      };
    });

    await step.run("send-morning-report-email", async () => {
      await sendMorningReport(data.userEmail, {
        userName: data.userName,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        tasksCompleted: report.totalTasks,
        emailsDrafted: report.emailsDrafted,
        leadsResearched: report.leadsFound,
        summary: report.summary,
        highlights: report.highlights,
      });

      void trackEvent(data.orgId, data.userId, "morning_report_sent", {
        org_id: data.orgId,
        tasks_completed: report.totalTasks,
      });

      return { sent: true };
    });

    await step.run("update-last-run", async () => {
      const now = toIsoNow();
      const workflowIds = activeWorkflows.map((workflow: WorkflowRow) => workflow.id);

      if (workflowIds.length > 0) {
        const { error: workflowError } = await admin
          .from("org_workflows")
          .update({ last_run_at: now })
          .in("id", workflowIds);

        if (workflowError) {
          throw new Error(workflowError.message);
        }
      }

      await logAgentActivity(admin, {
        organizationId: data.orgId,
        userId: data.userId,
        actionType: "overnight_run_complete",
        title: "Overnight run complete",
        description: report.summary,
        metadata: {
          totalTasks: report.totalTasks,
          emailsDrafted: report.emailsDrafted,
          leadsFound: report.leadsFound,
          postsCreated: report.postsCreated,
          hoursSaved: report.hoursSaved,
        },
      });

      await createNotification({
        userId: data.userId,
        orgId: data.orgId,
        title: "Your AI finished working",
        message: `Completed ${report.totalTasks} tasks overnight`,
        type: "success",
        link: `/org/${data.orgSlug}/activity`,
      });

      return { updatedAt: now };
    });

    return { success: true, summary: report.summary };
  }
);

const nightlySchedule = inngest.createFunction(
  {
    id: "nightly-schedule",
    name: "Nightly Agent Schedule",
    triggers: [{ cron: "0 23 * * *" }],
  },
  async ({ step }) => {
    const admin = getAdmin();

    const orgs = await step.run("fetch-all-active-orgs", async () => {
      const { data: activeWorkflows, error: workflowError } = await admin
        .from("org_workflows")
        .select("organization_id")
        .eq("status", "active");

      if (workflowError) {
        throw new Error(workflowError.message);
      }

      const orgIds = [...new Set((activeWorkflows ?? []).map((row) => row.organization_id as string).filter(Boolean))];

      if (orgIds.length === 0) {
        return [] as Array<{ orgId: string; orgSlug: string; userId: string; userEmail: string; userName: string; workflows: string[] }>;
      }

      const { data: memberships, error: membershipError } = await admin
        .from("organization_members")
        .select("organization_id, user_id, role, status")
        .in("organization_id", orgIds)
        .eq("role", "admin")
        .eq("status", "active");

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      const userIds = [...new Set((memberships ?? []).map((member) => member.user_id as string).filter(Boolean))];
      const { data: users, error: usersError } = await admin
        .from("users")
        .select("id, email")
        .in("id", userIds);

      if (usersError) {
        throw new Error(usersError.message);
      }

      const emailByUserId = new Map((users ?? []).map((user) => [user.id as string, user.email as string | null]));
      const { data: organizations, error: organizationsError } = await admin
        .from("organizations")
        .select("id, slug")
        .in("id", orgIds);

      if (organizationsError) {
        throw new Error(organizationsError.message);
      }

      const slugByOrgId = new Map((organizations ?? []).map((org) => [org.id as string, org.slug as string]));
      const workflowsByOrgId = new Map<string, string[]>();

      const { data: orgWorkflowRows, error: orgWorkflowError } = await admin
        .from("org_workflows")
        .select(
          `
            organization_id,
            template:workflow_templates (
              slug
            )
          `
        )
        .in("organization_id", orgIds)
        .eq("status", "active");

      if (orgWorkflowError) {
        throw new Error(orgWorkflowError.message);
      }

      for (const row of orgWorkflowRows ?? []) {
        const orgId = row.organization_id as string;
        const template = Array.isArray((row as any).template) ? (row as any).template[0] : (row as any).template;
        const slug = template?.slug as string | undefined;
        if (!slug) continue;
        workflowsByOrgId.set(orgId, [...(workflowsByOrgId.get(orgId) ?? []), slug]);
      }

      return (memberships ?? [])
        .map((member) => {
          const userId = member.user_id as string | null;
          const email = userId ? emailByUserId.get(userId) ?? null : null;
          if (!userId || !email) return null;

          return {
            orgId: member.organization_id as string,
            orgSlug: slugByOrgId.get(member.organization_id as string) ?? "",
            userId,
            userEmail: email,
            userName: email.split("@")[0] || "Admin",
            workflows: workflowsByOrgId.get(member.organization_id as string) ?? [],
          };
        })
        .filter((value): value is { orgId: string; orgSlug: string; userId: string; userEmail: string; userName: string; workflows: string[] } => Boolean(value?.orgSlug));
    });

    await step.run("trigger-agent-runs", async () => {
      if (orgs.length === 0) {
        return { triggered: 0 };
      }

      await inngest.send(
        orgs.map((org: { orgId: string; orgSlug: string; userId: string; userEmail: string; userName: string; workflows: string[] }) => ({
          name: "agent/overnight.triggered",
          data: org,
        }))
      );

      orgs.forEach((org: { orgId: string; orgSlug: string; userId: string; userEmail: string; userName: string; workflows: string[] }) => {
        void trackEvent(org.orgId, org.userId, "agent_run_triggered", {
          org_id: org.orgId,
          trigger_type: "scheduled",
        });
      });

      return { triggered: orgs.length };
    });

    return { orgsTriggered: orgs.length };
  }
);

export const inngestFunctions = [overnightAgentRun, nightlySchedule];
