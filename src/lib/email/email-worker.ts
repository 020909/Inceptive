import { createClient } from "@supabase/supabase-js";
import { enqueueJob } from "@/lib/agent/task-queue";
import { listUnreadGmail } from "@/lib/email/gmail-api";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function extractTaskInstruction(subject: string, snippet: string): string | null {
  const raw = `${subject}\n${snippet}`.trim();
  // Trigger phrases:
  // - "agent:" prefix
  // - "inceptive task:"
  // - "research ..."
  const m =
    raw.match(/(?:agent:|inceptive task:)\s*([\s\S]+)/i) ||
    raw.match(/^\s*research\s+([\s\S]+)/i);
  if (!m?.[1]) return null;
  return m[1].trim().slice(0, 1200);
}

export async function runEmailTriggeredWorkflows(maxUsers = 10) {
  const a = admin();
  const { data: rows } = await a
    .from("connected_accounts")
    .select("user_id, provider")
    .eq("provider", "gmail")
    .limit(maxUsers);

  let enqueued = 0;
  for (const row of rows || []) {
    try {
      const result = await listUnreadGmail(row.user_id, 6, { unreadOnly: true });
      if (result.error) continue;

      for (const m of result.messages || []) {
        const instruction = extractTaskInstruction(m.subject || "", m.snippet || "");
        if (!instruction) continue;
        await enqueueJob({
          userId: row.user_id,
          kind: "scheduled.prompt",
          payload: {
            scheduled_task_id: null,
            name: `Email Workflow: ${m.subject || "Task"}`,
            prompt: instruction,
            trigger: "email",
            source_email_id: m.id,
          },
          nextRunAt: new Date().toISOString(),
        });
        enqueued++;
      }
    } catch {
      // continue
    }
  }
  return { enqueued };
}

