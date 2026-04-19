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
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1863dc] focus-visible:outline-offset-1",
        collapsed
          ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          : "justify-start gap-3",
        isActive
          ? cn(
              "border border-[#d9d9dd] bg-white",
              collapsed
                ? "pl-0 group-hover/sidebar:pl-[11px]"
                : "pl-[11px]",
            )
          : cn(
              "border border-transparent hover:bg-[#f2f2f2]",
              collapsed ? "pl-0 group-hover/sidebar:pl-3" : "pl-3",
            ),
      )}
    >
      <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
        <Icon
          size={17}
          strokeWidth={isActive ? 1.8 : 1.5}
          className={isActive ? "text-black" : "text-[#93939f]"}
        />
      </span>

      <span
        className={cn(
          "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isActive ? "text-black font-normal" : "text-[#212121] font-normal",
          collapsed
            ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
            : "opacity-100",
        )}
        style={{ fontFamily: "var(--font-body)" }}
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
                  "flex h-13 w-full items-center rounded-[8px] border border-[#d9d9dd] bg-white px-3 text-left transition-colors hover:bg-[#fafafa]",
                  collapsed
                    ? "justify-center gap-0 px-0 group-hover/sidebar:justify-between group-hover/sidebar:px-3"
                    : "justify-between gap-3"
                )}
              />
            }
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-[#d9d9dd] bg-[#fafafa]">
                <Building2 size={15} className="text-black" />
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
                  className="truncate text-[#93939f]"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em" }}
                >
                  Workspace
                </p>
                <p className="truncate text-[13px] text-black" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
              </div>
            </div>
            <ChevronsUpDown
              size={14}
              className={cn(
                "shrink-0 text-[#93939f] transition-[opacity] duration-300",
                collapsed ? "opacity-0 group-hover/sidebar:opacity-100" : "opacity-100"
              )}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-[8px] border border-[#d9d9dd] bg-white p-1.5"
            align="start"
          >
            <DropdownMenuLabel className="text-[#93939f]">Switch Workspace</DropdownMenuLabel>
            {orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => router.push(`/org/${org.slug}/dashboard`)}
                className={cn(
                  "flex items-center justify-between rounded-[6px] px-3 py-2 text-black hover:bg-[#f2f2f2]",
                  pathname.startsWith(`/org/${org.slug}`) && "bg-[#f2f2f2]"
                )}
              >
                <span className="truncate">{org.name}</span>
                <span
                  className="text-[#93939f]"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.14em" }}
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
          className={cn(
            "flex h-13 w-full items-center rounded-[8px] border border-[#d9d9dd] bg-white px-3 text-left transition-colors hover:bg-[#fafafa]",
            collapsed ? "justify-center px-0 group-hover/sidebar:justify-start group-hover/sidebar:px-3" : "gap-3"
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-[#d9d9dd] bg-[#fafafa]">
            <Building2 size={15} className="text-black" />
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
              className="truncate text-[#93939f]"
              style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em" }}
            >
              Workspace
            </p>
            <p className="truncate text-[13px] text-black" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
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
        "group/item relative flex h-10 w-full items-center overflow-hidden rounded-[8px] transition-all duration-300",
        collapsed
          ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          : "justify-start gap-3 pl-3",
        isActive
          ? cn(
              "border border-[#d9d9dd] bg-white",
              collapsed ? "pl-0 group-hover/sidebar:pl-[11px]" : "pl-[11px]"
            )
          : cn(
              "border border-transparent hover:bg-[#f2f2f2]",
              collapsed ? "pl-0 group-hover/sidebar:pl-3" : ""
            )
      )}
    >
      <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
        <Icon
          size={17}
          strokeWidth={isActive ? 1.8 : 1.5}
          className={isActive ? "text-black" : "text-[#93939f]"}
        />
      </span>
      <span
        className={cn(
          "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isActive ? "text-black" : "text-[#212121]",
          collapsed
            ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
            : "opacity-100"
        )}
        style={{ fontFamily: "var(--font-body)" }}
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
    <div className="box-border flex h-full min-h-0 shrink-0 flex-col py-3 pl-3 pr-3">
      {/* group/sidebar — drives the label reveal on hover */}
      <aside
        className={`
          group/sidebar
          flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[22px]
          z-40
          bg-[#fafafa] border border-[#d9d9dd]
          transition-[width] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]
          ${collapsed ? "w-[64px] hover:w-[220px]" : "w-[220px]"}
        `}
      >
        {/* ── Logo row ── */}
        <div
          className={cn(
            "aurora-divider flex shrink-0 overflow-hidden border-b border-[#d9d9dd] transition-[padding] duration-300",
            collapsed
              ? "flex-col items-center gap-1.5 px-2 py-3 group-hover/sidebar:h-16 group-hover/sidebar:flex-row group-hover/sidebar:items-center group-hover/sidebar:justify-start group-hover/sidebar:gap-2.5 group-hover/sidebar:py-0 group-hover/sidebar:px-3.5"
              : "h-16 flex-row items-center justify-start gap-2.5 px-3.5",
          )}
        >
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="shrink-0 border-0 bg-transparent p-0 shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[#1863dc] focus-visible:ring-offset-2"
            aria-label="Home"
          >
            <Image
              src="/logo.png"
              alt="Inceptive"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </button>

          <span
            className={cn(
              "min-w-0 truncate text-[0.9rem] leading-none text-black transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[#93939f] transition-colors hover:bg-[#e5e7eb] hover:text-black"
          >
            <SidebarToggleIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <OrganizationSwitcher collapsed={collapsed} />

        {currentOrg ? (
          <div className="px-2.5 pt-3">
            <p
              className={cn(
                "px-2.5 text-[#93939f] transition-[opacity,max-width] duration-300",
                collapsed ? "max-w-0 overflow-hidden opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100" : "opacity-100"
              )}
              style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em" }}
            >
              Workspace
            </p>
            <div className="mt-1.5">
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
                "mx-2 mb-3 rounded-[8px] border border-[#d9d9dd] bg-white px-3 py-2.5 transition-[opacity,max-width] duration-300",
                collapsed && "opacity-0 max-h-0 overflow-hidden group-hover/sidebar:opacity-100 group-hover/sidebar:max-h-20"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1c8f3a] animate-pulse shrink-0" />
                <span className="text-[12px] text-[#93939f]" style={{ fontFamily: "var(--font-body)" }}>
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
                  className="whitespace-nowrap text-[#93939f]"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em" }}
                >
                  Recent
                </span>
                <button
                  onClick={() => { startNewChat(); router.push('/agent'); }}
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[#93939f] transition-colors hover:bg-[#e5e7eb] hover:text-black"
                  title="New chat"
                >
                  <Plus size={11} />
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                {recentChats.slice(0, 6).map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleLoadChat(chat)}
                    className="w-full truncate whitespace-nowrap rounded-[6px] px-2.5 py-2 text-left text-[12px] text-[#212121] transition-colors hover:bg-[#f2f2f2] hover:text-black"
                    title={chat.title}
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {chat.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom: Sign in (guests) ── */}
        <div className="aurora-divider shrink-0 border-t border-[#d9d9dd] px-2.5 pb-4 pt-2.5 space-y-1">
          {!authLoading && !user ? (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className={cn(
                "group/item relative flex h-10 w-full items-center overflow-hidden rounded-[8px] transition-all duration-300",
                collapsed
                  ? "justify-center gap-0 px-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
                  : "justify-start gap-3",
                "border border-[#d9d9dd] bg-white hover:border-[#1863dc]",
                collapsed ? "pl-0 group-hover/sidebar:pl-3" : "pl-3",
              )}
            >
              <span className="flex shrink-0 items-center justify-center size-5 min-w-[20px]">
                <LogIn size={17} strokeWidth={1.5} className="text-[#1863dc]" />
              </span>
              <span
                className={cn(
                  "max-w-[140px] overflow-hidden whitespace-nowrap text-[13px] text-black transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  collapsed
                    ? "max-w-0 opacity-0 group-hover/sidebar:max-w-[140px] group-hover/sidebar:opacity-100"
                    : "opacity-100",
                )}
                style={{ fontFamily: "var(--font-body)" }}
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
