"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FolderOpen,
  Clock,
  Archive,
  Trash2,
  Code2,
  FileText,
  Globe,
  LayoutTemplate,
  Search,
  X,
  Github,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Project {
  id: string;
  name: string;
  description: string;
  template: string;
  status: string;
  github_repo: string | null;
  github_branch: string;
  last_opened_at: string;
  created_at: string;
}

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  blank: FileText,
  nextjs: Code2,
  react: Code2,
  "landing-page": Globe,
  api: Code2,
  document: FileText,
};

const TEMPLATES = [
  { id: "blank", name: "Blank Project", desc: "Start from scratch" },
  { id: "nextjs", name: "Next.js App", desc: "Full-stack with App Router" },
  { id: "react", name: "React App", desc: "Single-page application" },
  { id: "landing-page", name: "Landing Page", desc: "Marketing page template" },
  { id: "api", name: "API Backend", desc: "RESTful API starter" },
  { id: "document", name: "Document", desc: "PPT, PDF, or Excel project" },
];

function NewProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("blank");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, template }),
      });
      if (res.ok) {
        setName("");
        setDescription("");
        setTemplate("blank");
        onCreated();
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[var(--fg-primary)]">New Project</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--fg-secondary)] mb-1.5 block">Project Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My awesome project"
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--fg-secondary)] mb-1.5 block">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project about?"
                  rows={2}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--fg-secondary)] mb-1.5 block">Template</label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map((t) => {
                    const Icon = TEMPLATE_ICONS[t.id] || FileText;
                    const isSelected = template === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200 ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_12px_rgba(10,132,255,0.1)]"
                            : "border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]"
                        }`}
                      >
                        <Icon size={16} className={isSelected ? "text-[var(--accent)]" : "text-[var(--fg-muted)]"} />
                        <span className={`text-[11px] font-medium ${isSelected ? "text-[var(--accent)]" : "text-[var(--fg-secondary)]"}`}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] rounded-xl hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-[var(--fg-primary)] text-[var(--bg-base)] hover:opacity-90 disabled:opacity-40 transition-all duration-200 hover-lift"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const Icon = TEMPLATE_ICONS[project.template] || FileText;
  const timeAgo = getRelativeTime(project.last_opened_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 24 }}
      className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 cursor-pointer transition-all duration-300 hover:border-[var(--border-default)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover-lift"
    >
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-[var(--accent-soft)] to-transparent" style={{ opacity: 0 }} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Icon size={16} className="text-[var(--fg-secondary)]" />
          </div>
          {project.github_repo && (
            <Github size={13} className="text-[var(--fg-muted)]" />
          )}
        </div>

        <h3 className="text-sm font-semibold text-[var(--fg-primary)] mb-1 truncate">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mb-3">{project.description}</p>
        )}

        <div className="flex items-center gap-2 text-[10px] text-[var(--fg-muted)]">
          <Clock size={10} />
          <span>{timeAgo}</span>
          <span className="text-[var(--border-default)]">·</span>
          <span className="capitalize">{project.template}</span>
        </div>
      </div>
    </motion.div>
  );
}

function getRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 min-h-screen bg-[var(--bg-app)] text-[var(--fg-primary)]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-1">Organize your code, documents, and creative work</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--fg-primary)] text-[var(--bg-base)] text-sm font-semibold hover:opacity-90 transition-all duration-200 hover-lift"
          >
            <Plus size={15} />
            New Project
          </button>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-9 pr-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
            />
          </div>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
              <FolderOpen size={24} className="text-[var(--fg-muted)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--fg-primary)] mb-1">No projects yet</h3>
            <p className="text-xs text-[var(--fg-muted)] max-w-xs mb-4">
              Create your first project to start building with the 10-Agent Council
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--fg-primary)] text-[var(--bg-base)] text-sm font-semibold hover:opacity-90 transition-all"
            >
              <Plus size={14} />
              Create Project
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        )}
      </div>

      <NewProjectModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={fetchProjects}
      />
    </div>
  );
}
