'use client';

import React, { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutGrid,
  MessageSquare,
  Mail,
  Search,
  BookOpen,
  Plug,
  FileText,
  Settings,
  LogIn,
  Sparkles,
  Plus,
  FolderKanban,
  Building2,
  ChevronsUpDown,
  ListChecks,
  GitBranch,
  BarChart2,
} from "lucide-react";
import { useChat } from "@/lib/chat-context";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}>({ collapsed: false, setCollapsed: () => {} });
export function useSidebar() { return useContext(SidebarContext); }

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  /** Default narrow rail (64px); hover expands to 220px when collapsed, or pin open via toggle. */
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

const navItems = [
  { label: "Command Center", href: "/dashboard", icon: LayoutGrid },
  { label: "AI Agent", href: "/agent", icon: MessageSquare },
  { label: "Workflows", href: "/workflows", icon: GitBranch },
  { label: "Knowledge Base", href: "/knowledge", icon: BookOpen },
  { label: "Email", href: "/email", icon: Mail },
  { label: "Research", href: "/research", icon: Search },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Skills", href: "/skills", icon: Sparkles },
  { label: "Connectors", href: "/social", icon: Plug },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
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
        "group/item relative flex h-11 w-full items-center overflow-hidden rounded-xl transition-all duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        collapsed
          ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          : "justify-start gap-3",
        isActive
          ? cn(
              "border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_16px_36px_rgba(0,0,0,0.28)]",
              collapsed
                ? "pl-0 group-hover/sidebar:pl-[12px]"
                : "pl-[12px]",
            )
          : cn(
              "border border-transparent hover:bg-[var(--bg-overlay)]",
              collapsed ? "pl-0 group-hover/sidebar:pl-3.5" : "pl-3.5",
            ),
      )}
    >
      <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
        <Icon size={18} strokeWidth={isActive ? 2 : 1.6} className={isActive ? "text-[var(--fg-primary)]" : "text-[var(--fg-tertiary)]"} />
                    </span>

      <span
        className={cn(
          "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] font-medium tracking-[0.01em] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isActive ? "text-[var(--fg-primary)]" : "text-[var(--fg-secondary)]",
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

function OrganizationSwitcher({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { orgs, currentOrg, loading } = useOrg();

  const workspaceName = currentOrg?.name?.trim();
  const label = loading
    ? "Loading workspace"
    : workspaceName && workspaceName !== "No workspace"
      ? workspaceName
      : "Personal Workspace";
  const href = currentOrg ? `/org/${currentOrg.slug}/dashboard` : "/org/create";

  return (
    <div className="px-2.5 pt-3">
      {orgs.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex h-14 w-full items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-left transition-colors hover:bg-[var(--bg-overlay)]",
                  collapsed
                    ? "justify-center gap-0 px-0 group-hover/sidebar:justify-between group-hover/sidebar:px-3"
                    : "justify-between gap-3"
                )}
              />
            }
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
                <Building2 size={16} className="text-[var(--fg-primary)]" />
              </span>
              <div
                className={cn(
                  "min-w-0 transition-[opacity,max-width] duration-300",
                  collapsed
                    ? "max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-[132px] group-hover/sidebar:opacity-100"
                    : "max-w-[132px] opacity-100"
                )}
              >
                <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                  Workspace
                </p>
                <p className="truncate text-sm font-medium text-[var(--fg-primary)]">{label}</p>
              </div>
            </div>
            <ChevronsUpDown
              size={15}
              className={cn(
                "shrink-0 text-[var(--fg-muted)] transition-[opacity] duration-300",
                collapsed ? "opacity-0 group-hover/sidebar:opacity-100" : "opacity-100"
              )}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5"
            align="start"
          >
            <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
            {orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => router.push(`/org/${org.slug}/dashboard`)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2",
                  pathname.startsWith(`/org/${org.slug}`) && "bg-[var(--accent-soft)] text-[var(--fg-primary)]"
                )}
              >
                <span className="truncate">{org.name}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                  {org.membership_role}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          onClick={() => router.push(href)}
          className={cn(
            "flex h-14 w-full items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-left transition-colors hover:bg-[var(--bg-overlay)]",
            collapsed ? "justify-center px-0 group-hover/sidebar:justify-start group-hover/sidebar:px-3" : "gap-3"
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]">
            <Building2 size={16} className="text-[var(--fg-primary)]" />
          </span>
          <div
            className={cn(
              "min-w-0 transition-[opacity,max-width] duration-300",
              collapsed
                ? "max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-[132px] group-hover/sidebar:opacity-100"
                : "max-w-[132px] opacity-100"
            )}
          >
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">
              Workspace
            </p>
            <p className="truncate text-sm font-medium text-[var(--fg-primary)]">{label}</p>
          </div>
        </button>
      )}

    </div>
  );
}

