"use server";

import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { trackEvent } from "@/lib/analytics";
import { chatWithGemini } from "@/lib/ai/proxy";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logActivity } from "@/lib/supabase/activity";

type BrowserTaskStep =
  | { type: "navigate"; url: string }
  | { type: "click"; selector: string; description?: string }
  | { type: "type"; selector: string; text: string }
  | { type: "screenshot" }
  | { type: "extract"; description: string };

const DEFAULT_BROWSER_PLANNER_MODEL =
  process.env.BROWSER_AGENT_MODEL || process.env.OPENROUTER_BROWSER_MODEL || "google/gemini-2.0-flash-001";

function hasOpenRouterKey() {
  return Boolean(
    process.env.OPENROUTER_KEY || process.env.OPENROUTER_DEFAULT_KEY || process.env.OPENROUTER_API_KEY
  );
}

function fallbackBrowserPlan(url: string): BrowserTaskStep[] {
  return [
    { type: "navigate", url },
    { type: "extract", description: "Key page content" },
    { type: "screenshot" },
  ];
}

async function generateBrowserPlan(taskDescription: string, url: string) {
  if (!hasOpenRouterKey()) {
    return fallbackBrowserPlan(url);
  }

  try {
    const response = await chatWithGemini({
      model: DEFAULT_BROWSER_PLANNER_MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: [
            "You are a browser automation planner.",
            "Return only valid JSON.",
            "Return an array of steps.",
            'Each step must be exactly one of: {"type":"navigate","url":"https://..."} or {"type":"click","selector":"...","description":"..."} or {"type":"type","selector":"...","text":"..."} or {"type":"screenshot"} or {"type":"extract","description":"..."}',
            "Prefer resilient CSS selectors.",
            "Keep the plan short and realistic.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Starting URL: ${url}\nTask: ${taskDescription}\nReturn only the JSON array.`,
        },
      ],
    });

    return parsePlannedSteps(response.content, url);
  } catch (error) {
    console.warn("[browser-agent] Falling back to deterministic plan", error);
    return fallbackBrowserPlan(url);
  }
}

export async function runBrowserTask(
  taskDescription: string,
  targetUrl: string,
  organizationId?: string | null
) {
  const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
  const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;

  if (!browserbaseApiKey || !browserbaseProjectId) {
    throw new Error("Browserbase is not configured. Add the Browserbase environment variables first.");
  }

  if (!taskDescription.trim()) {
    throw new Error("Task description is required.");
  }

  const normalizedUrl = (targetUrl || "https://www.google.com").trim();
  const bb = new Browserbase({ apiKey: browserbaseApiKey });

  let session: Awaited<ReturnType<typeof bb.sessions.create>> | null = null;
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;
  let page: any = null;
  const screenshots: string[] = [];
  const extracts: string[] = [];
  let stepsCompleted = 0;

  try {
    session = await bb.sessions.create({
      projectId: browserbaseProjectId,
      keepAlive: false,
      browserSettings: {
        recordSession: true,
        viewport: {
          width: 1440,
          height: 960,
        },
      },
    });

    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    page = context.pages()[0] ?? (await context.newPage());
    await page.goto(normalizedUrl, { waitUntil: "domcontentloaded" });

    const stepPlan = await generateBrowserPlan(taskDescription, normalizedUrl);

    for (const step of stepPlan) {
      if (!page) break;

      if (step.type === "navigate") {
        await page.goto(step.url, { waitUntil: "domcontentloaded" });
      }

      if (step.type === "click") {
        await page.waitForSelector(step.selector, { timeout: 15000 });
        await page.click(step.selector);
      }

      if (step.type === "type") {
        await page.waitForSelector(step.selector, { timeout: 15000 });
        await page.fill(step.selector, step.text);
      }

      if (step.type === "extract") {
        const extracted = await page.evaluate((description: string) => {
          const text = document.body?.innerText ?? "";
          const trimmed = text.replace(/\s+/g, " ").trim();
          return `${description}: ${trimmed.slice(0, 1200)}`;
        }, step.description);
        extracts.push(extracted);
      }

      if (step.type === "screenshot") {
        const image = await page.screenshot({ fullPage: true, type: "png" });
        screenshots.push(`data:image/png;base64,${image.toString("base64")}`);
      }

      stepsCompleted += 1;
    }

    if (screenshots.length === 0 && page) {
      const finalShot = await page.screenshot({ fullPage: true, type: "png" });
      screenshots.push(`data:image/png;base64,${finalShot.toString("base64")}`);
    }

    const summary = buildSummary(taskDescription, extracts, stepsCompleted);

    if (organizationId) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        void trackEvent(organizationId, user.id, "browser_agent_used", {
          task_length: taskDescription.length,
        });
      }

      await safeLogActivity({
        organizationId,
        actionType: "browser_task",
        title: taskDescription.trim().slice(0, 60),
        description: summary,
        metadata: {
          steps_completed: stepsCompleted,
          session_id: session.id,
          target_url: normalizedUrl,
          screenshots_count: screenshots.length,
        },
        status: "completed",
      });
    }

    return {
      success: true,
      steps_completed: stepsCompleted,
      screenshots,
      summary,
      session_id: session.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Browser task failed.";

    if (organizationId && session?.id) {
      await safeLogActivity({
        organizationId,
        actionType: "browser_task",
        title: taskDescription.trim().slice(0, 60),
        description: message,
        metadata: {
          steps_completed: stepsCompleted,
          session_id: session.id,
          target_url: normalizedUrl,
          screenshots_count: screenshots.length,
        },
        status: "failed",
      });
    }

    return {
      success: false,
      steps_completed: stepsCompleted,
      screenshots,
      summary: message,
      session_id: session?.id ?? "",
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }

    if (session) {
      await bb.sessions
        .update(session.id, {
          status: "REQUEST_RELEASE",
          projectId: browserbaseProjectId,
        })
        .catch(() => null);
    }
  }
}

function parsePlannedSteps(raw: string, fallbackUrl: string): BrowserTaskStep[] {
  const match = raw.match(/\[[\s\S]*\]/);
  const candidate = match ? match[0] : raw;
  const parsed = JSON.parse(candidate) as BrowserTaskStep[];
  const safeSteps = Array.isArray(parsed) ? parsed : [];

  if (safeSteps.length === 0 || safeSteps[0]?.type !== "navigate") {
    safeSteps.unshift({ type: "navigate", url: fallbackUrl });
  }

  if (!safeSteps.some((step) => step.type === "screenshot")) {
    safeSteps.push({ type: "screenshot" });
  }

  return safeSteps.slice(0, 8);
}

function buildSummary(taskDescription: string, extracts: string[], stepsCompleted: number) {
  if (extracts.length > 0) {
    return `Completed browser task in ${stepsCompleted} steps. Key extracted findings: ${extracts.join(" | ").slice(0, 1500)}`;
  }

  return `Completed browser task "${taskDescription.trim().slice(0, 100)}" in ${stepsCompleted} steps.`;
}

async function safeLogActivity(params: {
  organizationId: string;
  actionType: "browser_task";
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  status: "completed" | "failed";
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await logActivity(
      {
        organizationId: params.organizationId,
        userId: user?.id ?? null,
        actionType: params.actionType,
        title: params.title,
        description: params.description,
        metadata: params.metadata,
        status: params.status,
      },
      supabase
    );
  } catch {
    // Activity logging should never block the browser result.
  }
}
