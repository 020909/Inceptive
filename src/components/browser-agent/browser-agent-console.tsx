"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Globe, Loader2, Monitor, Sparkles } from "lucide-react";
import { runBrowserTask } from "@/app/actions/browser-agent";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TASK_TEMPLATES = [
  {
    label: "Research leads on LinkedIn",
    task: "Search LinkedIn for [industry] decision makers (VP/Director+), extract their names, titles, company, and LinkedIn URL into a list",
  },
  {
    label: "Monitor competitor pricing",
    task: "Go to [competitor website], find their pricing page, and extract all plan names and prices",
  },
  {
    label: "Fill out a form",
    task: "Navigate to the URL and fill out the contact/signup form with the provided information",
  },
  {
    label: "Scrape company data",
    task: "Go to the website and extract: company name, description, founding year, team size, key products",
  },
  {
    label: "Check Google rankings",
    task: "Search Google for '[keyword]' and tell me the top 10 results with their URLs and meta descriptions",
  },
];

const DEMO_SCREENSHOTS = [
  "/browser-agent-demo-1.svg",
  "/browser-agent-demo-2.svg",
  "/browser-agent-demo-3.svg",
];

const REAL_MODE_PROGRESS = [
  "Launching browser...",
  "Connecting to cloud session...",
  "Planning browser actions with Claude...",
  "Executing browser steps...",
];

const DEMO_MODE_PROGRESS = [
  "Launching browser...",
  "Navigating to target website...",
  "Clicking through workflow...",
  "Extracting structured results...",
  "Preparing final summary...",
];

type BrowserTaskResult = Awaited<ReturnType<typeof runBrowserTask>>;

export function BrowserAgentConsole() {
  const { currentOrg } = useOrg();
  const [taskDescription, setTaskDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [result, setResult] = useState<BrowserTaskResult | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPending, startTransition] = useTransition();

  const screenshots = useMemo(() => {
    if (demoMode && !result) {
      return [];
    }
    return result?.screenshots ?? [];
  }, [demoMode, result]);

  useEffect(() => {
    if (screenshots.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentSlide((value) => (value + 1) % screenshots.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [screenshots]);

  const runDemoMode = async () => {
    setResult(null);
    setExecutionLog([]);
    setCurrentSlide(0);

    for (const [index, item] of DEMO_MODE_PROGRESS.entries()) {
      await wait(500);
      setExecutionLog((current) => [...current, item]);
      if (index === 1) setCurrentSlide(1);
      if (index === 2) setCurrentSlide(2);
    }

    await wait(6000);
    setExecutionLog((current) => [...current, "Task complete."]);
    setResult({
      success: true,
      steps_completed: 5,
      screenshots: DEMO_SCREENSHOTS,
      summary:
        "Successfully completed task. Found 12 leads, extracted contact details, and prepared outreach list.",
      session_id: "demo-mode-session",
    });
  };

  const runRealMode = async () => {
    setResult(null);
    setExecutionLog([]);
    setCurrentSlide(0);

    REAL_MODE_PROGRESS.forEach((item, index) => {
      window.setTimeout(() => {
        setExecutionLog((current) => (current.includes(item) ? current : [...current, item]));
      }, index * 900);
    });

    const nextResult = await runBrowserTask(taskDescription, targetUrl, currentOrg?.id ?? null);
    setExecutionLog((current) => [
      ...current,
      nextResult.success ? "Task complete." : "Task failed.",
    ]);
    setResult(nextResult);
  };

  const handleRunTask = () => {
    if (!taskDescription.trim()) return;

    startTransition(async () => {
      if (demoMode) {
        await runDemoMode();
        return;
      }
      await runRealMode();
    });
  };

  const previewImage = screenshots.length > 0 ? screenshots[currentSlide % screenshots.length] : null;

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 py-8 xl:flex-row">
      <Card className="w-full xl:w-[40%]">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <Globe size={20} className="text-[var(--fg-primary)]" />
            </div>
            <div>
              <CardTitle className="text-3xl">Browser Agent</CardTitle>
              <CardDescription>Give your AI agent a browser task in plain English.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--fg-primary)]">Demo mode</p>
              <p className="text-xs text-[var(--fg-muted)]">
                Turn this on for investor demos. It simulates the browser flow in 8 seconds.
              </p>
            </div>
            <button
              type="button"
              aria-pressed={demoMode}
              onClick={() => setDemoMode((value) => !value)}
              className={cn(
                "relative flex h-7 w-12 items-center rounded-full border border-[var(--border-default)] transition-colors",
                demoMode ? "bg-[var(--fg-primary)]" : "bg-[var(--bg-base)]"
              )}
            >
              <span
                className={cn(
                  "absolute left-1 size-5 rounded-full bg-[var(--bg-surface)] transition-transform",
                  demoMode ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="browser-task">Task</Label>
            <Textarea
              id="browser-task"
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder="Go to linkedin.com and search for 'enterprise IT leaders in Boston', then extract the first 10 names and job titles"
              className="min-h-44 rounded-2xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--fg-primary)]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {TASK_TEMPLATES.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => setTaskDescription(template.task)}
                className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--fg-primary)]"
              >
                {template.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="browser-url">Starting URL</Label>
            <Input
              id="browser-url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://... (starting URL, optional)"
              className="h-11 rounded-2xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-[var(--fg-primary)]"
            />
          </div>

          <Button
            size="lg"
            className="h-12 w-full rounded-2xl"
            disabled={isPending || !taskDescription.trim()}
            onClick={handleRunTask}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {isPending ? "Running task..." : "Run Task"}
          </Button>

          <div className="rounded-[28px] border border-[var(--border-default)] bg-[#0f1111] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#8ff7a7]">Execution Log</p>
              {isPending ? <Loader2 size={14} className="animate-spin text-[#8ff7a7]" /> : null}
            </div>

            <ScrollArea className="h-64 rounded-2xl bg-[#090a0a] p-3">
              <div className="space-y-2 font-mono text-sm text-[#8ff7a7]">
                {executionLog.length === 0 ? (
                  <p className="text-[#5f8a66]">Awaiting task...</p>
                ) : (
                  executionLog.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-start gap-2">
                      <span>✓</span>
                      <span>{item}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full xl:w-[60%]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
              <Monitor size={20} className="text-[var(--fg-primary)]" />
            </div>
            <div>
              <CardTitle className="text-3xl">Live Browser View</CardTitle>
              <CardDescription>Watch the browser session unfold step by step.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[#0f1111]">
            <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/60">
              Live Browser View
            </div>

            <div className="relative flex min-h-[420px] items-center justify-center bg-[#090a0a] p-4">
              {previewImage ? (
                <Image
                  src={previewImage}
                  alt="Browser session preview"
                  width={1600}
                  height={1000}
                  className="h-auto w-full rounded-2xl border border-white/10 object-cover"
                  unoptimized={previewImage.startsWith("data:image")}
                />
              ) : (
                <Image
                  src="/browser-agent-placeholder.svg"
                  alt="Browser placeholder"
                  width={1200}
                  height={760}
                  className="h-auto w-full max-w-4xl"
                />
              )}
            </div>
          </div>

          <Card className="rounded-[28px] bg-[var(--bg-elevated)]">
            <CardHeader>
              <CardTitle className="text-lg">AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-[var(--fg-secondary)]">
                {result?.summary ??
                  "Run a task to see screenshots, extracted information, and a concise summary of what the browser agent accomplished."}
              </p>
              {result?.session_id ? (
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                  Session: {result.session_id}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
