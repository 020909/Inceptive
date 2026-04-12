"use client";

import React, { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Globe, Loader2, Monitor, Sparkles } from "lucide-react";
import { runBrowserTask } from "@/app/actions/browser-agent";
import { useAuth } from "@/lib/auth-context";
import { redirectToSignIn } from "@/lib/auth-gate";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

const REAL_MODE_PROGRESS = [
  "Launching browser...",
  "Connecting to cloud session...",
  "Planning browser actions with Claude...",
  "Executing browser steps...",
];

type BrowserTaskResult = Awaited<ReturnType<typeof runBrowserTask>>;

export function BrowserAgentConsole() {
  const { session } = useAuth();
  const { currentOrg } = useOrg();
  const [taskDescription, setTaskDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [result, setResult] = useState<BrowserTaskResult | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPending, startTransition] = useTransition();

  const screenshots = result?.screenshots ?? [];

  useEffect(() => {
    if (screenshots.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentSlide((value) => (value + 1) % screenshots.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [screenshots.length]);

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
    if (!session?.access_token) {
      redirectToSignIn();
      return;
    }

    startTransition(async () => {
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
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="browser-task">Task</Label>
            <Textarea
              id="browser-task"
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder=""
              className="min-h-44 rounded-2xl border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-[var(--fg-primary)]"
            />
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
