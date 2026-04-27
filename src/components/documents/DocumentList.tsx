"use client";

import React, { useState, useCallback } from "react";
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  ExternalLink,
  RefreshCw,
  Loader2,
  Eye,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocumentStatus = "pending" | "parsing" | "completed" | "failed";

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  parsing_status: DocumentStatus;
  parsing_error: string | null;
  parsed_text: string | null;
  created_at: string;
  storage_path: string;
  case_id: string;
  org_id: string;
}

interface DocumentListProps {
  documents: Document[];
  caseId: string;
  orgId: string;
  isLoading?: boolean;
  onRetry?: (documentId: string) => void;
  onView?: (document: Document) => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-5 w-5 text-red-400" />,
  image: <Image className="h-5 w-5 text-blue-400" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  xlsx: <FileSpreadsheet className="h-5 w-5 text-emerald-500" />,
  default: <File className="h-5 w-5 text-slate-400" />,
};

const STATUS_COLORS: Record<DocumentStatus, { bg: string; text: string; border: string }> = {
  pending: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
  },
  parsing: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  completed: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/20",
  },
  failed: {
    bg: "bg-red-500/10",
    text: "text-red-500",
    border: "border-red-500/20",
  },
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Pending",
  parsing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getFileTypeIcon(fileType: string): React.ReactNode {
  if (fileType.includes("pdf")) return FILE_TYPE_ICONS.pdf;
  if (fileType.includes("image")) return FILE_TYPE_ICONS.image;
  if (fileType.includes("docx")) return FILE_TYPE_ICONS.docx;
  if (fileType.includes("xlsx")) return FILE_TYPE_ICONS.xlsx;
  return FILE_TYPE_ICONS.default;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const colors = STATUS_COLORS[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "uppercase text-[10px] tracking-wider font-medium",
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {status === "parsing" && (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      )}
      {status === "completed" && (
        <Eye className="h-3 w-3 mr-1" />
      )}
      {status === "failed" && (
        <AlertCircle className="h-3 w-3 mr-1" />
      )}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentList({
  documents,
  caseId,
  orgId,
  isLoading = false,
  onRetry,
  onView,
  className,
}: DocumentListProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const handleView = useCallback(
    async (document: Document) => {
      setViewingId(document.id);
      try {
        const supabase = createClient();
        const { data: urlData, error } = await supabase.storage
          .from("case-documents")
          .createSignedUrl(document.storage_path, 3600); // 1 hour

        if (error || !urlData?.signedUrl) {
          throw new Error("Failed to generate signed URL");
        }

        // Open file in new tab
        window.open(urlData.signedUrl, "_blank", "noopener,noreferrer");

        // Call optional onView callback
        onView?.(document);
      } catch (error: any) {
        console.error("Failed to view document:", error);
        toast.error("Failed to open document: " + error.message);
      } finally {
        setViewingId(null);
      }
    },
    [onView]
  );

  const handleRetry = useCallback(
    async (document: Document) => {
      setRetryingId(document.id);
      try {
        const response = await fetch("/api/documents/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId: document.id,
            caseId: document.case_id || caseId,
            orgId: document.org_id || orgId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to retry parsing");
        }

        toast.success(`Retrying parse for ${document.file_name}`);
        onRetry?.(document.id);
      } catch (error: any) {
        console.error("Failed to retry parsing:", error);
        toast.error("Failed to retry: " + error.message);
      } finally {
        setRetryingId(null);
      }
    },
    [caseId, orgId, onRetry]
  );

  const handleViewParsedText = useCallback((document: Document) => {
    if (!document.parsed_text) {
      toast.error("No parsed text available");
      return;
    }

    // Open a modal or new window with parsed text
    const newWindow = window.open("", "_blank", "width=800,height=600");
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Parsed Text - ${document.file_name}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 24px;
                background: #0a0a0a;
                color: #e5e5e5;
                line-height: 1.6;
              }
              h1 {
                font-size: 18px;
                margin-bottom: 16px;
                color: #fff;
              }
              .meta {
                font-size: 12px;
                color: #888;
                margin-bottom: 24px;
                padding-bottom: 16px;
                border-bottom: 1px solid #333;
              }
              pre {
                white-space: pre-wrap;
                word-wrap: break-word;
                background: #1a1a1a;
                padding: 16px;
                border-radius: 8px;
                border: 1px solid #333;
                font-size: 14px;
                max-height: 80vh;
                overflow: auto;
              }
            </style>
          </head>
          <body>
            <h1>${document.file_name}</h1>
            <div class="meta">
              Type: ${document.file_type} | 
              Size: ${formatFileSize(document.file_size)} | 
              Parsed: ${formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
            </div>
            <pre>${document.parsed_text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  }, []);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-14 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-overlay)] border border-[var(--border-default)] flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6 text-[var(--fg-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--fg-primary)]">
          No documents
        </p>
        <p className="text-xs text-[var(--fg-muted)] mt-1">
          Upload documents to this case to start the review process.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("border border-[var(--border-default)] rounded-xl overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Uploaded</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow
              key={document.id}
              className="group cursor-pointer"
              onClick={() =>
                document.parsing_status === "completed" && handleViewParsedText(document)
              }
            >
              <TableCell>
                <div className="flex items-center justify-center">
                  {getFileTypeIcon(document.file_type)}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-[var(--fg-primary)] truncate max-w-[200px] sm:max-w-[300px]">
                    {document.file_name}
                  </span>
                  <span className="text-xs text-[var(--fg-muted)] capitalize">
                    {document.file_type}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <span className="text-sm text-[var(--fg-secondary)]">
                  {formatFileSize(document.file_size)}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={document.parsing_status} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-sm text-[var(--fg-secondary)]">
                  {formatDistanceToNow(new Date(document.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {/* View button - always available */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView(document);
                    }}
                    disabled={viewingId === document.id}
                    title="View file"
                  >
                    {viewingId === document.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Retry button - only for failed documents */}
                  {document.parsing_status === "failed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry(document);
                      }}
                      disabled={retryingId === document.id}
                      title="Retry parsing"
                    >
                      {retryingId === document.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* View parsed text button - only for completed documents */}
                  {document.parsing_status === "completed" && document.parsed_text && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewParsedText(document);
                      }}
                    >
                      View Text
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Summary Footer */}
      <div className="border-t border-[var(--border-default)] px-4 py-3 bg-[var(--bg-overlay)]">
        <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
          <span>
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {documents.filter((d) => d.parsing_status === "completed").length} completed
            </span>
            {documents.some((d) => d.parsing_status === "failed") && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {documents.filter((d) => d.parsing_status === "failed").length} failed
              </span>
            )}
            {documents.some((d) => d.parsing_status === "parsing") && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                {documents.filter((d) => d.parsing_status === "parsing").length} processing
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
