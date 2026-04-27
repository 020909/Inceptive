"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OwnershipTree } from "@/components/compliance/OwnershipTree";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  Percent,
  Flag,
  Calendar,
  Building2,
  FileJson,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeneficialOwner {
  name: string;
  nationality?: string;
  date_of_birth?: string;
  ownership_percentage: number;
  ownership_type: "direct" | "indirect";
  ownership_path: string;
  sanctions_hit: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  sanctions_matches?: {
    name: string;
    list_name: string;
    match_score: number;
  }[];
}

interface UBOAgentResultsProps {
  extraction: {
    beneficial_owners: BeneficialOwner[];
    ownership_tree: any;
    confidence: "high" | "medium" | "low";
    needs_review: boolean;
    notes?: string;
  };
  onExport?: () => void;
}

// ─── Risk Colors ─────────────────────────────────────────────────────────────

const RISK_COLORS = {
  low: "bg-green-500/10 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
};

const CONFIDENCE_COLORS = {
  high: "bg-green-500/10 text-green-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  low: "bg-red-500/10 text-red-400",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function UBOAgentResults({ extraction, onExport }: UBOAgentResultsProps) {
  const owners = extraction.beneficial_owners || [];
  const hasSanctionsHits = owners.some((o) => o.sanctions_hit);
  const criticalOwners = owners.filter((o) => o.risk_level === "critical");

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {extraction.needs_review && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-400">Awaiting Approval</p>
              <p className="text-sm text-yellow-400/80 mt-1">
                This extraction has been flagged for review due to low confidence or potential sanctions matches.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasSanctionsHits && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Sanctions Alert</p>
              <p className="text-sm text-red-400/80 mt-1">
                {criticalOwners.length} beneficial owner(s) matched sanctions lists. Immediate review required.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 bg-[var(--bg-elevated)] border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--fg-muted)]">Total Owners</p>
          <p className="text-2xl font-bold text-[var(--fg-primary)] mt-1">
            {owners.length}
          </p>
        </Card>
        <Card className="p-4 bg-[var(--bg-elevated)] border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--fg-muted)]">Confidence</p>
          <p className={cn("text-2xl font-bold mt-1 capitalize", CONFIDENCE_COLORS[extraction.confidence])}>
            {extraction.confidence}
          </p>
        </Card>
        <Card className="p-4 bg-[var(--bg-elevated)] border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--fg-muted)]">Sanctions Hits</p>
          <p className={cn(
            "text-2xl font-bold mt-1",
            hasSanctionsHits ? "text-red-400" : "text-green-400"
          )}>
            {owners.filter((o) => o.sanctions_hit).length}
          </p>
        </Card>
        <Card className="p-4 bg-[var(--bg-elevated)] border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--fg-muted)]">Critical Risk</p>
          <p className={cn(
            "text-2xl font-bold mt-1",
            criticalOwners.length > 0 ? "text-red-400" : "text-green-400"
          )}>
            {criticalOwners.length}
          </p>
        </Card>
      </div>

      {/* Beneficial Owners Table */}
      <Card className="bg-[var(--bg-elevated)] border-[var(--border-subtle)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--fg-primary)]">
            Beneficial Owners
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onExport}>
              <FileJson className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-overlay)] border-b border-[var(--border-subtle)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  Nationality
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  Ownership
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                  Sanctions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {owners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--fg-muted)]">
                    No beneficial owners extracted
                  </td>
                </tr>
              ) : (
                owners.map((owner, index) => (
                  <tr key={index} className="hover:bg-[var(--bg-overlay)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--fg-primary)]">
                        {owner.name}
                      </p>
                      <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                        {owner.ownership_type === "indirect" && "Indirect ownership"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {owner.nationality ? (
                        <div className="flex items-center gap-1">
                          <Flag className="w-3 h-3 text-[var(--fg-muted)]" />
                          <span className="text-[var(--fg-secondary)]">
                            {owner.nationality}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--fg-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Percent className="w-3 h-3 text-[var(--accent)]" />
                        <span className="font-medium text-[var(--accent)]">
                          {owner.ownership_percentage}%
                        </span>
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] mt-0.5 truncate max-w-[200px]">
                        {owner.ownership_path}
                      </p>
                    </td>
                    <td className="px-4 py-3">
<Badge className={cn("capitalize", RISK_COLORS[owner.risk_level])}>
                      {owner.risk_level}
                    </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {owner.sanctions_hit ? (
                        <div className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Hit</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">Clear</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ownership Tree */}
      {extraction.ownership_tree && (
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-subtle)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h3 className="font-semibold text-[var(--fg-primary)]">
              Ownership Structure
            </h3>
          </div>
          <OwnershipTree data={extraction.ownership_tree} />
        </Card>
      )}

      {/* Notes */}
      {extraction.notes && (
        <Card className="p-4 bg-[var(--bg-elevated)] border-[var(--border-subtle)]">
          <h3 className="font-semibold text-[var(--fg-primary)] mb-2">
            Extraction Notes
          </h3>
          <p className="text-sm text-[var(--fg-secondary)] whitespace-pre-wrap">
            {extraction.notes}
          </p>
        </Card>
      )}
    </div>
  );
}

export default UBOAgentResults;
