'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Bot, 
  Mail, 
  Search, 
  Share2, 
  Target, 
  FileBarChart, 
  Zap, 
  Settings, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agent', href: '/agent', icon: Bot },
  { name: 'Email', href: '/email', icon: Mail },
  { name: 'Research', href: '/research', icon: Search },
  { name: 'Connectors', href: '/social', icon: Share2 },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
];

const PowerMeter = ({ credits }: { credits: number }) => (
  <motion.div 
    className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"
    initial={{ opacity: 0, width: 0 }}
    animate={{ opacity: 1, width: '100%' }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
  >
    <motion.div
      className="h-full bg-white rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${credits}%` }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
    />
  </motion.div>
);

const ActiveIndicator = () => (
  <motion.span
    className="absolute right-0 top-0 w-2 h-2 rounded-full bg-white"
    animate={{
      scale: [1, 1.5, 1],
      opacity: [0.5, 1, 0.5],
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const currentCredits = 75;

  return (
    <motion.aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#1A1A1A] frosted-glass ambient-shadow border-r border-white/10 p-4 transition-all duration-300 ease-in-out",
        isCollapsed ? 'w-20' : 'w-64'
      )}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="flex items-center justify-between mb-8">
        <Link href="/dashboard" className={cn("flex items-center gap-2 relative", isCollapsed && 'justify-center w-full')}>
          <motion.span
            className="text-white text-2xl font-bold"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {isCollapsed ? 'I' : 'Inceptive'}
          </motion.span>
          {!isCollapsed && <ActiveIndicator />}
        </Link>
        <motion.button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-full text-white/70 hover:bg-white/10 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </motion.button>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <Link key={item.name} href={item.href}>
            <motion.div
              className={cn(
                "relative flex items-center gap-3 p-3 rounded-lg text-white/80 hover:bg-white/10 transition-colors",
                pathname === item.href && 'bg-white/15 text-white'
              )}
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.15)' }}
              whileTap={{ scale: 0.98 }}
            >
              {pathname === item.href && (
                <motion.div
                  layoutId="active-nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-full"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon size={20} className={cn(pathname === item.href && 'text-white')} />
              {!isCollapsed && <span className="font-medium">{item.name}</span>}
            </motion.div>
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/5">
          <span className="text-white/80 text-sm">CREDITS {currentCredits} Free</span>
          <PowerMeter credits={currentCredits} />
          <motion.button
            className="w-full text-sm text-white border border-white/30 rounded-md py-1.5 hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Upgrade
          </motion.button>
        </div>
        <Link href="/settings">
          <motion.div
            className="flex items-center gap-3 p-3 rounded-lg text-white/80 hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.15)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Settings size={20} />
            {!isCollapsed && <span className="font-medium">Settings</span>}
          </motion.div>
        </Link>
      </div>
    </motion.aside>
  );
}
