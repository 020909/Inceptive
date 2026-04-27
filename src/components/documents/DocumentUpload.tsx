"use client";

import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "parsing" | "completed" | "failed";
  progress: number;
  error?: string;
  documentId?: string;
}

interface DocumentUploadProps {
  caseId: string;
  orgId: string;
  onUploadComplete?: (documentId: string) => void;
  onUploadFailed?: (error: string) => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ACCEPTED_MIME_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-5 w-5 text-red-400" />,
  image: <Image className="h-5 w-5 text-blue-400" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  xlsx: <FileSpreadsheet className="h-5 w-5 text-emerald-500" />,
  default: <File className="h-5 w-5 text-slate-400" />,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getFileTypeIcon(fileType: string): React.ReactNode {
  if (fileType.includes("pdf")) return FILE_TYPE_ICONS.pdf;
  if (fileType.includes("image")) return FILE_TYPE_ICONS.image;
  if (fileType.includes("word") || fileType.includes("docx")) return FILE_TYPE_ICONS.docx;
  if (fileType.includes("excel") || fileType.includes("xlsx")) return FILE_TYPE_ICONS.xlsx;
  return FILE_TYPE_ICONS.default;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getStatusBadge(status: UploadFile["status"]): React.ReactNode {
  switch (status) {
    case "pending":
      return <Badge variant="outline">Pending</Badge>;
    case "uploading":
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading
        </Badge>
      );
    case "parsing":
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Parsing
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="positive" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-normal uppercase tracking-[0.12em] text-red-500">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      );
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentUpload({
  caseId,
  orgId,
  onUploadComplete,
  onUploadFailed,
  className,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      // Handle rejected files
      fileRejections.forEach((rejection) => {
        const file = rejection.file;
        const error = rejection.errors?.[0];
        if (error?.code === "file-too-large") {
          toast.error(`${file.name} is too large (max 50MB)`);
        } else {
          toast.error(`${file.name}: ${error?.message || "Invalid file type"}`);
        }
      });

      // Add accepted files
      const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "pending",
        progress: 0,
      }));

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        // Start uploading files
        newFiles.forEach((file) => uploadFile(file));
      }
    },
    [caseId, orgId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  useEffect(() => {
    setIsDragging(isDragActive);
  }, [isDragActive]);

  const uploadFile = async (uploadFile: UploadFile) => {
    const supabase = createClient();

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) => (f.id === uploadFile.id ? { ...f, status: "uploading" } : f))
    );

    try {
      // Generate storage path: {org_id}/cases/{case_id}/{filename}
      const storagePath = `${orgId}/cases/${caseId}/${uploadFile.id}-${uploadFile.name}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("case-documents")
        .upload(storagePath, uploadFile.file, {
          contentType: uploadFile.file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Update progress
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, progress: 100 } : f
        )
      );

      // Create document row in database
      const { data: document, error: dbError } = await supabase
        .from("case_documents")
        .insert({
          case_id: caseId,
          org_id: orgId,
          file_name: uploadFile.name,
          file_type: getFileType(uploadFile.file.type, uploadFile.file.name),
          mime_type: uploadFile.file.type,
          file_size: uploadFile.file.size,
          storage_path: storagePath,
          parsing_status: "pending",
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Failed to create document record: ${dbError.message}`);
      }

      // Update file with document ID
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, documentId: document.id, status: "parsing" }
            : f
        )
      );

      // Trigger parse API
      const parseResponse = await fetch("/api/documents/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: document.id,
          caseId,
          orgId,
        }),
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || "Failed to parse document");
      }

      const parseResult = await parseResponse.json();

      // Update status to completed
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "completed" } : f
        )
      );

      toast.success(`${uploadFile.name} uploaded and parsed successfully`);
      onUploadComplete?.(document.id);
    } catch (error: any) {
      console.error("Upload error:", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "failed", error: error.message }
            : f
        )
      );
      toast.error(`Failed to upload ${uploadFile.name}: ${error.message}`);
      onUploadFailed?.(error.message);
    }
  };

  const removeFile = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    // If file was uploaded, delete from storage
    if (file.documentId && file.status !== "failed") {
      const supabase = createClient();
      const storagePath = `${orgId}/cases/${caseId}/${file.id}-${file.name}`;

      try {
        // Delete from storage
        await supabase.storage.from("case-documents").remove([storagePath]);

        // Delete from database
        if (file.documentId) {
          await supabase.from("case_documents").delete().eq("id", file.documentId);
        }
      } catch (err) {
        console.error("Failed to delete file:", err);
      }
    }

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const retryFile = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    // Reset status and re-upload
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: "pending", progress: 0, error: undefined }
          : f
      )
    );

    await uploadFile(file);
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "completed"));
  };

  const hasCompleted = files.some((f) => f.status === "completed");
  const hasUploading = files.some(
    (f) => f.status === "uploading" || f.status === "parsing"
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer",
          "bg-[var(--bg-overlay)] border-[var(--border-default)]",
          isDragging && "border-[var(--accent)] bg-[var(--accent-soft)]/20",
          "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/10"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
              isDragging
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg-elevated)] text-[var(--fg-muted)]"
            )}
          >
            <Upload className="h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--fg-primary)]">
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              or click to browse
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <Badge variant="outline" className="text-[10px]">PDF</Badge>
            <Badge variant="outline" className="text-[10px]">PNG</Badge>
            <Badge variant="outline" className="text-[10px]">JPG</Badge>
            <Badge variant="outline" className="text-[10px]">DOCX</Badge>
            <Badge variant="outline" className="text-[10px]">XLSX</Badge>
          </div>
          <p className="text-xs text-[var(--fg-muted)]">
            Max file size: 50MB
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--fg-primary)]">
              Files ({files.length})
            </p>
            {hasCompleted && !hasUploading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
                className="text-xs h-7"
              >
                Clear completed
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  "bg-[var(--bg-overlay)] border-[var(--border-default)]",
                  file.status === "failed" && "border-red-500/30 bg-red-500/5"
                )}
              >
                {/* File Icon */}
                <div className="shrink-0">{getFileTypeIcon(file.type)}</div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--fg-primary)] truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                    <span>{formatFileSize(file.size)}</span>
                    {file.error && (
                      <span className="text-red-500 truncate">{file.error}</span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(file.status === "uploading" || file.status === "parsing") && (
                    <div className="mt-2 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="shrink-0">{getStatusBadge(file.status)}</div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1">
                  {file.status === "failed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
                      onClick={() => retryFile(file.id)}
                    >
                      <Loader2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[var(--fg-muted)] hover:text-red-500"
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === "uploading" || file.status === "parsing"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to determine file type
function getFileType(mimeType: string, fileName: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("image")) return "image";
  if (mimeType.includes("word") || mimeType.includes("docx") || fileName.endsWith(".docx")) {
    return "docx";
  }
  if (mimeType.includes("excel") || mimeType.includes("xlsx") || fileName.endsWith(".xlsx")) {
    return "xlsx";
  }
  return "other";
}
