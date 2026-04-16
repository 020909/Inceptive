"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Trash2,
  Search,
  MessageSquare,
  Sparkles,
  Loader2,
  Plus,
  X,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn, formatTimeAgo } from "@/lib/utils";

type KnowledgeDoc = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  status: "processing" | "ready" | "error";
  pageCount?: number;
};

type KnowledgeMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEMO_DOCS: KnowledgeDoc[] = [
  {
    id: "demo-1",
    name: "Employee Handbook 2026.pdf",
    size: 2400000,
    type: "pdf",
    uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: "ready",
    pageCount: 47,
  },
  {
    id: "demo-2",
    name: "Security Policy v3.docx",
    size: 890000,
    type: "docx",
    uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "ready",
    pageCount: 12,
  },
  {
    id: "demo-3",
    name: "Q1 2026 Operations Report.pdf",
    size: 1200000,
    type: "pdf",
    uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: "ready",
    pageCount: 23,
  },
];

const QUESTION_SUGGESTIONS = [
  "What does our security policy say about remote access?",
  "Summarize the Q1 operations report",
  "What are the PTO policies?",
  "Who should I contact for IT issues?",
];

function estimatePageCount(file: File) {
  const estimated = Math.max(1, Math.round(file.size / 95_000));
  return Math.min(estimated, 240);
}

async function readAgentStreamResponse(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim() || !line.startsWith("0:")) continue;

      try {
        const chunk = JSON.parse(line.slice(2));
        if (typeof chunk === "string") {
          fullContent += chunk;
        }
      } catch {
        // Ignore malformed stream lines and keep reading.
      }
    }
  }

  if (buffer.startsWith("0:")) {
    try {
      const chunk = JSON.parse(buffer.slice(2));
      if (typeof chunk === "string") {
        fullContent += chunk;
      }
    } catch {
      // Ignore trailing malformed stream line.
    }
  }

  return fullContent.trim();
}

function StatusBadge({ status }: { status: KnowledgeDoc["status"] }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(245,165,36,0.14)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
        <Loader2 size={12} className="animate-spin" />
        Indexing...
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,93,93,0.14)] px-3 py-1 text-xs font-medium text-[#ff8b8b]">
        Error
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(52,199,89,0.14)] px-3 py-1 text-xs font-medium text-[var(--success)]">
      Ready
    </span>
  );
}

