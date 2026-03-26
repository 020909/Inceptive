'use client';

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Bot,
  Mail,
  Search,
  Plug,
  Target,
  FileText,
  Zap,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "Email", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Connectors", href: "/social", icon: Plug },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Reports", href: "/reports", icon: FileText },
];

// Manus-style breathing dot indicator
function ActiveIndicator() {
  return (
    <div className="relative flex items-center justify-center w-2 h-2">
      <motion.div
        className="absolute w-full h-full rounded-full bg-white"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          ease: "easeInOut",
          times: [0, 0.5, 1],
          repeat: Infinity,
        }}
      />
      <div className="relative w-1.5 h-1.5 rounded-full bg-white" />
    </div>
  );
}

function NavItemComponent({ item, isActive }: { item: typeof navItems[0]; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <Link key={item.href} href={item.href}>
      <motion.div
        className={`
          relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
          transition-colors duration-200 cursor-pointer
          ${isActive ? "" : "hover:bg-white/[0.06]"}
        `}
        whileHover={{ x: 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Active indicator - left border */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-white rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}

        {/* Icon */}
        <motion.div
          animate={{
            scale: isActive ? 1.05 : 1,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <Icon size={18} strokeWidth={1.5} className="text-white" />
        </motion.div>

        {/* Label */}
        <span
          className={`
            text-sm text-white tracking-[-0.02em]
            ${isActive ? "font-medium" : "font-normal"}
          `}
        >
          {item.label}
        </span>

        {/* Active breathing dot */}
        {isActive && (
          <motion.div
            className="ml-auto"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <ActiveIndicator />
          </motion.div>
        )}
      </motion.div>
    </Link>
  );
}

// Power Meter - Credits section
function PowerMeter({ credits = 100, maxCredits = 100 }: { credits?: number; maxCredits?: number }) {
  const percentage = (credits / maxCredits) * 100;

  return (
    <div className="mt-auto pt-6 px-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap size={12} strokeWidth={2} className="text-white" />
          <span className="text-xs text-white font-medium tracking-[-0.02em]">{credits} Free</span>
        </div>
        <span className="text-[10px] text-white/50 tracking-[-0.01em]">resets daily</span>
      </div>

      {/* Energy bar */}
      <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-white rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        >
          {/* Subtle pulse effect on the bar */}
          <motion.div
            className="absolute inset-0 bg-white/50 rounded-full"
            animate={{
              opacity: [0, 0.5, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 1,
            }}
          />
        </motion.div>
      </div>

      {/* Upgrade button */}
      <Link href="/upgrade">
        <motion.button
          className="
            mt-3 w-full py-2 px-3 rounded-lg
            border border-white/20
            text-xs text-white font-medium tracking-[-0.02em]
            transition-colors duration-200
            hover:bg-white/[0.06] hover:border-white/30
          "
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          Upgrade →
        </motion.button>
      </Link>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <motion.aside
      className="
        fixed left-0 top-0 h-full w-64
        flex flex-col
        bg-[#262624]
        border-r border-white/[0.06]
        z-50
      "
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 25 }}
    >
      {/* Subtle background texture */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient shadow overlay for depth */}
      <div className="absolute inset-0 shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)] pointer-events-none" />

      {/* Logo section */}
      <div className="relative px-5 py-5 flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Inceptive Logo Icon */}
          <motion.div
            className="w-7 h-7 rounded-lg bg-white flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <span className="text-[#262624] font-bold text-sm tracking-[-0.03em]">I</span>
          </motion.div>
          <span className="text-white font-semibold text-base tracking-[-0.02em]">Inceptive</span>
        </div>

        {/* Manus-style breathing indicator */}
        <div className="ml-auto">
          <ActiveIndicator />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/[0.06] mb-4" />

      {/* Navigation */}
      <nav className="relative flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavItemComponent key={item.href} item={item} isActive={pathname === item.href} />
        ))}
      </nav>

      {/* Power Meter */}
      <div className="relative px-3 pb-5">
        <div className="h-px bg-white/[0.06] mb-4" />
        <PowerMeter credits={100} maxCredits={100} />
      </div>

      {/* Settings */}
      <div className="relative px-3 pb-5">
        <Link href="/settings">
          <motion.div
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
              transition-colors duration-200
              ${pathname === "/settings" ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"}
            `}
            whileHover={{ x: 2 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <Settings size={18} strokeWidth={1.5} className="text-white" />
            <span className="text-sm text-white tracking-[-0.02em]">Settings</span>
            {pathname === "/settings" && (
              <motion.div className="ml-auto" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}>
                <ActiveIndicator />
              </motion.div>
            )}
          </motion.div>
        </Link>
      </div>
    </motion.aside>
  );
}