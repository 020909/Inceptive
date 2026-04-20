"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutGrid,
  MessageSquare,
  GitBranch,
  BookOpen,
  Mail,
  Search,
  Rows,
  Sparkles,
  Plug,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Plus,
  LogIn,
  Building2,
  Folder,
  PanelLeft,
  Home,
  MessageCircle,
  PieChart,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/lib/chat-context";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  status: string;
}

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarCtx = React.createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
});

// ─── Custom Sidebar Provider ──────────────────────────────────────────────────

export function AppSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const toggle = React.useCallback(() => setCollapsed((c) => !c), []);
  return (
    <SidebarCtx.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarCtx.Provider>
  );
}

export function useSidebarState() {
  return React.useContext(SidebarCtx);
}

// ─── Sidebar Trigger (for use in TopBar) ─────────────────────────────────────

export function AppSidebarTrigger({ className }: { className?: string }) {
  const { toggle } = useSidebarState();
  return (
    <button
      onClick={toggle}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-black dark:text-white hover:bg-[var(--sidebar-item-hover)] transition-all duration-150",
        className
      )}
      aria-label="Toggle sidebar"
    >
      <PanelLeft className="size-4" />
    </button>
  );
}

// ─── Nav Item ────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  collapsed,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  collapsed: boolean;
  badge?: number | string;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-all duration-150 relative",
        isActive
          ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)]"
          : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          isActive ? "text-[var(--sidebar-icon-active)]" : "text-[var(--sidebar-icon)]"
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate flex-1">{label}</span>
          {badge !== undefined && (
            <span className="ml-auto text-[11px] font-semibold text-[var(--sidebar-badge-text)] bg-[var(--sidebar-badge-bg)] rounded-md px-1.5 py-0.5">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

// ─── Collapsible Nav Group (for Projects) ────────────────────────────────────

function CollapsibleNavGroup({
  icon: Icon,
  label,
  isGroupActive,
  collapsed: sidebarCollapsed,
  children,
  defaultOpen = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isGroupActive: boolean;
  collapsed: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  if (sidebarCollapsed) {
    return (
      <button
        title={label}
        className={cn(
          "flex h-10 w-full items-center justify-center rounded-lg px-2 text-sm font-semibold transition-all duration-150",
          isGroupActive
            ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)]"
            : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]"
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon className={cn("size-[18px] shrink-0", isGroupActive ? "text-[var(--sidebar-icon-active)]" : "text-[var(--sidebar-icon)]")} />
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-all duration-150 relative",
          isGroupActive
            ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)]"
            : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]"
        )}
      >
        <Icon className={cn("size-[18px] shrink-0", isGroupActive ? "text-[var(--sidebar-icon-active)]" : "text-[var(--sidebar-icon)]")} />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronRight
          className={cn("size-3.5 text-[var(--sidebar-fg-muted)] transition-transform duration-200", open && "rotate-90")}
        />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

