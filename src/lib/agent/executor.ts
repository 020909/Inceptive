import { browserConnector, computerUseConnector, gmailConnector, slackConnector } from "@/lib/connectors";
import { computerGoto, computerScreenshot } from "@/lib/computer-use/session";
import { describeScreenshotBase64 } from "@/lib/vision/describe-screenshot";
import { createClient } from "@supabase/supabase-js";
import { listUnreadGmail } from "@/lib/email/gmail-api";
import { listUnreadYahoo } from "@/lib/email/yahoo-imap";
import { checkCredits, deductCredits } from "@/lib/credits";
import type { AgentJobRow } from "./types";
import { appendLog, completeJob, requeueOrFail } from "./task-queue";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function executeAgentJob(job: AgentJobRow): Promise<void> {
  const ctx = { userId: job.user_id };

  try {
    switch (job.kind) {
      case "browser.probe": {
        const q = String((job.payload as { query?: string }).query || "Inceptive AI");
        await appendLog(job.id, `browser.search: ${q}`);
        const snippet = await browserConnector.search(q);
        await appendLog(job.id, "browser.search done");
        await completeJob(job.id, { snippet, query: q });
        return;
      }

      case "connector.health": {
        const gmailOk = await gmailConnector.isLinked(ctx);
        const slackReady = !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_DEFAULT_CHANNEL);
        const computer = await computerUseConnector.describeAction("health check");
        await completeJob(job.id, {
          gmail_linked: gmailOk,
          slack_configured: slackReady,
          computer_use: computer,
        });
        return;
      }

      case "inbox.monitor.stub":
      case "inbox.monitor": {
        const can = await checkCredits(job.user_id, "email_read");
        if (!can.unlimited && !can.allowed) {
          await completeJob(job.id, { error: can.reason, skipped: true });
          return;
        }
        await deductCredits(job.user_id, "email_read", "inbox.monitor");
        await appendLog(job.id, "Reading Gmail / Yahoo inboxes…");

        const gmail = await listUnreadGmail(job.user_id, 8);
        const yahoo = await listUnreadYahoo(job.user_id, 8);

        await completeJob(job.id, {
          gmail: gmail.error ? [] : gmail.messages,
          yahoo: yahoo.error ? [] : yahoo.messages,
          note:
            "Replies are not auto-sent. Use the dashboard agent with Gmail connected to draft replies.",
        });
        return;
      }

      case "slack.ping": {
        const text = String((job.payload as { text?: string }).text || "Inceptive agent tick ✓");
        const r = await slackConnector.postMessage(text);
        if (!r.ok) throw new Error(r.error || "slack failed");
        await completeJob(job.id, { posted: true });
        return;
      }

      case "computer.use.stub":
      case "computer.use": {
        const sessionId = String((job.payload as { sessionId?: string }).sessionId || "default");
        const instruction = String((job.payload as { instruction?: string }).instruction || "screenshot");
        await appendLog(job.id, `computer: ${instruction}`);

        const can = await checkCredits(job.user_id, "computer_use_action");
        if (!can.unlimited && !can.allowed) {
          await completeJob(job.id, { error: can.reason });
          return;
        }
        await deductCredits(job.user_id, "computer_use_action", "computer.job");

        const { data: u } = await admin()
          .from("users")
          .select("api_key_encrypted, api_provider")
          .eq("id", job.user_id)
          .single();

        const url = instruction.match(/https?:\/\/[^\s]+/)?.[0];
        if (url) {
          await computerGoto(job.user_id, sessionId, url);
        }

        const b64 = await computerScreenshot(job.user_id, sessionId);
        let caption = "";
        if (u?.api_key_encrypted && u.api_provider) {
          caption = await describeScreenshotBase64(
            u.api_key_encrypted,
            u.api_provider,
            b64
          ).catch(() => "");
        }
        await completeJob(job.id, { screenshot: true, vision: caption || null, opened_url: url || null });
        return;
      }

      default:
        throw new Error(`Unknown job kind: ${job.kind}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendLog(job.id, `error: ${msg}`);
    await requeueOrFail(job, msg);
  }
}
