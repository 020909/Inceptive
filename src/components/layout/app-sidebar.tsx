"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  HeartPulse,
  Settings,
  ChevronDown,
  ChevronsUpDown,
  LogIn,
  PanelLeft,
  User,
  Coins,
  DollarSign,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";

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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
        "text-[var(--sidebar-icon)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)]",
        className
      )}
      aria-label="Toggle sidebar"
    >
      <PanelLeft className="size-[18px]" strokeWidth={2} />
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

function AccountPopover({
  collapsed,
  userDisplayName,
  userEmail,
  userInitial,
}: {
  collapsed: boolean;
  userDisplayName: string;
  userEmail: string;
  userInitial: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[var(--fg-primary)] hover:bg-[var(--bg-overlay)] transition-colors";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex w-full min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left text-[13px] font-semibold text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-item-hover)] hover:text-[var(--sidebar-fg)] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar-bg)]",
          collapsed && "justify-center px-0 py-2"
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--sidebar-border)] bg-[var(--sidebar-item-active)] text-sm font-bold text-[var(--sidebar-fg)]">
          {userInitial}
        </div>
        {!collapsed && (
          <>
            <div className="flex min-w-0 flex-1 flex-col items-start truncate">
              <span className="w-full truncate text-[13px] font-semibold leading-tight text-[var(--sidebar-fg)]">
                {userDisplayName}
              </span>
              <span className="mt-0.5 w-full truncate text-[11px] font-medium leading-tight text-[var(--sidebar-fg-muted)]">
                {userEmail}
              </span>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-[var(--sidebar-fg-muted)]" aria-hidden />
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-[200] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-1 shadow-lg",
            collapsed
              ? "bottom-0 left-full ml-2 w-56"
              : "bottom-full left-0 right-0 mb-1.5"
          )}
        >
          <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-[var(--fg-primary)]">{userDisplayName}</p>
            <p className="truncate text-xs font-medium text-[var(--fg-muted)]">{userEmail}</p>
          </div>
          <div className="p-1">
            <Link href="/settings" className={itemClass} onClick={() => setOpen(false)} role="menuitem">
              <Settings className="size-4 shrink-0 opacity-80" />
              Settings
            </Link>
            <Link
              href="/settings?section=account"
              className={itemClass}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <User className="size-4 shrink-0 opacity-80" />
              My account
            </Link>
            <Link href="/upgrade" className={itemClass} onClick={() => setOpen(false)} role="menuitem">
              <Coins className="size-4 shrink-0 opacity-80" />
              Credits
            </Link>
            <div className="my-1 h-px bg-[var(--border-subtle)]" />
            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, "text-[var(--destructive)] hover:bg-[var(--destructive-soft)]")}
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebarState();
  const { user, loading: authLoading } = useAuth();

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [projectsReady, setProjectsReady] = React.useState(false);
  const [revenueCriticalCount, setRevenueCriticalCount] = React.useState(0);
  const [vendorCriticalCount, setVendorCriticalCount] = React.useState(0);

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

  React.useEffect(() => {
    if (!user?.id) {
      setRevenueCriticalCount(0);
      return;
    }

    let mounted = true;
    const supabase = createClient();

    const loadCriticalCount = async () => {
      const { count } = await supabase
        .from("revenue_signals")
        .select("id", { count: "exact", head: true })
        .eq("account_id", user.id)
        .eq("status", "open")
        .eq("severity", "critical");

      if (mounted) {
        setRevenueCriticalCount(count ?? 0);
      }
    };

    void loadCriticalCount();

    const channel = supabase
      .channel(`revenue-signals:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "revenue_signals",
          filter: `account_id=eq.${user.id}`,
        },
        () => {
          void loadCriticalCount();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  React.useEffect(() => {
    if (!user?.id) {
      setVendorCriticalCount(0);
      return;
    }

    let mounted = true;
    const supabase = createClient();

    const loadCriticalCount = async () => {
      const { count } = await supabase
        .from("vendor_alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("severity", "critical");

      if (mounted) {
        setVendorCriticalCount(count ?? 0);
      }
    };

    void loadCriticalCount();

    const channel = supabase
      .channel("vendor-alerts:critical")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_alerts",
        },
        () => {
          void loadCriticalCount();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
      {/* Brand: expanded = toggle inside sidebar + logo + wordmark; collapsed = toggle only (replaces logo) */}
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-transparent",
          collapsed ? "justify-center py-5" : "gap-2 px-3 pt-5 pb-4"
        )}
      >
        {collapsed ? (
          <AppSidebarTrigger />
        ) : (
          <>
            <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Inceptive"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 object-contain invert dark:invert-0"
                priority
              />
              <span
                className="truncate text-[15px] font-bold tracking-tight text-[var(--sidebar-fg)]"
                style={{ fontFamily: "var(--font-header)", textTransform: "uppercase" }}
              >
                INCEPTIVE
              </span>
            </Link>
            <AppSidebarTrigger />
          </>
        )}
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
        <NavItem href="/dashboard/churn" icon={HeartPulse} label="Churn" isActive={pathname === "/dashboard/churn"} collapsed={collapsed} />
        <NavItem
          href="/dashboard/revenue"
          icon={DollarSign}
          label="Revenue Intelligence"
          isActive={pathname === "/dashboard/revenue"}
          collapsed={collapsed}
          badge={revenueCriticalCount > 0 ? revenueCriticalCount : undefined}
        />
        <NavItem
          href="/dashboard/vendors"
          icon={Building2}
          label="Vendors"
          isActive={pathname === "/dashboard/vendors"}
          collapsed={collapsed}
          badge={vendorCriticalCount > 0 ? vendorCriticalCount : undefined}
        />

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
          <AccountPopover
            collapsed={collapsed}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            userInitial={userInitial}
          />
        )}
      </div>
    </aside>
  );
}
