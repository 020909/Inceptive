'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, Globe, FileText, Download, Share2, Clock, Sparkles, Plus, History } from 'lucide-react';

interface ResearchProject {
  id: string;
  title: string;
  description: string;
  status: 'in_progress' | 'completed' | 'archived';
  sources: number;
  lastUpdated: string;
}

function StatusBadge({ status }: { status: ResearchProject['status'] }) {
  const configs = {
    in_progress: { color: 'text-[var(--fg-secondary)]', bg: 'bg-[var(--bg-elevated)]', label: 'In Progress' },
    completed:   { color: 'text-[var(--success)]',       bg: 'bg-[var(--success-soft)]', label: 'Completed' },
    archived:    { color: 'text-[var(--fg-muted)]',      bg: 'bg-[var(--bg-elevated)]',  label: 'Archived' },
  };
  const c = configs[status];
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.color}`}>{c.label}</span>
  );
}

function ResearchCard({ project, index }: { project: ResearchProject; index: number }) {
  return (
    <motion.div
      className="group p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors duration-150 cursor-pointer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
          <BookOpen size={16} className="text-[var(--fg-tertiary)]" />
        </div>
        <StatusBadge status={project.status} />
      </div>

      <h3 className="text-[var(--fg-primary)] font-medium text-sm tracking-[-0.01em] mb-1.5">{project.title}</h3>
      <p className="text-[var(--fg-muted)] text-xs mb-4 line-clamp-2">{project.description}</p>

      <div className="flex items-center justify-between text-[11px] text-[var(--fg-muted)]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Globe size={11} />{project.sources} sources</span>
          <span className="flex items-center gap-1"><Clock size={11} />{project.lastUpdated}</span>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)]"><Download size={13} className="text-[var(--fg-tertiary)]" /></button>
          <button className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)]"><Share2 size={13} className="text-[var(--fg-tertiary)]" /></button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 2000);
  };

  const recentResearch: ResearchProject[] = [
    { id: '1', title: 'AI Agent Market Analysis', description: 'Comprehensive analysis of the AI agent landscape, competitors, and market opportunities.', status: 'in_progress', sources: 24, lastUpdated: '2 hours ago' },
    { id: '2', title: 'Consumer Behavior Trends 2024', description: 'Research on shifting consumer preferences in AI-powered productivity tools.', status: 'completed', sources: 156, lastUpdated: '1 day ago' },
    { id: '3', title: 'Technical Architecture Review', description: 'Deep dive into modern AI infrastructure and scalable system design patterns.', status: 'in_progress', sources: 42, lastUpdated: '3 days ago' },
    { id: '4', title: 'Regulatory Compliance Study', description: 'Analysis of AI regulations and compliance requirements across key markets.', status: 'archived', sources: 89, lastUpdated: '1 week ago' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-semibold text-[var(--fg-primary)] tracking-[-0.03em]">Research</h1>
          <p className="text-[var(--fg-tertiary)] text-sm mt-0.5">AI-powered research and knowledge synthesis</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--fg-primary)] text-[var(--bg-base)] font-medium text-sm">
          <Plus size={15} />New Research
        </button>
      </motion.div>

      {/* Search */}
      <motion.div
        className="max-w-2xl mx-auto mb-12"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Research any topic..."
            className="w-full pl-12 pr-6 py-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-primary)] text-base placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[var(--fg-muted)]">
            <span className="text-[11px]">Enter</span>
            <Sparkles size={13} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {['Market Analysis', 'Competitor Research', 'Technology Trends', 'User Insights'].map((topic) => (
            <button
              key={topic}
              onClick={() => setQuery(topic)}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--fg-tertiary)] text-xs hover:border-[var(--border-default)] hover:text-[var(--fg-secondary)] transition-colors"
            >
              {topic}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-4 gap-3 mb-8"
      >
        {[
          { label: 'Active', value: '4', icon: BookOpen },
          { label: 'Sources', value: '311', icon: Globe },
          { label: 'Reports', value: '12', icon: FileText },
          { label: 'Hours Saved', value: '48', icon: Clock },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
              <s.icon size={15} className="text-[var(--fg-tertiary)]" />
            </div>
            <div>
              <p className="text-lg font-semibold text-[var(--fg-primary)] tracking-[-0.02em]">{s.value}</p>
              <p className="text-[var(--fg-muted)] text-[11px]">{s.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Recent */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--fg-secondary)] flex items-center gap-2">
          <History size={15} className="text-[var(--fg-tertiary)]" />Recent Research
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {recentResearch.map((p, i) => (
          <ResearchCard key={p.id} project={p} index={i} />
        ))}
      </div>
    </div>
  );
}
