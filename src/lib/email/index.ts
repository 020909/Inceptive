import "server-only";

import { z } from "zod";
import type { MorningReportEmailProps } from "@/emails/MorningReportEmail";
import type { TaskCompleteEmailProps } from "@/emails/TaskCompleteEmail";
import type { TeamInviteEmailProps } from "@/emails/TeamInviteEmail";

const responseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  id: z.string().optional(),
});

type EmailTemplate = "morning_report" | "team_invite" | "task_complete";

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

async function postTransactionalEmail(template: EmailTemplate, to: string, data: object) {
  const internalToken = process.env.INTERNAL_EMAIL_API_TOKEN;
  if (!internalToken) {
    throw new Error("INTERNAL_EMAIL_API_TOKEN is not configured; cannot send transactional email.");
  }
  const response = await fetch(`${getBaseUrl()}/api/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-inceptive-internal-email-token": internalToken,
    },
    body: JSON.stringify({ template, to, data }),
  });

  const json = responseSchema.parse(await response.json());

  if (!response.ok || !json.success) {
    throw new Error(json.error || "Failed to send email.");
  }

  return json;
}

export async function sendMorningReport(to: string, data: MorningReportEmailProps) {
  return postTransactionalEmail("morning_report", to, data);
}

export async function sendTeamInvite(to: string, data: TeamInviteEmailProps) {
  return postTransactionalEmail("team_invite", to, data);
}

export async function sendTaskComplete(to: string, data: TaskCompleteEmailProps) {
  return postTransactionalEmail("task_complete", to, data);
}

export type { MorningReportEmailProps, TaskCompleteEmailProps, TeamInviteEmailProps };
