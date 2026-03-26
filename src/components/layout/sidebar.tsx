'use client';

import React, { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// ── Sidebar context so layout can react to collapse ──
const SidebarContext = createContext({ collapsed: false, setCollapsed: (_: boolean) => {} });
export function useSidebar() { return useContext(SidebarContext); }

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Agent",     href: "/agent",     icon: Bot },
  { label: "Skills",    href: "/skills",    icon: Sparkles },
  { label: "Email",     href: "/email",     icon: Mail },
  { label: "Research",  href: "/research",  icon: Search },
  { label: "Connectors",href: "/social",    icon: Plug },
  { label: "Goals",     href: "/goals",     icon: Target },
  { label: "Reports",   href: "/reports",   icon: FileText },
];

function BreathingDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <motion.span
        className="absolute inset-0 rounded-full bg-white"
        animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
      />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
    </span>
  );
}

function NavItem({ item, isActive, collapsed }: { item: typeof navItems[0]; isActive: boolean; collapsed: boolean }) {
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <div
        className={`
          group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
          transition-colors duration-150
          ${isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}
        `}
      >
        {isActive && (
          <motion.div
            layoutId="nav-active"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-white"
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          />
        )}

        <Icon
          size={17}
          strokeWidth={1.5}
          className={`shrink-0 transition-colors duration-150 ${
            isActive ? "text-[var(--fg-primary)]" : "text-[var(--fg-tertiary)] group-hover:text-[var(--fg-secondary)]"
          }`}
        />

        {!collapsed && (
          <span
            className={`text-[13px] tracking-[-0.01em] transition-colors duration-150 ${
              isActive ? "text-[var(--fg-primary)] font-medium" : "text-[var(--fg-secondary)] group-hover:text-[var(--fg-primary)]"
            }`}
          >
            {item.label}
          </span>
        )}

        {isActive && !collapsed && (
          <span className="ml-auto">
            <BreathingDot />
          </span>
        )}
      </div>
    </Link>
  );
}

function PowerMeter({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;

  return (
    <div className="px-3 pb-1">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Zap size={11} strokeWidth={2} className="text-[var(--fg-secondary)]" />
          <span className="text-[11px] text-[var(--fg-secondary)] font-medium">100 credits</span>
        </div>
        <span className="text-[10px] text-[var(--fg-muted)]">resets daily</span>
      </div>

      <div className="relative h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-white/80 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.5 }}
        />
      </div>

      <Link href="/upgrade" className="block mt-2.5">
        <div className="w-full py-1.5 rounded-lg border border-[var(--border-subtle)] text-center text-[11px] text-[var(--fg-secondary)] font-medium tracking-[-0.01em] transition-all duration-150 hover:bg-white/[0.04] hover:border-[var(--border-default)] hover:text-[var(--fg-primary)]">
          Upgrade
        </div>
      </Link>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <motion.aside
      className={`
        fixed left-0 top-0 h-full z-50
        flex flex-col
        glass noise
        border-r border-[var(--border-subtle)]
        transition-[width] duration-200 ease-out
        ${collapsed ? 'w-[60px]' : 'w-[240px]'}
      `}
      style={{ background: "rgba(17, 17, 17, 0.75)" }}
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 22 }}
    >
      {/* Logo */}
      <div className="relative px-3 pt-4 pb-3 flex items-center gap-2.5">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 relative rounded-lg overflow-hidden bg-white shrink-0">
            <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
          </div>
          {!collapsed && (
            <span className="text-[var(--fg-primary)] font-semibold text-[15px] tracking-[-0.03em]">
              Inceptive
            </span>
          )}
        </Link>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto p-1 rounded-md transition-colors hover:bg-white/[0.06]"
          >
            <ChevronLeft size={14} className="text-[var(--fg-muted)]" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-5 p-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-overlay)]"
          >
            <ChevronRight size={10} className="text-[var(--fg-tertiary)]" />
          </button>
        )}
      </div>

      <div className="mx-3 h-px bg-[var(--border-subtle)]" />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-2 space-y-1">
        <div className="mx-1 h-px bg-[var(--border-subtle)] mb-2" />

        <PowerMeter collapsed={collapsed} />

        {/* Settings */}
        <div className="px-1">
          <Link href="/settings">
            <div
              className={`
                group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                transition-colors duration-150
                ${pathname === "/settings" ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}
              `}
            >
              <Settings
                size={17}
                strokeWidth={1.5}
                className={`shrink-0 transition-colors ${
                  pathname === "/settings" ? "text-[var(--fg-primary)]" : "text-[var(--fg-tertiary)] group-hover:text-[var(--fg-secondary)]"
                }`}
              />
              {!collapsed && (
                <span className={`text-[13px] tracking-[-0.01em] transition-colors ${
                  pathname === "/settings" ? "text-[var(--fg-primary)] font-medium" : "text-[var(--fg-secondary)] group-hover:text-[var(--fg-primary)]"
                }`}>
                  Settings
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>
    </motion.aside>
  );
}
