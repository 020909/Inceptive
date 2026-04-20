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
  FolderKanban,
  Sparkles,
  Plug,
  FileText,
  Settings,
  Building2,
  ChevronsUpDown,
  ListChecks,
  BarChart2,
  Plus,
  LogIn,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useChat } from "@/lib/chat-context";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { orgs, currentOrg, loading: orgLoading } = useOrg();
  const { recentChats, loadChat, startNewChat } = useChat();
  const { user, loading: authLoading } = useAuth();

  const handleLoadChat = (chat: any) => {
    loadChat(chat);
    router.push("/agent");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-[var(--border-default)] bg-[var(--bg-sidebar)]">
      <SidebarHeader className="h-16 border-b border-[var(--border-subtle)]">
        <div className="flex h-full items-center gap-3 px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <Link href="/dashboard" className="shrink-0 group-data-[collapsible=icon]:hidden">
            <Image src="/logo.png" alt="Inceptive" width={32} height={32} className="h-8 w-8 object-contain" />
          </Link>
          <span
            className="truncate text-lg font-normal tracking-[0.12em] text-[var(--fg-primary)] group-data-[collapsible=icon]:hidden"
            style={{ fontFamily: "'Libre Baskerville', Georgia, ui-serif, serif", textTransform: 'uppercase' as const }}
          >
            INCEPTIVE
          </span>
          <SidebarTrigger className="ml-auto shrink-0 group-data-[collapsible=icon]:ml-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Workspace Switcher */}
        <SidebarGroup>
          <SidebarGroupContent>
            {orgLoading ? (
              <SidebarMenuButton className="animate-pulse bg-[var(--bg-elevated)]" />
            ) : currentOrg ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="bg-[var(--bg-elevated)] border border-[var(--border-default)]" />}>
                  <div className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)]">
                      <Building2 size={16} className="text-[var(--fg-primary)]" />
                    </div>
                    <div className="flex flex-col items-start truncate group-data-[collapsible=icon]:hidden">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--fg-muted)]">Workspace</span>
                      <span className="truncate text-sm font-medium text-[var(--fg-primary)]">{currentOrg.name}</span>
                    </div>
                    <ChevronsUpDown size={14} className="ml-auto text-[var(--fg-muted)] group-data-[collapsible=icon]:hidden" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="start">
                  <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {orgs.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => router.push(`/org/${org.slug}/dashboard`)}
                      className={cn(
                        "flex items-center justify-between",
                        pathname.startsWith(`/org/${org.slug}`) && "bg-[var(--nav-active-bg)]"
                      )}
                    >
                      <span className="truncate">{org.name}</span>
                      <span className="text-[10px] uppercase text-[var(--fg-muted)]">{org.membership_role}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg" onClick={() => router.push("/org/create")} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] justify-start group-data-[collapsible=icon]:justify-center">
                <Plus size={16} className="group-data-[state=expanded]:mr-2" />
                <span className="group-data-[collapsible=icon]:hidden">Create Workspace</span>
              </SidebarMenuButton>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Workspace Specific Items */}
        {currentOrg && (
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              {[
                { href: `/org/${currentOrg.slug}/workflows`, label: "Workflows", icon: GitBranch },
                { href: `/org/${currentOrg.slug}/workflows/builder`, label: "Workflow Builder", icon: GitBranch },
                { href: `/org/${currentOrg.slug}/activity`, label: "Activity Log", icon: ListChecks },
                { href: `/org/${currentOrg.slug}/analytics`, label: "Analytics", icon: BarChart2 },
                { href: `/org/${currentOrg.slug}/settings`, label: "Governance", icon: Settings },
              ].map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarSeparator />

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon className="size-5" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Recent Chats */}
        {recentChats.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Recent</span>
              <button
                onClick={() => { startNewChat(); router.push("/agent"); }}
                className="p-1 hover:bg-[var(--nav-hover-bg)] rounded"
              >
                <Plus size={12} />
              </button>
            </SidebarGroupLabel>
            <SidebarMenu>
              {recentChats.slice(0, 6).map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    onClick={() => handleLoadChat(chat)}
                    className="truncate"
                  >
                    <span className="truncate">{chat.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-[var(--border-subtle)]">
        {!authLoading && !user ? (
          <SidebarMenuButton asChild variant="outline" className="w-full">
            <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
              <LogIn className="size-4 mr-2" />
              <span className="group-data-[collapsible=icon]:hidden">Sign in</span>
            </Link>
          </SidebarMenuButton>
        ) : (
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            <span className="text-xs text-[var(--fg-muted)]">Agents online</span>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
