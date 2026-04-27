"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutGrid,
  FolderOpen,
  GitBranch,
  BookOpen,
  Search,
  Plug,
  FileText,
  Building2,
  Settings,
  ChevronsUpDown,
  LogIn,
  PanelLeft,
  User,
  Coins,
  Brain,
  Shield,
  AlertCircle,
  FileSearch,
  Scale,
  Landmark,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarCtx = React.createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
});

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

// ─── Sidebar Trigger ──────────────────────────────────────────────────────────

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

// ─── Nav Section Header ──────────────────────────────────────────────────────

function NavSectionHeader({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) return null;
  return (
    <div className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--sidebar-fg-muted)]">
      {label}
    </div>
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

// ─── Account Popover ──────────────────────────────────────────────────────────

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
            "absolute z-[200] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-1",
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
  const [pendingApprovalsCount, setPendingApprovalsCount] = React.useState(0);

  // Load pending approvals count
  React.useEffect(() => {
    if (!user?.id) {
      setPendingApprovalsCount(0);
      return;
    }

    let mounted = true;
    const supabase = createClient();

    const loadPendingCount = async () => {
      const { count } = await supabase
        .from("approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (mounted) {
        setPendingApprovalsCount(count ?? 0);
      }
    };

    void loadPendingCount();

    const channel = supabase
      .channel("approval-queue-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_queue",
        },
        () => {
          void loadPendingCount();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const userEmail = user?.email ?? "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U";
  const userDisplayName = user?.user_metadata?.full_name || userEmail.split("@")[0] || "User";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-[#181C1E] bg-[#040506] shrink-0 relative z-20",
        collapsed ? "w-[4.25rem]" : "w-[240px]"
      )}
    >
      {/* Brand */}
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
        {/* MAIN Section */}
        {!collapsed && <NavSectionHeader label="Main" collapsed={collapsed} />}
        <NavItem
          href="/dashboard"
          icon={LayoutGrid}
          label="Operations Center"
          isActive={pathname === "/dashboard"}
          collapsed={collapsed}
        />
        <NavItem
          href="/cases"
          icon={FolderOpen}
          label="Cases"
          isActive={pathname.startsWith("/cases")}
          collapsed={collapsed}
        />
        <NavItem
          href="/approval-queue"
          icon={AlertCircle}
          label="Approval Queue"
          isActive={pathname.startsWith("/approval-queue")}
          collapsed={collapsed}
          badge={pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined}
        />

        <NavDivider collapsed={collapsed} />

        {/* AI AGENTS Section */}
        {!collapsed && <NavSectionHeader label="AI Agents" collapsed={collapsed} />}
        <NavItem
          href="/analyst"
          icon={Brain}
          label="Inceptive Analyst"
          isActive={pathname.startsWith("/analyst")}
          collapsed={collapsed}
        />
        <NavItem
          href="/sar-drafter"
          icon={FileText}
          label="SAR Drafter"
          isActive={pathname.startsWith("/sar-drafter")}
          collapsed={collapsed}
        />
        <NavItem
          href="/vendor-analyst"
          icon={Building2}
          label="Vendor Analyst"
          isActive={pathname.startsWith("/vendor-analyst")}
          collapsed={collapsed}
        />
        <NavItem
          href="/aml-triage"
          icon={Shield}
          label="AML Triage"
          isActive={pathname.startsWith("/aml-triage")}
          collapsed={collapsed}
        />
        <NavItem
          href="/reconciliation"
          icon={Scale}
          label="Reconciliation Tracer"
          isActive={pathname.startsWith("/reconciliation")}
          collapsed={collapsed}
        />

        <NavDivider collapsed={collapsed} />

        {/* COMPLIANCE Section */}
        {!collapsed && <NavSectionHeader label="Compliance" collapsed={collapsed} />}
        <NavItem
          href="/workflows"
          icon={GitBranch}
          label="Compliance Workflows"
          isActive={pathname.startsWith("/workflows")}
          collapsed={collapsed}
        />
        <NavItem
          href="/playbooks"
          icon={BookOpen}
          label="Compliance Playbooks"
          isActive={pathname.startsWith("/playbooks")}
          collapsed={collapsed}
        />
        <NavItem
          href="/policy-vault"
          icon={Landmark}
          label="Policy Vault"
          isActive={pathname.startsWith("/policy-vault")}
          collapsed={collapsed}
        />

        <NavDivider collapsed={collapsed} />

        {/* REPORTING Section */}
        {!collapsed && <NavSectionHeader label="Reporting" collapsed={collapsed} />}
        <NavItem
          href="/reports"
          icon={FileSearch}
          label="Compliance Reports"
          isActive={pathname.startsWith("/reports")}
          collapsed={collapsed}
        />
        <NavItem
          href="/audit-trail"
          icon={Search}
          label="Audit Trail"
          isActive={pathname.startsWith("/audit-trail")}
          collapsed={collapsed}
        />

        <NavDivider collapsed={collapsed} />

        {/* SETTINGS Section */}
        {!collapsed && <NavSectionHeader label="Settings" collapsed={collapsed} />}
        <NavItem
          href="/integrations"
          icon={Plug}
          label="Integrations"
          isActive={pathname.startsWith("/integrations")}
          collapsed={collapsed}
        />
        <NavItem
          href="/team"
          icon={Users}
          label="Team"
          isActive={pathname.startsWith("/team")}
          collapsed={collapsed}
        />
        <NavItem
          href="/settings"
          icon={Settings}
          label="Organization Settings"
          isActive={pathname === "/settings"}
          collapsed={collapsed}
        />
      </nav>

      {/* Account */}
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
