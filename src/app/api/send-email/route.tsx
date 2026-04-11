import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { getAuthenticatedUserIdFromRequest } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import MorningReportEmail, { type MorningReportEmailProps } from "@/emails/MorningReportEmail";
import TaskCompleteEmail, { type TaskCompleteEmailProps } from "@/emails/TaskCompleteEmail";
import TeamInviteEmail, { type TeamInviteEmailProps } from "@/emails/TeamInviteEmail";

export const runtime = "nodejs";
export const maxDuration = 30;

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

const morningReportSchema = z.object({
  userName: z.string().min(1),
  date: z.string().min(1),
  tasksCompleted: z.number(),
  emailsDrafted: z.number(),
  leadsResearched: z.number(),
  summary: z.string().min(1),
  highlights: z.array(z.string()),
});

const teamInviteSchema = z.object({
  inviterName: z.string().min(1),
  orgName: z.string().min(1),
  inviteUrl: z.string().url(),
});

const taskCompleteSchema = z.object({
  userName: z.string().min(1),
  taskName: z.string().min(1),
  result: z.string().min(1),
  timeElapsed: z.string().min(1),
});

const requestSchema = z.object({
  template: z.enum(["morning_report", "team_invite", "task_complete"]),
  to: z.string().email(),
  data: z.record(z.string(), z.unknown()),
});

function hasValidInternalToken(request: Request) {
  const configuredToken = process.env.INTERNAL_EMAIL_API_TOKEN;
  if (!configuredToken) {
    return false;
  }

  return request.headers.get("x-inceptive-internal-email-token") === configuredToken;
}

function emailsEqual(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function getSubject(
  template: z.infer<typeof requestSchema>["template"],
  data: MorningReportEmailProps | TeamInviteEmailProps | TaskCompleteEmailProps
) {
  switch (template) {
    case "morning_report":
      return `Your Inceptive morning report for ${(data as MorningReportEmailProps).date}`;
    case "team_invite":
      return `${(data as TeamInviteEmailProps).inviterName} invited you to join ${(data as TeamInviteEmailProps).orgName} on Inceptive`;
    case "task_complete":
      return `Task complete: ${(data as TaskCompleteEmailProps).taskName}`;
  }
}

function getTemplateComponent(template: z.infer<typeof requestSchema>["template"], rawData: Record<string, unknown>) {
  switch (template) {
    case "morning_report": {
      const data = morningReportSchema.parse(rawData);
      return {
        subject: getSubject(template, data),
        react: <MorningReportEmail {...data} />,
      };
    }
    case "team_invite": {
      const data = teamInviteSchema.parse(rawData);
      return {
        subject: getSubject(template, data),
        react: <TeamInviteEmail {...data} />,
      };
    }
    case "task_complete": {
      const data = taskCompleteSchema.parse(rawData);
      return {
        subject: getSubject(template, data),
        react: <TaskCompleteEmail {...data} />,
      };
    }
  }
}

export async function POST(request: Request) {
  if (!resendApiKey || !resendFromEmail) {
    return NextResponse.json(
      { success: false, error: "Resend is not configured. Missing RESEND_API_KEY or RESEND_FROM_EMAIL." },
      { status: 500 }
    );
  }

  try {
    const internal = hasValidInternalToken(request);
    const authenticatedUserId = await getAuthenticatedUserIdFromRequest(request);
    if (!authenticatedUserId && !internal) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = requestSchema.parse(await request.json());

    if (!internal && authenticatedUserId) {
      const admin = createAdminSupabaseClient();
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(authenticatedUserId);
      const userEmail = authUser?.user?.email?.trim();
      if (authErr || !userEmail) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
      if (payload.template === "team_invite") {
        return NextResponse.json(
          { success: false, error: "Team invites are sent by the server only." },
          { status: 403 }
        );
      }
      if (!emailsEqual(payload.to, userEmail)) {
        return NextResponse.json(
          { success: false, error: "You can only send transactional email to your own account email." },
          { status: 403 }
        );
      }
    }
    const templateConfig = getTemplateComponent(payload.template, payload.data);
    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: resendFromEmail,
      to: [payload.to],
      subject: templateConfig.subject,
      react: templateConfig.react,
    });

    if (error) {
      console.error("[send-email]", error);
      return NextResponse.json({ success: false, error: error.message || "Failed to send email." }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email.";
    console.error("[send-email]", error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
