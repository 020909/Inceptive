"use client";

import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder, FileText, FileCode, FileSpreadsheet, Image, File,
  ChevronRight, ChevronDown, Download, Eye, Trash2, Upload,
  Plus, AlertCircle, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFiles, type FileItem } from "@/lib/files";
import { toast } from "sonner";

function getFileIcon(fileType?: string) {
  switch (fileType) {
    case "code":
      return <FileCode className="w-4 h-4 text-[var(--accent)]" />;
    case "text":
      return <FileText className="w-4 h-4 text-[var(--foreground-secondary)]" />;
    case "spreadsheet":
      return <FileSpreadsheet className="w-4 h-4 text-[var(--success)]" />;
    case "image":
      return <Image className="w-4 h-4 text-[var(--warning)]" />;
    default:
      return <File className="w-4 h-4 text-[var(--foreground-muted)]" />;
  }
}

interface FileTreeItemProps {
  item: FileItem;
  level?: number;
  onSelect: (item: FileItem) => void;
  selectedId?: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function FileTreeItem({ item, level = 0, onSelect, selectedId, onToggle, onDelete }: FileTreeItemProps) {
  const isSelected = selectedId === item.id;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group",
          isSelected
            ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
            : "hover:bg-[var(--background-overlay)] text-[var(--foreground-secondary)]"
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {item.type === "folder" ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
              className="p-0.5 hover:bg-[var(--background)] rounded"
            >
              {item.isOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            <Folder className="w-4 h-4 text-[var(--foreground-tertiary)]" />
          </>
        ) : (
          <>
            <span className="w-6" />
            {getFileIcon(item.fileType)}
          </>
        )}
        <span className="text-xs truncate flex-1">{item.name}</span>

        {/* Delete button on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--destructive)]/10 rounded transition-all"
        >
          <Trash2 className="w-3 h-3 text-[var(--destructive)]" />
        </button>
      </motion.div>

      {/* Render children if folder is open */}
      <AnimatePresence>
        {item.type === "folder" &&
          item.isOpen &&
          item.children?.map((child) => (
            <motion.div
              key={child.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <FileTreeItem
                item={child}
                level={level + 1}
                onSelect={onSelect}
                selectedId={selectedId}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

export function FileWorkspace() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");

  const {
    listFiles,
    uploadFile,
    createFolder,
    deleteFile,
    fetchContent,
    loading,
    error,
  } = useFiles();

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  const loadFiles = async () => {
    const items = await listFiles(currentPath);
    setFiles(items);
  };

  const toggleFolder = async (id: string) => {
    setFiles((prev) => {
      const updateFiles = (items: FileItem[]): FileItem[] => {
        return items.map((item) => {
          if (item.id === id) {
            return { ...item, isOpen: !item.isOpen };
          }
          if (item.children) {
            return { ...item, children: updateFiles(item.children) };
          }
          return item;
        });
      };
      return updateFiles(prev);
    });
  };

  const handleSelectFile = async (item: FileItem) => {
    setSelectedFile(item);
    if (item.type === "file" && (item.fileType === "text" || item.fileType === "code")) {
      const content = await fetchContent(item.id);
      setFileContent(content);
    } else {
      setFileContent(null);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteFile(id);
    if (success) {
      toast.success("File deleted");
      if (selectedFile?.id === id) {
        setSelectedFile(null);
        setFileContent(null);
      }
      loadFiles();
    } else {
      toast.error("Failed to delete file");
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folder = await createFolder(newFolderName, currentPath);
    if (folder) {
      toast.success("Folder created");
      setNewFolderName("");
      setIsCreatingFolder(false);
      loadFiles();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const uploaded = await uploadFile(file, currentPath);
    if (uploaded) {
      toast.success("File uploaded");
      loadFiles();
    }
    setIsUploading(false);
    e.target.value = ""; // Reset input
  };

  const renderCode = (content: string) => {
    const lines = content.split("\n");
    return (
      <div className="font-mono text-xs">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="text-[var(--foreground-muted)] w-8 text-right pr-3 select-none">
              {i + 1}
            </span>
            <span className="text-[var(--foreground-secondary)] whitespace-pre">
              {line || " "}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-8 h-8 text-[var(--destructive)] mb-2" />
        <p className="text-sm text-[var(--foreground-secondary)]">{error}</p>
        <button
          onClick={loadFiles}
          className="mt-2 text-xs text-[var(--accent)] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="p-1.5 hover:bg-[var(--background-overlay)] rounded transition-colors"
            title="New folder"
          >
            <Plus className="w-4 h-4 text-[var(--foreground-secondary)]" />
          </button>
          <label className="p-1.5 hover:bg-[var(--background-overlay)] rounded transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-[var(--foreground-secondary)]" />
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
        {isUploading && (
          <span className="text-[10px] text-[var(--foreground-muted)]">Uploading...</span>
        )}
      </div>

      {/* New Folder Input */}
      <AnimatePresence>
        {isCreatingFolder && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 border-b border-[var(--border)]"
          >
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-[var(--foreground-tertiary)]" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") setIsCreatingFolder(false);
                }}
                placeholder="Folder name"
                className="flex-1 bg-transparent text-xs text-[var(--foreground)] outline-none"
                autoFocus
              />
              <button
                onClick={handleCreateFolder}
                className="text-[10px] px-2 py-1 bg-[var(--foreground)] text-[var(--background)] rounded"
              >
                Create
              </button>
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="p-1 hover:bg-[var(--background-overlay)] rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {loading && files.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[var(--foreground-muted)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <Folder className="w-8 h-8 text-[var(--foreground-muted)] mb-2" />
            <p className="text-xs text-[var(--foreground-tertiary)]">No files yet</p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              Upload files or create folders
            </p>
          </div>
        ) : (
          files.map((item) => (
            <FileTreeItem
              key={item.id}
              item={item}
              onSelect={handleSelectFile}
              selectedId={selectedFile?.id}
              onToggle={toggleFolder}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* File Preview Panel */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "45%" }}
            exit={{ height: 0 }}
            className="border-t border-[var(--border)] bg-[var(--background)]"
          >
            {/* Preview Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--background-elevated)]">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile.fileType)}
                <span className="text-xs font-medium text-[var(--foreground)]">
                  {selectedFile.name}
                </span>
                {selectedFile.size && (
                  <span className="text-[10px] text-[var(--foreground-muted)]">
                    {selectedFile.size}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {selectedFile.fileType === "image" && (
                  <button className="p-1.5 hover:bg-[var(--background-overlay)] rounded transition-colors">
                    <Eye className="w-3.5 h-3.5 text-[var(--foreground-tertiary)]" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 hover:bg-[var(--background-overlay)] rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[var(--foreground-tertiary)]" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="h-[calc(100%-41px)] overflow-auto p-3">
              {selectedFile.fileType === "image" ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Image preview coming soon
                  </p>
                </div>
              ) : selectedFile.fileType === "code" ? (
                fileContent ? (
                  renderCode(fileContent)
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-4 h-4 border-2 border-[var(--foreground-muted)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )
              ) : selectedFile.fileType === "text" ? (
                fileContent ? (
                  <div className="prose-inceptive text-xs">
                    <ReactMarkdown>{fileContent}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-4 h-4 border-2 border-[var(--foreground-muted)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-xs text-[var(--foreground-muted)] mb-2">
                    Preview not available for this file type
                  </p>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity">
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
