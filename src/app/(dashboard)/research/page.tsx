'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, Globe, FileText, Download, Share2, Clock, Sparkles, Plus, History, Link as LinkIcon } from 'lucide-react';

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
    in_progress: { color: 'text-white/60', bg: 'bg-white/[0.06]', label: 'In Progress' },
    completed: { color: 'text-white/60', bg: 'bg-white/[0.06]', label: 'Completed' },
    archived: { color: 'text-white/40', bg: 'bg-white/[0.04]', label: 'Archived' },
  };
  const config = configs[status];

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

function ResearchCard({ project, index }: { project: ResearchProject; index: number }) {
  return (
    <motion.div
      className="group p-5 rounded-xl bg-[#262624] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100, damping: 20 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
          <BookOpen size={20} className="text-white/70" />
        </div>
        <StatusBadge status={project.status} />
      </div>

      <h3 className="text-white font-medium tracking-[-0.02em] mb-2">{project.title}</h3>
      <p className="text-white/40 text-sm mb-4 line-clamp-2">{project.description}</p>

      <div className="flex items-center justify-between text-xs text-white/30">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Globe size={12} />
            {project.sources} sources
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {project.lastUpdated}
          </span>
        </div>
        <motion.div
          className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
          initial={false}
        >
          <button className="p-1.5 rounded hover:bg-white/[0.08]">
            <Download size={14} className="text-white/50" />
          </button>
          <button className="p-1.5 rounded hover:bg-white/[0.08]">
            <Share2 size={14} className="text-white/50" />
          </button>
        </motion.div>
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
    // Keep existing search functionality
    setTimeout(() => setIsSearching(false), 2000);
  };

  // Keep existing mock data
  const recentResearch = [
    { id: '1', title: 'AI Agent Market Analysis', description: 'Comprehensive analysis of the AI agent landscape, competitors, and market opportunities.', status: 'in_progress' as const, sources: 24, lastUpdated: '2 hours ago' },
    { id: '2', title: 'Consumer Behavior Trends 2024', description: 'Research on shifting consumer preferences in AI-powered productivity tools.', status: 'completed' as const, sources: 156, lastUpdated: '1 day ago' },
    { id: '3', title: 'Technical Architecture Review', description: 'Deep dive into modern AI infrastructure and scalable system design patterns.', status: 'in_progress' as const, sources: 42, lastUpdated: '3 days ago' },
    { id: '4', title: 'Regulatory Compliance Study', description: 'Analysis of AI regulations and compliance requirements across key markets.', status: 'archived' as const, sources: 89, lastUpdated: '1 week ago' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-[-0.02em]">Research</h1>
          <p className="text-white/40 text-sm">AI-powered research and knowledge synthesis</p>
        </div>
        <motion.button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[#262624] font-medium text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus size={16} />
          New Research
        </motion.button>
      </header>

      {/* Search Section */}
      <motion.div
        className="max-w-2xl mx-auto mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        <div className="relative mb-6">
          <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Research any topic..."
            className="w-full pl-14 pr-6 py-5 rounded-2xl bg-[#262624] border border-white/[0.08] text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-white/[0.15] focus:bg-[#262624] transition-all"
          />
          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/30">
            <span className="text-xs">Enter</span>
            <Sparkles size={14} />
          </div>
        </div>

        {/* Suggested Topics - Keep functionality */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['Market Analysis', 'Competitor Research', 'Technology Trends', 'User Insights'].map((topic) => (
            <button
              key={topic}
              onClick={() => setQuery(topic)}
              className="px-3 py-1.5 rounded-lg bg-[#262624] border border-white/[0.06] text-white/50 text-sm hover:bg-white/[0.08] hover:border-white/[0.10] hover:text-white/80 transition-all"
            >
              {topic}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Projects', value: '4', icon: BookOpen },
          { label: 'Sources Analyzed', value: '311', icon: Globe },
          { label: 'Reports Generated', value: '12', icon: FileText },
          { label: 'Hours Saved', value: '48', icon: Clock },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            className="flex items-center gap-4 p-4 rounded-xl bg-[#262624] border border-white/[0.06]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05, type: 'spring', stiffness: 100, damping: 20 }}
          >
            <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
              <stat.icon size={18} className="text-white/60" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white tracking-[-0.03em]">{stat.value}</p>
              <p className="text-white/40 text-xs">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Research */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-white font-medium tracking-[-0.02em] flex items-center gap-2">
          <History size={18} className="text-white/50" />
          Recent Research
        </h2>
        <button className="text-white/40 text-sm hover:text-white/60 transition-colors">View All</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {recentResearch.map((project, index) => (
          <ResearchCard key={project.id} project={project} index={index} />
        ))}
      </div>
    </div>
  );
}