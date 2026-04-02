'use client';

import React, { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Plus,
  FolderKanban,
  Github,
} from "lucide-react";
import { useChat } from "@/lib/chat-context";
import { cn } from "@/lib/utils";

/** Rounded rectangle with inner vertical rule (sidebar layout cue), white stroke */
function SidebarToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="2" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ── Sidebar context so layout can react to collapse ──
const SidebarContext = createContext({ collapsed: false, setCollapsed: (_: boolean) => {} });
export function useSidebar() { return useContext(SidebarContext); }

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  /** Default narrow rail (64px); hover expands to 220px when collapsed, or pin open via toggle. */
  const [collapsed, setCollapsed] = React.useState(true);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Agent", href: "/agent", icon: Bot },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Skills", href: "/skills", icon: Sparkles },
  { label: "Email", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Connectors", href: "/social", icon: Plug },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "GitHub", href: "/github", icon: Github },
];

function NavItem({
  item,
  isActive,
  collapsed,
}: {
  item: typeof navItems[0];
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group/item relative flex h-10 w-full items-center overflow-hidden rounded-lg transition-all duration-200",
        collapsed
          ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          : "justify-start gap-3",
        isActive
          ? cn(
              "border-l-2 border-[var(--text-primary)] bg-[rgba(255,255,255,0.04)]",
              collapsed
                ? "pl-0 group-hover/sidebar:pl-[14px]"
                : "pl-[14px]",
            )
          : cn(
              "border-l-2 border-transparent hover:-translate-y-px hover:bg-[rgba(255,255,255,0.06)]",
              collapsed ? "pl-0 group-hover/sidebar:pl-4" : "pl-4",
            ),
      )}
    >
      <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
        <Icon size={20} strokeWidth={isActive ? 2 : 1.5} className={isActive ? "text-[var(--text-primary)]" : "text-[var(--fg-secondary)]"} />
      </span>

      <span
        className={cn(
          "max-w-[140px] overflow-hidden whitespace-nowrap text-sm font-medium transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isActive ? "text-[var(--text-primary)]" : "text-[var(--fg-secondary)]",
          collapsed
            ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
            : "opacity-100",
        )}
      >
        {item.label}
      </span>
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
    /* group/sidebar — drives the label reveal on hover via group-hover/sidebar: */
    <aside
      className={`
        group/sidebar
        glass
        flex flex-col shrink-0
        h-screen sticky top-0 z-40 overflow-hidden
        transition-[width] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]
        border-r border-[rgba(255,255,255,0.06)]
        ${collapsed ? "w-[64px] hover:w-[220px]" : "w-[220px]"}
      `}
    >
      {/* ── Logo row: stacked logo + toggle when squeezed; horizontal when expanded or rail hover ── */}
      <div
        className={cn(
          "flex shrink-0 overflow-hidden transition-[padding] duration-300",
          collapsed
            ? "flex-col items-center gap-1.5 py-2.5 px-2 group-hover/sidebar:h-14 group-hover/sidebar:flex-row group-hover/sidebar:items-center group-hover/sidebar:justify-start group-hover/sidebar:gap-2 group-hover/sidebar:py-0 group-hover/sidebar:px-3"
            : "h-14 flex-row items-center justify-start gap-2 px-3",
        )}
      >
        <button
          onClick={() => router.push("/dashboard")}
          className="flex h-8 w-8 shrink-0 items-center justify-center"
          aria-label="Home"
        >
          <Image
            src="/logo.png"
            alt="Inceptive"
            width={32}
            height={32}
            className="rounded-lg object-contain"
          />
        </button>

        <span
          className={cn(
            "min-w-0 truncate text-sm font-semibold tracking-tight text-[#F5F5F7] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            collapsed
              ? "hidden max-w-0 overflow-hidden opacity-0 group-hover/sidebar:block group-hover/sidebar:max-w-[120px] group-hover/sidebar:flex-1 group-hover/sidebar:opacity-100"
              : "flex-1 opacity-100",
          )}
          style={{ fontFamily: "var(--font-header)" }}
        >
          Inceptive
        </span>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--fg-tertiary)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--fg-primary)]"
        >
          <SidebarToggleIcon className="h-4 w-4" />
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex flex-col gap-0.5 flex-1 px-2 pt-2 overflow-hidden">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}
      </nav>

      {/* ── Recent Chats — visible when pinned open; on narrow rail, reveal on sidebar hover ── */}
      <div
        className={cn(
          "px-2 pb-2 overflow-hidden",
          collapsed && "max-h-0 opacity-0 overflow-hidden group-hover/sidebar:max-h-[320px] group-hover/sidebar:opacity-100 group-hover/sidebar:overflow-visible transition-[max-height,opacity] duration-300",
          !collapsed && "max-h-none opacity-100",
        )}
      >
        {recentChats.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fg-muted)] whitespace-nowrap">
                Recent
              </span>
              <button
                onClick={() => { startNewChat(); router.push('/dashboard'); }}
                className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--fg-muted)] hover:bg-[var(--border-subtle)] hover:text-[var(--fg-primary)] transition-colors"
                title="New chat"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {recentChats.slice(0, 6).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleLoadChat(chat)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[var(--fg-secondary)] hover:text-[#F5F5F7] hover:bg-[rgba(255,255,255,0.04)] transition-colors truncate whitespace-nowrap"
                  title={chat.title}
                >
                  {chat.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom: Settings ── */}
      <div className="px-2 pb-4 pt-2 border-t border-[rgba(255,255,255,0.06)] shrink-0">
        <Link
          href="/settings"
          className={cn(
            "group/item relative flex h-10 w-full items-center overflow-hidden rounded-lg transition-all duration-200",
            collapsed
              ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
              : "justify-start gap-3",
            pathname === "/settings"
              ? cn(
                  "border-l-2 border-[var(--text-primary)] bg-[rgba(255,255,255,0.04)]",
                  collapsed
                    ? "pl-0 group-hover/sidebar:pl-[14px]"
                    : "pl-[14px]",
                )
              : cn(
                  "border-l-2 border-transparent hover:-translate-y-px hover:bg-[rgba(255,255,255,0.06)]",
                  collapsed ? "pl-0 group-hover/sidebar:pl-4" : "pl-4",
                ),
          )}
        >
          <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
            <Settings
              size={20}
              strokeWidth={pathname === "/settings" ? 2 : 1.5}
              className={pathname === "/settings" ? "text-[var(--text-primary)]" : "text-[var(--fg-secondary)]"}
            />
          </span>
          <span
            className={cn(
              "max-w-[140px] overflow-hidden whitespace-nowrap text-sm font-medium transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              pathname === "/settings" ? "text-[var(--text-primary)]" : "text-[var(--fg-secondary)]",
              collapsed
                ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
                : "opacity-100",
            )}
          >
            Settings
          </span>
        </Link>
      </div>
    </aside>
  );
}
