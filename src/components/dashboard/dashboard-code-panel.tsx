"use client";

import React, { useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import { PISTON_LANGUAGE_IDS } from "@/lib/code/piston-client";
import type { Message } from "@/lib/chat-context";
import { cn } from "@/lib/utils";

type Lang = "python" | "javascript";

export function DashboardCodePanel({
  open,
  onClose,
  sessionToken,
  setMessages,
}: {
  open: boolean;
  onClose: () => void;
  sessionToken: string | undefined;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}) {
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState('print("Hello from Inceptive")');
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);

  if (!open) return null;

  const run = async () => {
    if (!sessionToken || !code.trim() || running) return;
    const userId = `u_code_${Date.now()}`;
    const assistantId = `a_code_${Date.now()}`;
    const fence = lang === "python" ? "python" : "javascript";
    const userContent = `Run code (${lang}):\n\`\`\`${fence}\n${code.trim()}\n\`\`\`${stdin.trim() ? `\n**stdin**\n\`\`\`\n${stdin}\n\`\`\`` : ""}`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: userContent, toolCalls: [], toolResults: [] },
      { id: assistantId, role: "assistant", content: "Running…", toolCalls: [], toolResults: [] },
    ]);

    setRunning(true);
    try {
      const res = await fetch("/api/code/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          source_code: code,
          language_id: PISTON_LANGUAGE_IDS[lang],
          stdin: stdin || undefined,
          wait: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      let out: string;
      if (res.status === 501) {
        out =
          typeof data.error === "string"
            ? data.error
            : "Code execution is not configured or failed.";
      } else if (!res.ok) {
        out = typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
        if (data.details) out += `\n\n\`\`\`json\n${JSON.stringify(data.details, null, 2).slice(0, 2000)}\n\`\`\``;
      } else {
        const parts = [
          data.status != null && `**status** ${JSON.stringify(data.status)}`,
          data.stdout && `**stdout**\n\`\`\`\n${String(data.stdout).trim()}\n\`\`\``,
          data.stderr && `**stderr**\n\`\`\`\n${String(data.stderr).trim()}\n\`\`\``,
          data.compile_output &&
            `**compile**\n\`\`\`\n${String(data.compile_output).trim()}\n\`\`\``,
          data.time != null && `time: ${data.time}`,
          data.memory != null && `memory: ${data.memory}`,
        ].filter(Boolean);
        out = parts.length ? parts.join("\n\n") : "_No output._";
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: out } : m))
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: `**Error**\n${msg}` } : m))
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--fg-primary)]">Run code</span>
          <span className="text-xs text-[var(--fg-muted)]">Python or JavaScript via sandbox</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]"
          aria-label="Close code panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 flex gap-1">
        {(["python", "javascript"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              lang === l
                ? "bg-white text-black"
                : "bg-[var(--bg-elevated)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
            )}
          >
            {l === "python" ? "Python" : "JavaScript"}
          </button>
        ))}
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
        disabled={running}
        className="mb-2 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 font-mono text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)] disabled:opacity-60"
        spellCheck={false}
      />

      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
          stdin (optional)
        </label>
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          rows={2}
          disabled={running}
          className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 font-mono text-xs text-[var(--fg-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-strong)] disabled:opacity-60"
        />
      </div>

      <button
        type="button"
        onClick={() => void run()}
        disabled={running || !code.trim() || !sessionToken}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--fg-primary)] py-2.5 text-sm font-medium text-[var(--bg-base)] disabled:opacity-50"
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Run in chat
          </>
        )}
      </button>
    </div>
  );
}
