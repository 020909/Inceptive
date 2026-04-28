"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/ubo": "UBO / KYB",
  "/aml-triage": "AML Triage",
  "/sar-drafter": "SAR Drafter",
  "/vendor-analyst": "Vendor Analyst",
  "/reconciliation": "Reconciliation",
  "/approval-queue": "Approval Queue",
  "/cases": "Case Manager",
  "/policy-vault": "Policy Vault",
  "/audit-trail": "Audit Trail",
  "/settings": "Settings",
  "/upgrade": "Credits & Billing",
  "/email": "Connectors",
  "/agent": "Agent",
};

function deriveTitle(pathname: string): string {
  if (!pathname || pathname === "/") return "Inceptive";

  // Exact match first
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];

  // Match by first segment (e.g. /cases/123 -> "Case Manager")
  const firstSegment = "/" + pathname.split("/").filter(Boolean)[0];
  if (TITLE_MAP[firstSegment]) return TITLE_MAP[firstSegment];

  // Default: titlecase the first segment
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  if (!seg) return "Inceptive";
  return seg
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const title = deriveTitle(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">{title}</h1>
      </div>
    </header>
  );
}
