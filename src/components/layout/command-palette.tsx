"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutGrid,
  Shield,
  FileText,
  Building2,
  Scale,
  ListChecks,
  FolderOpen,
  Landmark,
  ScrollText,
  Settings,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { group: "Dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { group: "Compliance", label: "UBO / KYB", href: "/ubo", icon: Search },
  { group: "Compliance", label: "AML Triage", href: "/aml-triage", icon: Shield },
  { group: "Compliance", label: "SAR Drafter", href: "/sar-drafter", icon: FileText },
  { group: "Compliance", label: "Vendor Analyst", href: "/vendor-analyst", icon: Building2 },
  { group: "Compliance", label: "Reconciliation", href: "/reconciliation", icon: Scale },
  { group: "Operations", label: "Approval Queue", href: "/approval-queue", icon: ListChecks },
  { group: "Operations", label: "Case Manager", href: "/cases", icon: FolderOpen },
  { group: "Operations", label: "Policy Vault", href: "/policy-vault", icon: Landmark },
  { group: "System", label: "Audit Trail", href: "/audit-trail", icon: ScrollText },
  { group: "System", label: "Settings", href: "/settings", icon: Settings },
];

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const isMeta = e.metaKey || e.ctrlKey;
      if (isK && isMeta) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    open,
    setOpen,
  };
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const groups = React.useMemo(() => {
    const out = new Map<string, NavItem[]>();
    for (const item of NAV_ITEMS) {
      out.set(item.group, [...(out.get(item.group) || []), item]);
    }
    return Array.from(out.entries());
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[500] transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/60",
          "backdrop-blur-[2px]"
        )}
        onClick={() => onOpenChange(false)}
      />

      <div className="absolute left-1/2 top-[10%] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2">
        <Command
          className={cn(
            "overflow-hidden rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]",
            "shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
          )}
          value={search}
          onValueChange={setSearch}
        >
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
            <Search className="size-4 text-[var(--fg-muted)]" />
            <Command.Input
              autoFocus
              placeholder="Navigate…"
              className="w-full bg-transparent text-[13px] font-medium text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-muted)]"
            />
            <div className="text-[11px] font-semibold text-[var(--fg-muted)]">ESC</div>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
            <Command.Empty className="px-2 py-6 text-center text-[12px] text-[var(--fg-muted)]">
              No results.
            </Command.Empty>

            {groups.map(([group, items]) => (
              <Command.Group key={group} heading={group} className="mb-2 last:mb-0">
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                  {group}
                </div>
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => {
                        onOpenChange(false);
                        router.push(item.href);
                      }}
                      className={cn(
                        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-[13px] font-semibold",
                        "text-[var(--fg-primary)]",
                        "data-[selected=true]:bg-[var(--surface-container)] data-[selected=true]:text-[var(--fg-primary)]"
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {active ? (
                        <span className="text-[11px] font-semibold text-[var(--fg-muted)]">Current</span>
                      ) : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

