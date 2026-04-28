"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavUser } from "@/components/blocks/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  SearchIcon,
  ShieldIcon,
  FileTextIcon,
  Building2Icon,
  ScaleIcon,
  ListChecksIcon,
  FolderOpenIcon,
  LandmarkIcon,
  ScrollTextIcon,
  Settings2Icon,
  CircleHelpIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";

type NavLink = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
  dataTour?: string;
  badgeKey?: "pendingApprovals";
};

const navMain: NavLink[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
    match: (p) => p === "/dashboard",
    dataTour: "nav-dashboard",
  },
];

const navCompliance: NavLink[] = [
  {
    title: "UBO / KYB",
    url: "/ubo",
    icon: SearchIcon,
    match: (p) => p.startsWith("/ubo"),
    dataTour: "nav-ubo",
  },
  {
    title: "AML Triage",
    url: "/aml-triage",
    icon: ShieldIcon,
    match: (p) => p.startsWith("/aml-triage"),
  },
  {
    title: "SAR Drafter",
    url: "/sar-drafter",
    icon: FileTextIcon,
    match: (p) => p.startsWith("/sar-drafter"),
  },
  {
    title: "Vendor Analyst",
    url: "/vendor-analyst",
    icon: Building2Icon,
    match: (p) => p.startsWith("/vendor-analyst"),
  },
  {
    title: "Reconciliation",
    url: "/reconciliation",
    icon: ScaleIcon,
    match: (p) => p.startsWith("/reconciliation"),
  },
];

const navOperations: NavLink[] = [
  {
    title: "Approval Queue",
    url: "/approval-queue",
    icon: ListChecksIcon,
    match: (p) => p.startsWith("/approval-queue"),
    dataTour: "nav-approvals",
    badgeKey: "pendingApprovals",
  },
  {
    title: "Case Manager",
    url: "/cases",
    icon: FolderOpenIcon,
    match: (p) => p.startsWith("/cases"),
    dataTour: "nav-cases",
  },
  {
    title: "Policy Vault",
    url: "/policy-vault",
    icon: LandmarkIcon,
    match: (p) => p.startsWith("/policy-vault"),
  },
];

const navSecondary: NavLink[] = [
  {
    title: "Audit Trail",
    url: "/audit-trail",
    icon: ScrollTextIcon,
    match: (p) => p.startsWith("/audit-trail"),
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings2Icon,
    match: (p) => p === "/settings",
  },
];

function usePendingApprovalsCount(userId: string | undefined) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    let mounted = true;
    const supabase = createClient();

    const load = async () => {
      const { count: c } = await supabase
        .from("approval_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (mounted) setCount(c ?? 0);
    };

    void load();

    const channel = supabase
      .channel("sidebar-approval-queue-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_queue" },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}

function NavGroup({
  label,
  items,
  pathname,
  badges,
}: {
  label?: string;
  items: NavLink[];
  pathname: string;
  badges: { pendingApprovals: number };
}) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.match ? item.match(pathname) : pathname === item.url;
            const badgeValue =
              item.badgeKey === "pendingApprovals" && badges.pendingApprovals > 0
                ? badges.pendingApprovals
                : undefined;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                >
                  <Link href={item.url} data-tour={item.dataTour}>
                    <Icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {badgeValue !== undefined ? (
                  <SidebarMenuBadge>{badgeValue}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() || "/";
  const { user, signOut } = useAuth();

  const pendingApprovals = usePendingApprovalsCount(user?.id);
  const badges = React.useMemo(() => ({ pendingApprovals }), [pendingApprovals]);

  const userEmail = user?.email ?? "";
  const userMeta = (user?.user_metadata ?? {}) as {
    full_name?: string;
    avatar_url?: string;
  };
  const displayName =
    userMeta.full_name ||
    (userEmail ? userEmail.split("@")[0] : "User");
  const navUser = {
    name: displayName,
    email: userEmail,
    avatar: userMeta.avatar_url ?? "",
  };

  const handleHelp = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("inceptive:onboarding:open"));
  }, []);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <Image
                  src="/logo.png"
                  alt="Inceptive"
                  width={20}
                  height={20}
                  className="size-5! shrink-0 object-contain dark:invert-0 invert"
                  priority
                />
                <span
                  className="text-base font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-header)" }}
                >
                  INCEPTIVE
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup items={navMain} pathname={pathname} badges={badges} />
        <NavGroup
          label="Compliance"
          items={navCompliance}
          pathname={pathname}
          badges={badges}
        />
        <NavGroup
          label="Operations"
          items={navOperations}
          pathname={pathname}
          badges={badges}
        />

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondary.map((item) => {
                const Icon = item.icon;
                const isActive = item.match ? item.match(pathname) : pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleHelp} tooltip="Get help">
                  <CircleHelpIcon />
                  <span>Get Help</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter data-tour="account-menu">
        <NavUser user={navUser} onSignOut={() => void signOut()} />
      </SidebarFooter>
    </Sidebar>
  );
}
