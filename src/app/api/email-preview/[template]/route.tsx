import { NextResponse } from "next/server";
import MorningReportEmail from "@/emails/MorningReportEmail";
import TaskCompleteEmail from "@/emails/TaskCompleteEmail";
import TeamInviteEmail from "@/emails/TeamInviteEmail";

export const runtime = "nodejs";

const morningReportSample = {
  userName: "Aly",
  date: "April 11, 2026",
  tasksCompleted: 14,
  emailsDrafted: 9,
  leadsResearched: 31,
  summary:
    "Your agents triaged the overnight queue, drafted customer follow-ups, enriched new leads, and packaged the most relevant work into a clean morning handoff.",
  highlights: [
    "Closed the loop on 4 overdue customer tasks.",
    "Drafted outbound follow-ups for 9 warm prospects.",
    "Researched 31 new leads and ranked the top opportunities.",
  ],
};

const teamInviteSample = {
  inviterName: "Aly Maknojiya",
  orgName: "Inceptive",
  inviteUrl: "https://app.inceptive-ai.com/org/inceptive/invite?token=sample",
};

const taskCompleteSample = {
  userName: "Aly",
  taskName: "Prospect enrichment for Q2 target accounts",
  result: "The agent enriched 48 accounts, flagged 11 high-intent buyers, and prepared a prioritized outreach list for review.",
  timeElapsed: "18 minutes",
};

async function renderTemplate(template: string) {
  const { renderToStaticMarkup } = await import("react-dom/server");

  if (template === "morning-report") {
    return renderToStaticMarkup(<MorningReportEmail {...morningReportSample} />);
  }
  if (template === "team-invite") {
    return renderToStaticMarkup(<TeamInviteEmail {...teamInviteSample} />);
  }
  if (template === "task-complete") {
    return renderToStaticMarkup(<TaskCompleteEmail {...taskCompleteSample} />);
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ template: string }> }
) {
  const { template } = await context.params;
  const markup = await renderTemplate(template);

  if (!markup) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return new NextResponse(`<!doctype html>${markup}`, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
