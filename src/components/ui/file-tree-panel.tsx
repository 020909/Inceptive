"use client";
import React from "react";
import { FileText, Code, Globe } from "lucide-react";
import { motion } from "framer-motion";

type GeneratedFile = { filename: string; language: string; content: string };

function fileIcon(filename: string) {
  if (filename.endsWith(".html")) return Globe;
  if (filename.endsWith(".css")) return Code;
  return FileText;
}

export function FileTreePanel({
  files,
  activeFile,
  onSelect,
}: {
  files: GeneratedFile[];
  activeFile: string | null;
  onSelect: (f: string) => void;
}) {
  return (
    <div className="w-52 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-[var(--border-subtle)]">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-muted)]">Generated Files</p>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((file, i) => {
          const Icon = fileIcon(file.filename);
          const isActive = activeFile === file.filename;
          return (
            <motion.button
              key={file.filename}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(file.filename)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--fg-primary)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--fg-primary)]"
              }`}
            >
              <Icon size={13} className={isActive ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"} />
              <span className="text-xs font-mono truncate">{file.filename}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
