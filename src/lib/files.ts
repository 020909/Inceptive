"use client";

import { useState, useCallback } from "react";
import { createClient } from "./supabase";

export interface FileItem {
  id: string;
  name: string;
  type: "folder" | "file";
  fileType?: "text" | "code" | "image" | "spreadsheet" | "pdf" | "other";
  mimeType?: string;
  size?: string;
  sizeBytes?: number;
  modifiedAt: Date;
  content?: string;
  children?: FileItem[];
  storagePath?: string;
  folderPath: string;
  isOpen?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Convert DB file to FileItem
function dbToFileItem(dbFile: any): FileItem {
  return {
    id: dbFile.id,
    name: dbFile.name,
    type: dbFile.is_folder ? "folder" : "file",
    fileType: dbFile.is_folder ? undefined : (dbFile.file_type as any),
    mimeType: dbFile.mime_type,
    size: dbFile.size_bytes ? formatBytes(dbFile.size_bytes) : undefined,
    sizeBytes: dbFile.size_bytes,
    modifiedAt: new Date(dbFile.updated_at),
    content: dbFile.content_preview || undefined,
    storagePath: dbFile.storage_path,
    folderPath: dbFile.folder_path,
    isOpen: false,
  };
}

// Hook for file operations
export function useFiles() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List files in a folder
  const listFiles = useCallback(async (folderPath: string = "/"): Promise<FileItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();

      const res = await fetch(`/api/files?path=${encodeURIComponent(folderPath)}`, {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to list files");
      }

      const { files } = await res.json();
      return files.map(dbToFileItem);
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload file
  const uploadFile = useCallback(
    async (file: File, folderPath: string = "/", parentId?: string): Promise<FileItem | null> => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder_path", folderPath);
        if (parentId) formData.append("parent_id", parentId);

        const res = await fetch("/api/files/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Upload failed");
        }

        const { file: dbFile } = await res.json();
        return dbToFileItem(dbFile);
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Create folder
  const createFolder = useCallback(
    async (name: string, folderPath: string = "/"): Promise<FileItem | null> => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();

        const res = await fetch("/api/files", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "create_folder",
            name,
            folder_path: folderPath,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to create folder");
        }

        const { id } = await res.json();
        return {
          id,
          name,
          type: "folder",
          folderPath,
          modifiedAt: new Date(),
          isOpen: true,
          children: [],
        };
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Delete file/folder
  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();

      const res = await fetch(`/api/files?id=${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete");
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get download URL
  const getDownloadUrl = useCallback(async (fileId: string): Promise<string | null> => {
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();

      const res = await fetch(`/api/files/download?id=${encodeURIComponent(fileId)}`, {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get download URL");
      }

      const { url } = await res.json();
      return url;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  // Fetch file content (for text/code files)
  const fetchContent = useCallback(async (fileId: string): Promise<string | null> => {
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();

      const res = await fetch(`/api/files/download?id=${encodeURIComponent(fileId)}`, {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get file");
      }

      const { url } = await res.json();

      // Fetch actual content from signed URL
      const contentRes = await fetch(url);
      if (!contentRes.ok) throw new Error("Failed to fetch content");

      return await contentRes.text();
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  return {
    listFiles,
    uploadFile,
    createFolder,
    deleteFile,
    getDownloadUrl,
    fetchContent,
    loading,
    error,
    clearError: () => setError(null),
  };
}