function CollapsibleNavChild({
  href,
  label,
  isActive,
  badge,
}: {
  href: string;
  label: string;
  isActive: boolean;
  badge?: number | string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg pl-10 pr-3 text-sm font-medium transition-all duration-150",
        isActive
          ? "text-[var(--sidebar-fg)]"
          : "text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-item-hover)]"
      )}
    >
      <span className="truncate flex-1">{label}</span>
      {badge !== undefined && (
        <span className="ml-auto text-[11px] font-medium text-[var(--sidebar-fg-muted)] bg-[var(--sidebar-badge-bg)] rounded-md px-1.5 py-0.5">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function NavDivider({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "my-2 border-t border-[var(--sidebar-divider)]",
        collapsed ? "mx-2" : "mx-3"
      )}
    />
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed } = useSidebarState();
  const { orgs, currentOrg, loading: orgLoading } = useOrg();
  const { user, loading: authLoading } = useAuth();

  // Fetch projects for the sidebar dropdown
  const [projects, setProjects] = React.useState<Project[]>([]);
  React.useEffect(() => {
    if (!user) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, [user]);

  const isProjectsActive = pathname.startsWith("/projects");
  const userEmail = user?.email ?? "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U";
  const userDisplayName = user?.user_metadata?.full_name || userEmail.split("@")[0] || "User";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-all duration-200 ease-in-out shrink-0 relative z-20",
        collapsed ? "w-[4.5rem]" : "w-[16rem]"
      )}
    >
      {/* ── Logo / Brand ── */}
      <div className={cn("flex items-center pt-8 pb-6 shrink-0", collapsed ? "justify-center px-0" : "px-6 gap-3")}>
        <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
          <Image src="/logo.png" alt="Inceptive" width={32} height={32} className="h-8 w-8 object-contain dark:invert-0 light:invert" id="sidebar-logo" />
          {!collapsed && (
            <span
              className="text-lg font-bold tracking-tight text-[var(--sidebar-fg)] whitespace-nowrap"
              style={{ fontFamily: "var(--font-header)", textTransform: "uppercase" }}
            >
              INCEPTIVE
            </span>
          )}
        </Link>
      </div>

      {/* ── Nav Items ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-0.5 scrollbar-hide">
        <NavItem href="/dashboard"    icon={LayoutGrid}    label="Command Center" isActive={pathname === "/dashboard"}  collapsed={collapsed} />
        <NavItem href="/agent"        icon={MessageSquare} label="Code Studio"    isActive={pathname === "/agent"}       collapsed={collapsed} />
        <NavItem href="/workflows"    icon={GitBranch}     label="Workflows"      isActive={pathname === "/workflows"}   collapsed={collapsed} />
        <NavItem href="/knowledge"    icon={BookOpen}      label="Knowledge Base" isActive={pathname === "/knowledge"}   collapsed={collapsed} />
        <NavItem href="/email"        icon={Mail}          label="Email"          isActive={pathname === "/email"}       collapsed={collapsed} />
        <NavItem href="/research"     icon={Search}        label="Research"       isActive={pathname === "/research"}    collapsed={collapsed} />

        <NavDivider collapsed={collapsed} />

        {/* Projects — collapsible with real project list */}
        <CollapsibleNavGroup
          icon={Rows}
          label="Projects"
          isGroupActive={isProjectsActive}
          collapsed={collapsed}
          defaultOpen={isProjectsActive}
        >
          <CollapsibleNavChild href="/projects" label="View all" isActive={pathname === "/projects"} badge={projects.length || undefined} />
          {projects.slice(0, 4).map((p) => (
            <CollapsibleNavChild
              key={p.id}
              href={`/projects`}
              label={p.name}
              isActive={false}
            />
          ))}
        </CollapsibleNavGroup>

        <NavDivider collapsed={collapsed} />

        <NavItem href="/skills"       icon={Sparkles}      label="Skills"         isActive={pathname === "/skills"}      collapsed={collapsed} />
        <NavItem href="/social"       icon={Plug}          label="Connectors"     isActive={pathname === "/social"}      collapsed={collapsed} />
        <NavItem href="/reports"      icon={FileText}      label="Reports"        isActive={pathname === "/reports"}     collapsed={collapsed} />
      </nav>

      {/* ── User Footer ── */}
      <div className="shrink-0 border-t border-[var(--sidebar-border)] p-4">
        {!authLoading && !user ? (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)] transition-all duration-150",
              collapsed && "justify-center px-2"
            )}
          >
            <LogIn className="size-[18px] shrink-0 text-[var(--sidebar-icon)]" />
            {!collapsed && <span>Sign in</span>}
          </Link>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full h-12 items-center gap-3 rounded-lg px-2 text-sm font-semibold text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)] transition-all duration-150",
                  collapsed && "justify-center px-1"
                )}
              >
                {/* Avatar */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)] text-sm font-bold border border-[var(--sidebar-border)]">
                  {userInitial}
                </div>
                {!collapsed && (
                  <>
                    <div className="flex flex-col items-start truncate flex-1 min-w-0">
                      <span className="text-sm font-bold text-[var(--sidebar-fg)] truncate w-full">{userDisplayName}</span>
                      <span className="text-xs text-[var(--sidebar-fg-muted)] truncate w-full">{userEmail}</span>
                    </div>
                    <ChevronsUpDown className="size-4 shrink-0 text-[var(--sidebar-fg-muted)]" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" align="end" side="top">
              <DropdownMenuLabel className="font-semibold p-3 pb-2">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[var(--fg-primary)]">{userDisplayName}</span>
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{userEmail}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                <Settings className="size-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[var(--destructive)] cursor-pointer" onClick={() => router.push("/login")}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}
