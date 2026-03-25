'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Code, Video, Megaphone, Target } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';

const agents = [
  { id: 'marketing', name: 'Marketing', description: 'Multi-channel campaigns, social scheduling, and copy.', icon: Megaphone },
  { id: 'coding', name: 'Coding', description: 'Full-stack development, debugging, and architecture.', icon: Code },
  { id: 'video-editor', name: 'Video Editor', description: 'Script generation, pacing, and B-roll selection.', icon: Video },
  { id: 'research', name: 'Research & Reporting', description: 'Deep-dive analysis, scraping, and data synthesis.', icon: Bot },
  { id: 'outreach', name: 'Outreach & Sales', description: 'Lead generation, CRM syncing, and follow-ups.', icon: Target },
];

const AgentCard = ({ agent }: { agent: typeof agents[0] }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="relative frosted-glass ambient-shadow rounded-xl p-6 flex flex-col items-center text-center cursor-pointer"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, boxShadow: '0 0 0 2px rgba(255,255,255,0.2)' }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        className="absolute inset-0 rounded-xl border border-white/10"
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      <agent.icon size={48} className="text-white mb-4" />
      <h3 className="text-xl font-semibold text-white mb-2">{agent.name}</h3>
      <p className="text-white/70 text-sm">{agent.description}</p>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="absolute bottom-0 left-0 w-full p-4 frosted-glass rounded-b-xl"
          >
            <button className="w-full bg-white/10 text-white py-2 rounded-md hover:bg-white/20 transition-colors">
              Quick Start
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function AgentPage() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <motion.main
        className="flex-1 flex flex-col p-8 relative overflow-auto bg-[#242424] ml-64 transition-all duration-300 ease-in-out"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
      >
        <h1 className="text-4xl font-bold text-white mb-8">Select Your Agent</h1>
        <p className="text-white/70 text-lg mb-12">Choose a highly specialized autonomous agent to act on your behalf.</p>

        {/* Fluid Masonry Layout */}
        <div className="masonry flex-1">
          <AnimatePresence>
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                className="masonry-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                <AgentCard agent={agent} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}