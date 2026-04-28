"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X } from "lucide-react";

type UploadResult = {
  queue_id?: string;
  entities?: Array<{
    id?: string;
    name: string;
    type?: string;
    sanctions_hit?: boolean;
    confidence?: number;
    citations?: Array<{ excerpt: string; source?: string; page?: number }>;
  }>;
  ownership_tree?: unknown;
  confidence?: number;
  screening_status?: string;
};

type UploadStatus =
  | { state: "idle" }
  | { state: "uploading"; progress: number }
  | { state: "success"; result: UploadResult }
  | { state: "error"; message: string };

export function DocumentUpload({ onUploaded }: { onUploaded?: (r: UploadResult) => void }) {
  const [status, setStatus] = useState<UploadStatus>({ state: "idle" });
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  const accept = useMemo(
    () => ({
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    }),
    []
  );

  const border = "1px solid var(--border-subtle)";
  const radius = 6;

  const startUpload = useCallback(
    (file: File) => {
      if (file.size > 50 * 1024 * 1024) {
        setStatus({ state: "error", message: "File must be <= 50MB." });
        return;
      }

      const form = new FormData();
      form.append("file", file);

      const xhr = new XMLHttpRequest();
      activeXhrRef.current = xhr;
      setStatus({ state: "uploading", progress: 0 });

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
        setStatus({ state: "uploading", progress: pct });
      };

      xhr.onerror = () => setStatus({ state: "error", message: "Upload failed. Please try again." });
      xhr.onabort = () => setStatus({ state: "idle" });
      xhr.onload = () => {
        try {
          if (xhr.status < 200 || xhr.status >= 300) {
            setStatus({ state: "error", message: `Upload failed (HTTP ${xhr.status}).` });
            return;
          }
          const json = (xhr.responseText ? JSON.parse(xhr.responseText) : {}) as UploadResult;
          setStatus({ state: "success", result: json });
          onUploaded?.(json);
        } catch {
          setStatus({ state: "error", message: "Upload completed but response was not valid JSON." });
        } finally {
          activeXhrRef.current = null;
        }
      };

      xhr.open("POST", "/api/ubo/upload", true);
      xhr.send(form);
    },
    [onUploaded]
  );

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files?.[0];
      if (!file) return;
      startUpload(file);
    },
    [startUpload]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 50 * 1024 * 1024,
    accept,
  });

  const rejectionText = useMemo(() => fileRejections?.[0]?.errors?.[0]?.message ?? null, [fileRejections]);

  const cancel = useCallback(() => {
    activeXhrRef.current?.abort();
    activeXhrRef.current = null;
  }, []);

  return (
    <div style={{ border, borderRadius: radius, background: "var(--surface-container)" }} className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Upload documents
          </div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            PDF, PNG, JPG, or DOCX. Max 50MB.
          </div>
        </div>

        {status.state === "uploading" ? (
          <button
            type="button"
            onClick={cancel}
            className="focus-ring"
            style={{
              border,
              borderRadius: radius,
              padding: "6px 10px",
              background: "transparent",
              color: "var(--text-primary)",
            }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
              <X size={14} />
              Cancel
            </span>
          </button>
        ) : null}
      </div>

      <div
        {...getRootProps()}
        className="mt-4 focus-ring"
        style={{
          border: isDragActive ? "1px solid var(--border-strong)" : border,
          borderRadius: radius,
          padding: 16,
          background: "var(--surface-primary)",
          cursor: status.state === "uploading" ? "not-allowed" : "pointer",
          opacity: status.state === "uploading" ? 0.7 : 1,
          userSelect: "none",
        }}
        aria-disabled={status.state === "uploading"}
      >
        <input {...getInputProps()} disabled={status.state === "uploading"} />
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: radius,
              background: "var(--surface-elevated)",
              border,
              display: "grid",
              placeItems: "center",
              color: "var(--text-primary)",
            }}
          >
            <Upload size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {isDragActive ? "Drop to upload" : "Drag & drop, or click to select"}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Uploads to `/api/ubo/upload`.
            </div>
          </div>
        </div>
      </div>

      {rejectionText ? (
        <div className="mt-3 text-xs" style={{ color: "var(--signal-negative)" }}>
          {rejectionText}
        </div>
      ) : null}

      {status.state === "uploading" ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>Uploading…</span>
            <span className="font-mono" style={{ color: "var(--text-primary)" }}>
              {status.progress}%
            </span>
          </div>
          <div
            className="mt-2"
            style={{
              height: 8,
              borderRadius: radius,
              background: "var(--surface-elevated)",
              border,
              overflow: "hidden",
            }}
          >
            <div style={{ width: `${status.progress}%`, height: "100%", background: "var(--text-primary)" }} />
          </div>
        </div>
      ) : null}

      {status.state === "success" ? (
        <div className="mt-4 p-3" style={{ border, borderRadius: radius, background: "var(--surface-elevated)" }}>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Upload complete
          </div>
          <div className="mt-1 text-xs font-mono" style={{ color: "var(--text-primary)" }}>
            queue_id={status.result.queue_id ?? "—"}
          </div>
        </div>
      ) : null}

      {status.state === "error" ? (
        <div
          className="mt-4 p-3"
          style={{
            border: "1px solid rgba(220, 38, 38, 0.35)",
            borderRadius: radius,
            background: "var(--signal-negative-bg)",
            color: "var(--signal-negative)",
          }}
        >
          <div className="text-xs font-semibold tracking-wide uppercase">Upload error</div>
          <div className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
            {status.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}

