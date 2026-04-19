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

/** Rounded rectangle with inner vertical rule (sidebar layout cue) */
function SidebarToggleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="2" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ── Sidebar context ──
const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}>({ collapsed: false, setCollapsed: () => {} });
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
  { label: "Command Center", href: "/dashboard", icon: LayoutGrid },
  { label: "Code Studio", href: "/agent", icon: MessageSquare },
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
        "group/item relative flex h-10 w-full items-center overflow-hidden rounded-[8px] transition-all duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1",
        collapsed
          ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          : "justify-start gap-3",
        isActive
          ? cn(
              collapsed
                ? "pl-0 group-hover/sidebar:pl-[11px]"
                : "pl-[11px]",
            )
          : cn(
              collapsed ? "pl-0 group-hover/sidebar:pl-3" : "pl-3",
            ),
      )}
      style={
        isActive
          ? { background: "var(--nav-active-bg)", border: "none" }
          : undefined
      }
    >
      <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
        <Icon
          size={17}
          strokeWidth={isActive ? 1.8 : 1.5}
          style={{ color: isActive ? "var(--nav-active-text)" : "var(--fg-tertiary)" }}
        />
      </span>
      <span
        className={cn(
          "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          collapsed
            ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
            : "opacity-100",
        )}
        style={{
          fontFamily: "var(--font-body)",
          color: isActive ? "var(--nav-active-text)" : "var(--fg-secondary)",
        }}
      >
        {item.label}
      </span>
      {/* hover overlay — so we don't need to hardcode hover bg */}
      {!isActive && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[8px] opacity-0 transition-opacity duration-150 group-hover/item:opacity-100"
          style={{ background: "var(--nav-hover-bg)" }}
        />
      )}
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

  const switcherClass = cn(
    "flex h-13 w-full items-center rounded-[8px] px-3 text-left transition-colors",
    collapsed
      ? "justify-center gap-0 px-0 group-hover/sidebar:justify-between group-hover/sidebar:px-3"
      : "justify-between gap-3"
  );

  const inner = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-[6px]"
          style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          <Building2 size={14} style={{ color: "var(--fg-primary)" }} />
        </span>
        <div
          className={cn(
            "min-w-0 transition-[opacity,max-width] duration-300",
            collapsed
              ? "max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-[132px] group-hover/sidebar:opacity-100"
              : "max-w-[132px] opacity-100"
          )}
        >
          <p
            className="truncate"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--fg-muted)",
            }}
          >
            Workspace
          </p>
          <p
            className="truncate text-[13px]"
            style={{ fontFamily: "var(--font-body)", color: "var(--fg-primary)" }}
          >
            {label}
          </p>
        </div>
      </div>
      <ChevronsUpDown
        size={14}
        className={cn(
          "shrink-0 transition-[opacity] duration-300",
          collapsed ? "opacity-0 group-hover/sidebar:opacity-100" : "opacity-100"
        )}
        style={{ color: "var(--fg-muted)" }}
      />
    </>
  );

  return (
    <div className="px-2.5 pt-3">
      {orgs.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={switcherClass}
                style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
              />
            }
          >
            {inner}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-[8px] p-1.5"
            style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
            align="start"
          >
            <DropdownMenuLabel style={{ color: "var(--fg-muted)" }}>Switch Workspace</DropdownMenuLabel>
            {orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => router.push(`/org/${org.slug}/dashboard`)}
                className="flex items-center justify-between rounded-[6px] px-3 py-2 transition-colors"
                style={{
                  color: "var(--fg-primary)",
                  background: pathname.startsWith(`/org/${org.slug}`) ? "var(--nav-active-bg)" : undefined,
                }}
              >
                <span className="truncate">{org.name}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "var(--fg-muted)",
                  }}
                >
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
          className={switcherClass}
          style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
        >
          {inner}
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
        "group/item relative flex h-10 w-full items-center overflow-hidden rounded-[8px] transition-all duration-300",
        collapsed
          ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          : "justify-start gap-3 pl-3",
        isActive
          ? collapsed ? "pl-0 group-hover/sidebar:pl-[11px]" : "pl-[11px]"
          : collapsed ? "pl-0 group-hover/sidebar:pl-3" : "",
      )}
      style={isActive ? { background: "var(--nav-active-bg)" } : undefined}
    >
      <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
        <Icon
          size={17}
          strokeWidth={isActive ? 1.8 : 1.5}
          style={{ color: isActive ? "var(--nav-active-text)" : "var(--fg-tertiary)" }}
        />
      </span>
      <span
        className={cn(
          "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          collapsed
            ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
            : "opacity-100"
        )}
        style={{
          fontFamily: "var(--font-body)",
          color: isActive ? "var(--nav-active-text)" : "var(--fg-secondary)",
        }}
      >
        {label}
      </span>
      {!isActive && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[8px] opacity-0 transition-opacity duration-150 group-hover/item:opacity-100"
          style={{ background: "var(--nav-hover-bg)" }}
        />
      )}
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
    <div className="box-border flex h-full min-h-0 shrink-0 flex-col py-3 pl-3 pr-3">
      <aside
        className={`
          group/sidebar
          flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[22px]
          z-40
          transition-[width] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]
          ${collapsed ? "w-[64px] hover:w-[220px]" : "w-[220px]"}
        `}
        style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border-default)" }}
      >
        {/* ── Logo row ── */}
        <div
          className={cn(
            "aurora-divider flex shrink-0 overflow-hidden transition-[padding] duration-300",
            collapsed
              ? "flex-col items-center gap-1.5 px-2 py-3 group-hover/sidebar:h-16 group-hover/sidebar:flex-row group-hover/sidebar:items-center group-hover/sidebar:justify-start group-hover/sidebar:gap-2.5 group-hover/sidebar:py-0 group-hover/sidebar:px-3.5"
              : "h-16 flex-row items-center justify-start gap-2.5 px-3.5",
          )}
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="shrink-0 border-0 bg-transparent p-0 shadow-none outline-none"
            aria-label="Home"
          >
            <Image src="/logo.png" alt="Inceptive" width={32} height={32} className="h-8 w-8 object-contain" priority />
          </button>

          <span
            className={cn(
              "min-w-0 truncate text-[0.9rem] leading-none transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              collapsed
                ? "hidden max-w-0 overflow-hidden opacity-0 group-hover/sidebar:block group-hover/sidebar:max-w-[120px] group-hover/sidebar:flex-1 group-hover/sidebar:opacity-100"
                : "flex-1 opacity-100",
            )}
            style={{ fontFamily: "var(--font-header)", color: "var(--fg-primary)" }}
          >
            Inceptive
          </span>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] transition-colors"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--nav-hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--fg-primary)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)"; }}
          >
            <SidebarToggleIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <OrganizationSwitcher collapsed={collapsed} />

        {currentOrg ? (
          <div className="px-2.5 pt-3">
            <p
              className={cn(
                "px-2.5 transition-[opacity,max-width] duration-300",
                collapsed ? "max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100" : "opacity-100"
              )}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "var(--fg-muted)",
              }}
            >
              Workspace
            </p>
            <div className="mt-1.5">
              {[
                { href: `/org/${currentOrg.slug}/workflows`, label: "Workflows", icon: GitBranch, match: [`/org/${currentOrg.slug}/workflows`] },
                { href: `/org/${currentOrg.slug}/workflows/builder`, label: "Workflow Builder", icon: GitBranch, match: [`/org/${currentOrg.slug}/workflows/builder`] },
                { href: `/org/${currentOrg.slug}/activity`, label: "Activity Log", icon: ListChecks, match: [`/org/${currentOrg.slug}/activity`] },
                { href: `/org/${currentOrg.slug}/analytics`, label: "Analytics", icon: BarChart2, match: [`/org/${currentOrg.slug}/analytics`] },
                { href: `/org/${currentOrg.slug}/settings`, label: "Governance", icon: Settings, match: [`/org/${currentOrg.slug}/settings`] },
              ].map(({ href, label, icon, match }) => (
                <WorkspaceNavItem
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  collapsed={collapsed}
                  isActive={match.some(m => pathname === m || pathname.startsWith(m + "/"))}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Nav ── */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2.5 pt-3 overflow-hidden">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
            />
          ))}

          {/* Agents online indicator */}
          <div className="mt-auto">
            <div
              className={cn(
                "mx-2 mb-3 rounded-[8px] px-3 py-2.5 transition-[opacity,max-height] duration-300",
                collapsed && "opacity-0 max-h-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:max-h-20"
              )}
              style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
                  style={{ background: "var(--success)" }}
                />
                <span
                  className="text-[12px]"
                  style={{ fontFamily: "var(--font-body)", color: "var(--fg-muted)" }}
                >
                  Agents online
                </span>
              </div>
            </div>
          </div>
        </nav>

        {/* ── Recent Chats ── */}
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
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: "var(--fg-muted)",
                  }}
                >
                  Recent
                </span>
                <button
                  onClick={() => { startNewChat(); router.push('/agent'); }}
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors"
                  style={{ color: "var(--fg-muted)" }}
                  title="New chat"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--nav-hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--fg-primary)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)"; }}
                >
                  <Plus size={11} />
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                {recentChats.slice(0, 6).map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleLoadChat(chat)}
                    className="group/chat w-full truncate whitespace-nowrap rounded-[6px] px-2.5 py-2 text-left text-[12px] transition-colors relative"
                    title={chat.title}
                    style={{ fontFamily: "var(--font-body)", color: "var(--fg-secondary)" }}
                  >
                    {chat.title}
                    <span
                      className="pointer-events-none absolute inset-0 rounded-[6px] opacity-0 transition-opacity duration-150 group-hover/chat:opacity-100"
                      style={{ background: "var(--nav-hover-bg)" }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom: Sign in (guests) ── */}
        <div
          className="aurora-divider shrink-0 px-2.5 pb-4 pt-2.5 space-y-1"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {!authLoading && !user ? (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className={cn(
                "group/item relative flex h-10 w-full items-center overflow-hidden rounded-[8px] transition-all duration-300",
                collapsed
                  ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
                  : "justify-start gap-3",
                collapsed ? "pl-0 group-hover/sidebar:pl-3" : "pl-3",
              )}
              style={{ border: "1px solid var(--border-default)", background: "var(--bg-elevated)" }}
            >
              <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
                <LogIn size={17} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
              </span>
              <span
                className={cn(
                  "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  collapsed
                    ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
                    : "opacity-100",
                )}
                style={{ fontFamily: "var(--font-body)", color: "var(--fg-primary)" }}
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
