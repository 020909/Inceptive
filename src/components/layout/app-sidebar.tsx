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
  ChevronsUpDown,
  LogIn,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
      type="button"
      onClick={toggle}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150",
        "text-[var(--sidebar-icon)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]",
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
        "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] font-semibold leading-none transition-colors duration-150",
        isActive
          ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)]"
          : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          isActive ? "text-[var(--sidebar-icon-active)]" : "text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-icon-active)]"
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-left">{label}</span>
          {badge !== undefined && (
            <span className="ml-auto min-w-[1.25rem] text-center text-[11px] font-semibold tabular-nums text-[var(--sidebar-badge-text)] bg-[var(--sidebar-badge-bg)] rounded-md px-1.5 py-0.5">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

// ─── Collapsible Nav Group (Projects when list exists) ───────────────────────

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

  React.useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (sidebarCollapsed) {
    return (
      <Link
        href="/projects"
        title={label}
        className={cn(
          "flex h-9 w-full items-center justify-center rounded-lg text-[13px] font-semibold transition-colors duration-150",
          isGroupActive
            ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)]"
            : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]"
        )}
      >
        <Icon
          className={cn(
            "size-[18px] shrink-0",
            isGroupActive ? "text-[var(--sidebar-icon-active)]" : "text-[var(--sidebar-icon)]"
          )}
        />
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] font-semibold transition-colors duration-150",
          isGroupActive
            ? "bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)]"
            : "text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]"
        )}
      >
        <Icon
          className={cn(
            "size-[18px] shrink-0",
            isGroupActive ? "text-[var(--sidebar-icon-active)]" : "text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-icon-active)]"
          )}
        />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-[var(--sidebar-fg-muted)] transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="mt-0.5 space-y-0.5 border-l border-[var(--sidebar-divider)] ml-3.5 pl-2.5">{children}</div>}
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
        "flex h-8 items-center gap-2 rounded-md pl-1 pr-2 text-[13px] font-medium transition-colors duration-150",
        isActive
          ? "text-[var(--sidebar-fg)] bg-[var(--sidebar-item-hover)]"
          : "text-[var(--sidebar-fg-muted)] hover:text-[var(--sidebar-fg)] hover:bg-[var(--sidebar-item-hover)]"
      )}
    >
      <span className="truncate flex-1">{label}</span>
      {badge !== undefined && (
        <span className="ml-auto text-[11px] font-medium tabular-nums text-[var(--sidebar-badge-text)] bg-[var(--sidebar-badge-bg)] rounded px-1.5 py-0.5">
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
      role="separator"
      className={cn("my-2 h-px bg-[var(--sidebar-divider)]", collapsed ? "mx-1.5" : "mx-0")}
    />
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed } = useSidebarState();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [projectsReady, setProjectsReady] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      setProjects([]);
      setProjectsReady(true);
      return;
    }
    setProjectsReady(false);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsReady(true));
  }, [user]);

  const isProjectsActive = pathname.startsWith("/projects");
  const userEmail = user?.email ?? "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U";
  const userDisplayName = user?.user_metadata?.full_name || userEmail.split("@")[0] || "User";
  const showProjectsDropdown = projectsReady && projects.length > 0;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-out shrink-0 relative z-20",
        collapsed ? "w-[4.25rem]" : "w-[15rem] sm:w-[16rem]"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center shrink-0 border-b border-transparent",
          collapsed ? "justify-center py-5" : "px-4 pt-6 pb-4 gap-3"
        )}
      >
        <Link href="/dashboard" className={cn("flex items-center gap-3 min-w-0", collapsed && "justify-center")}>
          <Image
            src="/logo.png"
            alt="Inceptive"
            width={32}
            height={32}
            className="h-8 w-8 object-contain brightness-0 dark:invert"
            priority
          />
          {!collapsed && (
            <span
              className="text-[15px] font-bold tracking-tight text-[var(--sidebar-fg)] truncate"
              style={{ fontFamily: "var(--font-header)", textTransform: "uppercase" }}
            >
              INCEPTIVE
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-0.5 scrollbar-hide">
        <NavItem
          href="/dashboard"
          icon={LayoutGrid}
          label="Command Center"
          isActive={pathname === "/dashboard"}
          collapsed={collapsed}
        />
        <NavItem href="/agent" icon={MessageSquare} label="Code Studio" isActive={pathname === "/agent"} collapsed={collapsed} />
        <NavItem href="/workflows" icon={GitBranch} label="Workflows" isActive={pathname === "/workflows"} collapsed={collapsed} />
        <NavItem href="/knowledge" icon={BookOpen} label="Knowledge Base" isActive={pathname === "/knowledge"} collapsed={collapsed} />
        <NavItem href="/email" icon={Mail} label="Email" isActive={pathname === "/email"} collapsed={collapsed} />
        <NavItem href="/research" icon={Search} label="Research" isActive={pathname === "/research"} collapsed={collapsed} />

        <NavDivider collapsed={collapsed} />

        {showProjectsDropdown ? (
          <CollapsibleNavGroup
            icon={Rows}
            label="Projects"
            isGroupActive={isProjectsActive}
            collapsed={collapsed}
            defaultOpen={isProjectsActive}
          >
            <CollapsibleNavChild
              href="/projects"
              label="View all"
              isActive={pathname === "/projects"}
              badge={projects.length}
            />
            {projects.slice(0, 12).map((p) => (
              <CollapsibleNavChild key={p.id} href="/projects" label={p.name} isActive={false} />
            ))}
          </CollapsibleNavGroup>
        ) : (
          <NavItem
            href="/projects"
            icon={Rows}
            label="Projects"
            isActive={isProjectsActive}
            collapsed={collapsed}
          />
        )}

        <NavDivider collapsed={collapsed} />

        <NavItem href="/skills" icon={Sparkles} label="Skills" isActive={pathname === "/skills"} collapsed={collapsed} />
        <NavItem href="/social" icon={Plug} label="Connectors" isActive={pathname === "/social"} collapsed={collapsed} />
        <NavItem href="/reports" icon={FileText} label="Reports" isActive={pathname === "/reports"} collapsed={collapsed} />
      </nav>

      {/* Account — Settings only from chevron menu, not in nav */}
      <div className="shrink-0 border-t border-[var(--sidebar-border)] px-2 py-3">
        {!authLoading && !user ? (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className={cn(
              "flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] font-semibold text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)] transition-colors duration-150",
              collapsed && "justify-center px-0"
            )}
          >
            <LogIn className="size-[18px] shrink-0 text-[var(--sidebar-icon)]" />
            {!collapsed && <span>Sign in</span>}
          </Link>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex w-full min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-[13px] font-semibold text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar-bg)]",
                collapsed && "justify-center px-0 py-2"
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-item-active)] text-[var(--sidebar-fg)] text-sm font-bold border border-[var(--sidebar-border)]">
                {userInitial}
              </div>
              {!collapsed && (
                <>
                  <div className="flex flex-col items-start truncate flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-[var(--sidebar-fg)] truncate w-full leading-tight">
                      {userDisplayName}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--sidebar-fg-muted)] truncate w-full leading-tight mt-0.5">
                      {userEmail}
                    </span>
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-[var(--sidebar-fg-muted)]" aria-hidden />
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-1" align="end" side="top">
              <DropdownMenuLabel className="font-semibold p-3 pb-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-[var(--fg-primary)]">{userDisplayName}</span>
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{userEmail}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/settings")}>
                <Settings className="size-4 mr-2" />
                Settings
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
