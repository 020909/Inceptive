'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Globe, FileText, Link as LinkIcon, Clock, Sparkles } from 'lucide-react';

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    setIsSearching(true);
    // Simulate search
    setTimeout(() => setIsSearching(false), 2000);
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Search size={20} className="text-primary" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Research</h1>
        </div>
        <p className="text-white/50 text-sm">
          Deep research with web sources, citations, and comprehensive analysis
        </p>
      </motion.div>

      {/* Search Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-3xl mx-auto mb-12"
      >
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Search size={20} className="text-white/50" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="What would you like to research?"
              className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-white/30"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Globe size={12} />
              <span>Searches web + academic sources</span>
            </div>
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {isSearching ? 'Researching...' : 'Start Research'}
            </button>
          </div>
        </div>

        {/* Suggested Topics */}
        <div className="mt-6">
          <div className="text-xs text-white/40 mb-3">Suggested topics:</div>
          <div className="flex flex-wrap gap-2">
            {[
              'AI market trends 2024',
              'Startup fundraising strategies',
              'SaaS pricing models',
              'Remote work productivity',
            ].map((topic, i) => (
              <button
                key={i}
                onClick={() => setQuery(topic)}
                className="px-3 py-1.5 rounded-lg glass glass-hover text-white/70 text-xs"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recent Research */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Recent Research</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'AI Agent Market Analysis',
              description: 'Comprehensive analysis of the AI agent market landscape',
              sources: 12,
              time: '2 hours ago',
            },
            {
              title: 'Competitor Pricing Strategy',
              description: 'Detailed breakdown of competitor pricing models',
              sources: 8,
              time: '1 day ago',
            },
          ].map((research, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -2 }}
              className="glass glass-hover rounded-xl p-5 cursor-pointer"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-medium text-sm mb-1">
                    {research.title}
                  </h3>
                  <p className="text-white/50 text-xs">{research.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-white/40">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <LinkIcon size={12} />
                    <span>{research.sources} sources</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{research.time}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
