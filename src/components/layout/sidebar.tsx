'use client';

import React, { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  MessageSquare,
  Plus,
  Clock,
} from "lucide-react";
import { useChat } from "@/lib/chat-context";

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
          transition-all duration-200 ease-out
          ${isActive ? "bg-[var(--border-subtle)]" : "hover:bg-[var(--border-subtle)]"}
        `}
      >
        {isActive && (
          <motion.div
            layoutId="nav-active"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-[var(--fg-primary)]"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}

        <Icon
          size={18}
          strokeWidth={1.5}
          className={`shrink-0 transition-colors duration-200 ${
            isActive ? "text-[var(--fg-primary)]" : "text-[#B4B4C0] group-hover:text-[#D0D0D8]"
          }`}
        />

        {!collapsed && (
          <motion.span
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            className={`text-sm tracking-[-0.01em] transition-colors duration-200 ${
              isActive ? "text-[var(--fg-primary)] font-medium" : "text-[#C8C8D0] group-hover:text-[var(--fg-primary)]"
            }`}
          >
            {item.label}
          </motion.span>
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
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();
  const { recentChats, loadChat, startNewChat } = useChat();

  const handleLoadChat = (chat: ReturnType<typeof useChat>['recentChats'][0]) => {
    loadChat(chat);
    router.push('/dashboard');
  };

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
      {/* Logo + collapse — full width row so toggle never overlaps the mark */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-2 pb-3 pt-4">
          <Link href="/dashboard" className="flex shrink-0 justify-center">
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-[var(--border-subtle)]"
          >
            <SidebarToggleIcon className="opacity-90" />
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2 px-3 pb-3 pt-4">
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"
          >
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
              <Image src="/logo.png" alt="Inceptive" fill className="object-cover" />
            </div>
            <span className="truncate text-[16px] font-semibold tracking-[-0.03em] text-[var(--fg-primary)]">
              Inceptive
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-[var(--border-subtle)]"
          >
            <SidebarToggleIcon className="opacity-90" />
          </button>
        </div>
      )}

      <div className="mx-3 h-px bg-[var(--border-subtle)]" />

      {/* ── Nav ── */}
      <nav className="flex-none px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="mx-3 h-px bg-[var(--border-subtle)]" />

      {/* ── Recent Chats ── */}
      {!collapsed && recentChats.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 px-2 py-2 overflow-hidden">
          <div className="flex items-center justify-between px-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#7A7A8A]">
              <Clock size={10} />
              Recent
            </div>
            <button
              onClick={startNewChat}
              className="text-[10px] text-[#7A7A8A] hover:text-[var(--fg-primary)] flex items-center gap-0.5 transition-colors"
              title="New Chat"
            >
              <Plus size={10} /> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
            {recentChats.slice(0, 10).map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleLoadChat(chat)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#B4B4C0] hover:text-[var(--fg-primary)] hover:bg-[var(--border-subtle)] transition-colors truncate"
                title={chat.title}
              >
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={11} className="shrink-0 text-[#7A7A8A]" />
                  <span className="truncate">{chat.title}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed: just a chat icon linking to dashboard */}
      {collapsed && (
        <div className="flex-1 flex flex-col items-center py-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-[#B4B4C0] hover:text-[var(--fg-primary)] hover:bg-[var(--border-subtle)] transition-colors"
            title="Recent Chats"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      )}

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
