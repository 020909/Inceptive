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
  Settings,
  Sparkles,
} from "lucide-react";

/** Rounded rectangle with inner vertical rule (sidebar layout cue), white stroke */
function SidebarToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="14"
      viewBox="0 0 16 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="1" y="1" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="1.25" />
      <line x1="5.25" y1="2.75" x2="5.25" y2="11.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

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
        className="absolute inset-0 rounded-full bg-[var(--fg-primary)]"
        animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
      />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--fg-primary)]" />
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
          ${isActive ? "bg-[var(--border-subtle)]" : "hover:bg-[var(--border-subtle)]"}
        `}
      >
        {isActive && (
          <motion.div
            layoutId="nav-active"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-[var(--fg-primary)]"
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          />
        )}

        <Icon
          size={18}
          strokeWidth={1.5}
          className={`shrink-0 transition-colors duration-150 ${
            isActive ? "text-[var(--fg-primary)]" : "text-[#B4B4C0] group-hover:text-[#D0D0D8]"
          }`}
        />

        {!collapsed && (
          <span
            className={`text-sm tracking-[-0.01em] transition-colors duration-150 ${
              isActive ? "text-[var(--fg-primary)] font-medium" : "text-[#C8C8D0] group-hover:text-[var(--fg-primary)]"
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

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <motion.aside
      className={`
        fixed left-0 top-0 h-full z-50
        flex flex-col
        glass
        border-r border-[var(--border-subtle)]
        transition-[width] duration-200 ease-out
        ${collapsed ? 'w-[60px]' : 'w-[240px]'}
      `}
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 22 }}
    >
      {/* Logo */}
      <div className="relative px-3 pt-4 pb-3 flex items-center gap-2.5">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 relative rounded-md overflow-hidden shrink-0">
            <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
          </div>
          {!collapsed && (
            <span className="text-[16px] font-semibold tracking-[-0.03em] text-[var(--fg-primary)]">
              Inceptive
            </span>
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="ml-auto rounded-md p-1.5 text-white/90 transition-colors hover:bg-[var(--border-subtle)]"
          >
            <SidebarToggleIcon className="opacity-90" />
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="absolute -right-3 top-5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1.5 text-white/90 transition-colors hover:bg-[var(--bg-overlay)]"
          >
            <SidebarToggleIcon className="h-3.5 w-auto opacity-90" />
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

        {/* Settings */}
        <div className="px-1">
          <Link href="/settings">
            <div
              className={`
                group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                transition-colors duration-150
                ${pathname === "/settings" ? "bg-[var(--border-subtle)]" : "hover:bg-[var(--border-subtle)]"}
              `}
            >
              <Settings
                size={18}
                strokeWidth={1.5}
                className={`shrink-0 transition-colors ${
                  pathname === "/settings" ? "text-[var(--fg-primary)]" : "text-[#B4B4C0] group-hover:text-[#D0D0D8]"
                }`}
              />
              {!collapsed && (
                <span className={`text-sm tracking-[-0.01em] transition-colors ${
                  pathname === "/settings" ? "text-[var(--fg-primary)] font-medium" : "text-[#C8C8D0] group-hover:text-[var(--fg-primary)]"
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
