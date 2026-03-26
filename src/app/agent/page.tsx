'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Code, Video, Megaphone, Target, Play, Pause, RotateCcw, Settings, MoreHorizontal, Clock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentTask {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  description: string;
  lastRun: string;
}

const mockTasks: AgentTask[] = [
  { id: '1', name: 'Email Autopilot', status: 'running', progress: 78, description: 'Processing 23 emails', lastRun: '2 mins ago' },
  { id: '2', name: 'Research Assistant', status: 'running', progress: 45, description: 'Analyzing market trends', lastRun: '5 mins ago' },
  { id: '3', name: 'Code Review Bot', status: 'paused', progress: 0, description: 'Waiting for PRs', lastRun: '1 hour ago' },
  { id: '4', name: 'Content Generator', status: 'completed', progress: 100, description: 'Generated 5 blog posts', lastRun: '3 hours ago' },
];

function StatusBadge({ status }: { status: AgentTask['status'] }) {
  const configs = {
    running: { icon: Play, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Running' },
    paused: { icon: Pause, color: 'text-white/50', bg: 'bg-white/[0.06]', label: 'Paused' },
    completed: { icon: Bot, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Completed' },
    failed: { icon: Bot, color: 'text-white/50', bg: 'bg-white/[0.06]', label: 'Failed' },
  };
  const config = configs[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
      <Icon size={12} className={config.color} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

function TaskCard({ task, index }: { task: AgentTask; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="group relative p-5 rounded-xl bg-[#262624] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100, damping: 20 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
            <Bot size={20} className="text-white/70" />
          </div>
          <div>
            <h3 className="text-white font-medium tracking-[-0.02em]">{task.name}</h3>
            <p className="text-white/40 text-sm">{task.description}</p>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/40 text-xs">Progress</span>
          <span className="text-white/60 text-xs">{task.progress}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${task.progress}%` }}
            transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-white/30 text-xs">
          <Clock size={12} />
          <span>Last run {task.lastRun}</span>
        </div>

        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <button className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
            <RotateCcw size={14} className="text-white/50" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
            <Settings size={14} className="text-white/50" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
            <MoreHorizontal size={14} className="text-white/50" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function AgentPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-[-0.02em]">AI Agents</h1>
          <p className="text-white/40 text-sm">Manage and monitor your autonomous agents</p>
        </div>
        <motion.button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[#1E1E1C] font-medium text-sm tracking-[-0.02em]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Plus size={16} />
          New Agent
        </motion.button>
      </header>

      {/* Content */}
      <div className="flex-1 p-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Agents', value: '2', color: 'text-blue-400' },
            { label: 'Tasks Completed', value: '1,234', color: 'text-white' },
            { label: 'Success Rate', value: '98.5%', color: 'text-white' },
            { label: 'Avg. Response', value: '1.2s', color: 'text-white/60' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              className="p-5 rounded-xl bg-[#262624] border border-white/[0.06]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <p className="text-white/40 text-sm mb-1">{stat.label}</p>
              <p className={`text-2xl font-semibold ${stat.color} tracking-[-0.03em]`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Task Grid */}
        <div className="grid grid-cols-2 gap-4">
          {mockTasks.map((task, index) => (
            <TaskCard key={task.id} task={task} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}