export default function KnowledgePage() {
  const { session } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>(DEMO_DOCS);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<KnowledgeMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"documents" | "ask">("documents");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadTimeoutsRef = React.useRef<number[]>([]);

  useEffect(() => {
    return () => {
      uploadTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  const totalIndexedPages = docs.reduce((sum, doc) => sum + (doc.pageCount ?? 0), 0);

  const simulateUpload = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const nextDocs: KnowledgeDoc[] = fileArray.map((file, index) => ({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `knowledge-${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      type: file.type || file.name.split(".").pop() || "file",
      uploadedAt: new Date().toISOString(),
      status: "processing",
      pageCount: estimatePageCount(file),
    }));

    setDocs((current) => [...nextDocs, ...current]);
    toast.success(fileArray.length === 1 ? "Document uploaded" : `${fileArray.length} documents uploaded`);

    nextDocs.forEach((doc) => {
      const timeoutId = window.setTimeout(() => {
        setDocs((current) =>
          current.map((currentDoc) =>
            currentDoc.id === doc.id
              ? {
                  ...currentDoc,
                  status: "ready",
                }
              : currentDoc,
          ),
        );
      }, 2000);

      uploadTimeoutsRef.current.push(timeoutId);
    });
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    simulateUpload(event.target.files);
    event.target.value = "";
  };

  const handleAsk = async () => {
    if (docs.length === 0) {
      toast.error("Upload documents first to ask questions.");
      return;
    }

    const nextQuestion = question.trim();
    if (!nextQuestion) return;

    const userMessage: KnowledgeMessage = { role: "user", content: nextQuestion };
    setMessages((current) => [...current, userMessage]);
    setIsAsking(true);
    setQuestion("");

    try {
      const response = await fetch("/api/agent/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `You are answering questions based on the user's uploaded knowledge base documents: ${docs
                .map((doc) => doc.name)
                .join(", ")}. Answer concisely and cite which document you're drawing from.\n\nQuestion: ${nextQuestion}`,
            },
          ],
          attachedFiles: [],
        }),
      });

      if (!response.ok) {
        throw new Error("Knowledge base answer failed");
      }

      const assistantContent = await readAgentStreamResponse(response);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            assistantContent ||
            "I could not retrieve a grounded answer from your documents right now. Try uploading more source material or rephrasing the question.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "I could not retrieve a grounded answer from your documents right now. Try uploading more source material or rephrasing the question.",
        },
      ]);
      toast.error("Could not answer from the knowledge base.");
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="page-frame max-w-[72rem] animate-fade-in-up">
      <div className="mb-6 animate-fade-in-up">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">
          <BookOpen size={11} />
          Knowledge Base
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)]">Company Intelligence</h1>
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm transition-colors",
            activeTab === "documents"
              ? "bg-[var(--accent)] font-medium text-white"
              : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
          )}
        >
          Documents
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ask")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm transition-colors",
            activeTab === "ask"
              ? "bg-[var(--accent)] font-medium text-white"
              : "text-[var(--fg-muted)] hover:text-[var(--fg-primary)]",
          )}
        >
          Ask AI
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "documents" ? (
          <motion.div
            key="documents"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                if (event.dataTransfer.files?.length) {
                  simulateUpload(event.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "mb-6 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all",
                isDragging
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]",
              )}
            >
              <Upload size={28} className="mx-auto mb-3 text-[var(--fg-muted)]" />
              <p className="text-sm font-medium text-[var(--fg-primary)]">Drop files here or click to upload</p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">PDF, DOCX, TXT, CSV — up to 50MB each</p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <Plus size={14} />
                Choose Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.csv"
                onChange={handleFileInputChange}
              />
            </div>

            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                <Search size={14} />
                <span>
                  {docs.length} documents · {totalIndexedPages} pages indexed
                </span>
              </div>
            </div>

            <div>
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="mb-2 flex items-center gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
                >
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2.5 text-[var(--fg-primary)]">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--fg-primary)]">{doc.name}</p>
                    <p className="mt-1 text-sm text-[var(--fg-muted)]">
                      {(doc.size / 1024 / 1024).toFixed(1)} MB · {doc.pageCount ?? 0} pages
                    </p>
                    <p className="mt-1 text-xs text-[var(--fg-muted)]">Uploaded {formatTimeAgo(new Date(doc.uploadedAt))}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={doc.status} />
                    <button
                      type="button"
                      onClick={() => setDocs((current) => current.filter((currentDoc) => currentDoc.id !== doc.id))}
                      className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2.5 text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-primary)]"
                      aria-label={`Remove ${doc.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ask"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sticky top-0 z-10 mb-4 bg-[var(--bg-base)] pb-3">
              <div className="relative">
                <MessageSquare size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !isAsking) {
                      void handleAsk();
                    }
                  }}
                  placeholder="Ask anything about your documents..."
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] py-3.5 pl-10 pr-44 text-sm text-[var(--fg-primary)] outline-none transition-colors focus:border-[var(--accent)]"
                />
                {question ? (
                  <button
                    type="button"
                    onClick={() => setQuestion("")}
                    className="absolute right-28 top-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-primary)]"
                    aria-label="Clear question"
                  >
                    <X size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleAsk()}
                  disabled={isAsking || !question.trim()}
                  className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {isAsking ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isAsking ? "Asking..." : "Ask"}
                </button>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="mb-5">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                  <Search size={12} />
                  Suggested Questions
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setQuestion(suggestion)}
                      className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--fg-secondary)] transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={`${message.role}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-[0_12px_30px_rgba(0,0,0,0.16)]",
                      message.role === "user"
                        ? "bg-white text-[#0b0b0b]"
                        : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-primary)]",
                    )}
                  >
                    {message.content}
                  </div>
                </motion.div>
              ))}

              {isAsking ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--fg-muted)]">
                    <Loader2 size={15} className="animate-spin" />
                    Grounding answer in your documents...
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
