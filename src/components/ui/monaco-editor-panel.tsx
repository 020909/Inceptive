"use client";
import React from "react";
import Editor from "@monaco-editor/react";

interface MonacoEditorPanelProps {
  code: string;
  language: string;
  height?: number;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export function MonacoEditorPanel({
  code,
  language,
  height = 300,
  onChange,
  readOnly = true,
}: MonacoEditorPanelProps) {
  return (
    <Editor
      height={height}
      language={language}
      value={code}
      onChange={onChange}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { vertical: "hidden", horizontal: "hidden" },
      }}
    />
  );
}
