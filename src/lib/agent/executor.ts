import { browserConnector, computerUseConnector, gmailConnector, slackConnector } from "@/lib/connectors";
import { computerGoto, computerScreenshot } from "@/lib/computer-use/session";
import { describeScreenshotBase64 } from "@/lib/vision/describe-screenshot";
import { createClient } from "@supabase/supabase-js";
import { listUnreadGmail } from "@/lib/email/gmail-api";
import { listUnreadYahoo } from "@/lib/email/yahoo-imap";
import { checkCredits, deductCredits } from "@/lib/credits";
import { buildModel } from "@/lib/ai-model";
import { routeModel } from "@/lib/ai/model-router";
import { generateText } from "ai";
import { Resend } from "resend";
import type { AgentJobRow } from "./types";
import { appendLog, completeJob, requeueOrFail } from "./task-queue";
import { formatSearchResultsForPrompt, searchWeb } from "@/lib/search/provider";

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

      case "social.publish.stub": {
        await completeJob(job.id, {
          skipped: true,
          message:
            "Legacy social.publish.stub job detected. Social publishing now runs via /api/actions/publish-post.",
        });
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

        let b64 = "";
        try {
          b64 = await computerScreenshot(job.user_id, sessionId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // On serverless runtimes Playwright browser binaries may be unavailable.
          if (msg.toLowerCase().includes("executable doesn't exist")) {
            await completeJob(job.id, {
              skipped: true,
              unavailable: true,
              reason:
                "Computer control is temporarily unavailable in this runtime. Please retry shortly or use manual browser mode.",
            });
            return;
          }
          throw err;
        }
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

      case "scheduled.prompt": {
        const name = String((job.payload as any)?.name || "Scheduled task");
        const prompt = String((job.payload as any)?.prompt || "");
        const scheduledTaskId = String((job.payload as any)?.scheduled_task_id || "");
        if (!prompt) throw new Error("scheduled.prompt missing prompt");

        const can = await checkCredits(job.user_id, "autonomous_job_hour");
        if (!can.unlimited && !can.allowed) {
          await completeJob(job.id, { skipped: true, error: can.reason });
          return;
        }
        await deductCredits(job.user_id, "autonomous_job_hour", "scheduled.prompt").catch(() => {});

        await appendLog(job.id, `Running scheduled task: ${name}`);

        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
        const openrouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";
        const routed = routeModel({ lastUserMessage: prompt, freeOnly: true });

        const model = geminiKey
          ? buildModel(geminiKey, "gemini", "gemini-2.0-flash")
          : openrouterKey
            ? buildModel(openrouterKey, "openrouter", routed.model)
            : null;

        if (!model) throw new Error("AI not configured for scheduled tasks (set GEMINI_API_KEY or OPENROUTER_KEY)");

        await appendLog(job.id, "Planning execution steps...");
        const planResult = await generateText({
          model,
          system:
            "You are an execution planner. Return exactly 3 bullet points: objective, one web query, and final deliverable format.",
          prompt: `Task name: ${name}\nTask prompt:\n${prompt}`,
        });
        const planText = (planResult.text || "").trim();
        await appendLog(job.id, `Plan ready: ${planText.slice(0, 180)}`);

        const searchQuery = extractSearchQuery(planText, prompt);
        await appendLog(job.id, `Tool step: searchWeb("${searchQuery}")`);
        const searchData = await searchWeb(searchQuery, 6);
        const searchContext = formatSearchResultsForPrompt(searchQuery, searchData);

        const result = await generateText({
          model,
          system:
            "You are Inceptive Autopilot. Execute the scheduled task using provided web context. Be concise, actionable, and cite URLs from the web context.",
          prompt: `Task:\n${prompt}\n\nExecution Plan:\n${planText}\n\nWeb Context:\n${searchContext}`,
        });

        const output = (result.text || "").trim();

        // Persist status on scheduled_tasks for UI
        if (scheduledTaskId) {
          await admin()
            .from("scheduled_tasks")
            .update({ last_status: "completed", last_error: null })
            .eq("id", scheduledTaskId);
        }

        // Optional: email results if Resend is configured + user has email
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          const { data: u } = await admin().from("users").select("email").eq("id", job.user_id).single();
          if (u?.email) {
            try {
              const resend = new Resend(resendKey);
              await resend.emails.send({
                from: "Inceptive AI <reports@inceptive-ai.com>",
                to: u.email,
                subject: `Inceptive Autopilot — ${name}`,
                html: `<pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, monospace">${output.replace(
                  /</g,
                  "&lt;"
                )}</pre>`,
              });
              await appendLog(job.id, "Emailed results");
            } catch {
              await appendLog(job.id, "Email failed (Resend)");
            }
          }
        }

        await completeJob(job.id, {
          name,
          plan: planText,
          search_query: searchQuery,
          search_provider: searchData.provider,
          output,
          emailed: !!process.env.RESEND_API_KEY,
        });
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

function extractSearchQuery(planText: string, fallbackPrompt: string): string {
  const fromPlan = planText.match(/web query[:\-]\s*(.+)$/im)?.[1]?.trim();
  if (fromPlan) return fromPlan.slice(0, 200);
  const firstLine = fallbackPrompt.split("\n")[0]?.trim() || fallbackPrompt;
  return firstLine.slice(0, 200);
}