function WorkspaceNavItem({
  href,
  label,
  icon: Icon,
  collapsed,
  isActive,
}: {
  href: string;
  label: string;
  icon: typeof ListChecks;
  collapsed: boolean;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/item relative flex h-11 w-full items-center overflow-hidden rounded-xl transition-all duration-300",
        collapsed
          ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          : "justify-start gap-3 pl-3.5",
        isActive
          ? cn(
              "border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_16px_36px_rgba(0,0,0,0.28)]",
              collapsed ? "pl-0 group-hover/sidebar:pl-[12px]" : "pl-[12px]"
            )
          : cn(
              "border border-transparent hover:bg-[var(--bg-overlay)]",
              collapsed ? "pl-0 group-hover/sidebar:pl-3.5" : ""
            )
      )}
    >
      <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
        <Icon size={18} strokeWidth={isActive ? 2 : 1.6} className={isActive ? "text-[var(--fg-primary)]" : "text-[var(--fg-tertiary)]"} />
      </span>
      <span
        className={cn(
          "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] font-medium tracking-[0.01em] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isActive ? "text-[var(--fg-primary)]" : "text-[var(--fg-secondary)]",
          collapsed
            ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
            : "opacity-100"
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();
  const { recentChats, loadChat, startNewChat } = useChat();
  const { currentOrg } = useOrg();
  const { user, loading: authLoading } = useAuth();

  const handleLoadChat = (chat: ReturnType<typeof useChat>['recentChats'][0]) => {
    loadChat(chat);
    router.push('/agent');
  };

  return (
    /* Equal top/bottom space outside the rail (py-3): wrapper is full viewport height in the shell; aside fills the padded area. */
    <div className="box-border flex h-full min-h-0 shrink-0 flex-col py-3 pl-3 pr-3">
      {/* group/sidebar — drives the label reveal on hover via group-hover/sidebar: */}
      <aside
        className={`
          group/sidebar
          sidebar-surface
          flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[28px]
          z-40
          transition-[width] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]
          border border-[var(--border-default)]
          ${collapsed ? "w-[64px] hover:w-[220px]" : "w-[220px]"}
        `}
      >
      {/* ── Logo row: stacked logo + toggle when squeezed; horizontal when expanded or rail hover ── */}
      <div
        className={cn(
          "aurora-divider flex shrink-0 overflow-hidden transition-[padding] duration-300",
          collapsed
            ? "flex-col items-center gap-1.5 px-2 py-3 group-hover/sidebar:h-16 group-hover/sidebar:flex-row group-hover/sidebar:items-center group-hover/sidebar:justify-start group-hover/sidebar:gap-2.5 group-hover/sidebar:py-0 group-hover/sidebar:px-3.5"
            : "h-16 flex-row items-center justify-start gap-2.5 px-3.5",
        )}
      >
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="shrink-0 border-0 bg-transparent p-0 shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
          aria-label="Home"
        >
          <Image
            src="/logo.png"
            alt="Inceptive"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
        </button>

        <span
          className={cn(
            "min-w-0 truncate text-[0.95rem] leading-none text-[var(--fg-primary)] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            collapsed
              ? "hidden max-w-0 overflow-hidden opacity-0 group-hover/sidebar:block group-hover/sidebar:max-w-[120px] group-hover/sidebar:flex-1 group-hover/sidebar:opacity-100"
              : "flex-1 opacity-100",
          )}
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          <span className="font-semibold tracking-tight text-[var(--fg-primary)] uppercase">INCEPTIVE</span>
        </span>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--fg-primary)]"
        >
          <SidebarToggleIcon className="h-4 w-4" />
        </button>
      </div>

      <OrganizationSwitcher collapsed={collapsed} />

      {currentOrg ? (
        <div className="px-2.5 pt-3">
          <p
            className={cn(
              "px-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--fg-muted)] transition-[opacity,max-width] duration-300",
              collapsed ? "max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100" : "opacity-100"
            )}
          >
            Workspace
          </p>
          <div className="mt-2">
            <WorkspaceNavItem
              href={`/org/${currentOrg.slug}/workflows`}
              label="Workflows"
              icon={GitBranch}
              collapsed={collapsed}
              isActive={pathname === `/org/${currentOrg.slug}/workflows` || pathname.startsWith(`/org/${currentOrg.slug}/workflows/`)}
            />
            <WorkspaceNavItem
              href={`/org/${currentOrg.slug}/workflows/builder`}
              label="Workflow Builder"
              icon={GitBranch}
              collapsed={collapsed}
              isActive={pathname === `/org/${currentOrg.slug}/workflows/builder`}
            />
            <WorkspaceNavItem
              href={`/org/${currentOrg.slug}/activity`}
              label="Activity Log"
              icon={ListChecks}
              collapsed={collapsed}
              isActive={pathname === `/org/${currentOrg.slug}/activity`}
            />
            <WorkspaceNavItem
              href={`/org/${currentOrg.slug}/analytics`}
              label="Analytics"
              icon={BarChart2}
              collapsed={collapsed}
              isActive={pathname === `/org/${currentOrg.slug}/analytics`}
            />
            <WorkspaceNavItem
              href={`/org/${currentOrg.slug}/settings`}
              label="Governance"
              icon={Settings}
              collapsed={collapsed}
              isActive={pathname === `/org/${currentOrg.slug}/settings`}
            />
          </div>
        </div>
      ) : null}

      {/* ── Nav ── */}
      <nav className="flex flex-1 flex-col gap-1 px-2.5 pt-3 overflow-hidden">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}
        <div className="mt-auto">
          <div className="mx-3 mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-xs text-[var(--fg-muted)]">Agents online</span>
            </div>
          </div>
        </div>
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
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--fg-muted)]">
                Recent
              </span>
              <button
                onClick={() => { startNewChat(); router.push('/agent'); }}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--fg-primary)]"
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
                  className="w-full truncate whitespace-nowrap rounded-xl px-2.5 py-2 text-left text-xs text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--fg-primary)]"
                  title={chat.title}
                >
                  {chat.title}
                </button>
        ))}
      </div>
    </div>
        )}
      </div>

      {/* ── Bottom: Sign in (guests) ── */}
      <div className="aurora-divider shrink-0 border-t border-[var(--border-default)] px-2.5 pb-4 pt-2.5 space-y-1">
        {!authLoading && !user ? (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className={cn(
              "group/item relative flex h-11 w-full items-center overflow-hidden rounded-xl transition-all duration-300",
              collapsed
                ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
                : "justify-start gap-3",
              "border border-transparent bg-[var(--accent-soft)]/80 hover:bg-[var(--accent-soft)]",
              collapsed ? "pl-0 group-hover/sidebar:pl-3.5" : "pl-3.5",
            )}
          >
            <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
              <LogIn size={18} strokeWidth={1.6} className="text-[var(--accent)]" />
            </span>
            <span
              className={cn(
                "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] font-semibold tracking-[0.01em] text-[var(--fg-primary)] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                collapsed
                  ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
                  : "opacity-100",
              )}
            >
              Sign in
            </span>
          </Link>
        ) : null}
      </div>
    </aside>
    </div>
  );
}
