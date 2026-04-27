"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Building2,
  User,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  Flag,
  Globe,
  Percent,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UBOPerson {
  name: string;
  nationality?: string;
  dateOfBirth?: string;
  ownershipPercentage: number;
  ownershipType: "direct" | "indirect";
  ownershipPath: string;
  sanctionsHit: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface CompanyNode {
  name: string;
  registrationNumber?: string;
  jurisdiction?: string;
  ownershipPercentage?: number;
  owners: (CompanyNode | UBOPerson)[];
}

export type OwnershipNode = CompanyNode | UBOPerson;

interface OwnershipTreeProps {
  data: CompanyNode;
  onNodeClick?: (node: OwnershipNode) => void;
  maxDepth?: number;
}

// ─── Risk Color Mapping ────────────────────────────────────────────────────────

const RISK_COLORS = {
  low: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    icon: "text-green-500",
  },
  medium: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    icon: "text-yellow-500",
  },
  high: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-400",
    icon: "text-orange-500",
  },
  critical: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: "text-red-500",
  },
};

// ─── Type Guards ───────────────────────────────────────────────────────────────

function isCompany(node: OwnershipNode): node is CompanyNode {
  return "owners" in node;
}

function isPerson(node: OwnershipNode): node is UBOPerson {
  return "ownershipType" in node;
}

// ─── Tree Node Component ───────────────────────────────────────────────────────

interface TreeNodeProps {
  node: OwnershipNode;
  depth: number;
  isLast: boolean;
  parentHasSiblings: boolean;
  onClick: (node: OwnershipNode) => void;
  maxDepth: number;
}

function TreeNode({
  node,
  depth,
  isLast,
  parentHasSiblings,
  onClick,
  maxDepth,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const company = isCompany(node);
  const person = isPerson(node);

  const hasChildren = company && node.owners.length > 0;
  const showChildren = hasChildren && expanded && depth < maxDepth;

  const riskLevel = person ? node.riskLevel : "low";
  const colors = RISK_COLORS[riskLevel];

  const nodeContent = (
    <div
      className={cn(
        "relative inline-flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.02]",
        colors.bg,
        colors.border,
        company ? "min-w-[280px]" : "min-w-[240px]"
      )}
      onClick={() => onClick(node)}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
          "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
        )}
      >
        {company ? (
          <Building2 className="w-5 h-5 text-[var(--accent)]" />
        ) : (
          <User className="w-5 h-5 text-[var(--fg-muted)]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--fg-primary)] truncate">
            {node.name}
          </span>
          {person && node.sanctionsHit && (
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--fg-muted)]">
          {company && node.jurisdiction && (
            <>
              <Globe className="w-3 h-3" />
              <span>{node.jurisdiction}</span>
            </>
          )}
          {person && node.nationality && (
            <>
              <Flag className="w-3 h-3" />
              <span>{node.nationality}</span>
            </>
          )}
        </div>

        {/* Ownership % */}
        {node.ownershipPercentage !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            <Percent className="w-3 h-3 text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--accent)]">
              {node.ownershipPercentage}%
            </span>
            {person && (
              <span className="text-xs text-[var(--fg-muted)]">
                ({node.ownershipType})
              </span>
            )}
          </div>
        )}

        {/* Risk Badge */}
        {person && (
          <div
            className={cn(
              "inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium",
              colors.bg,
              colors.text
            )}
          >
            {node.riskLevel === "critical" && (
              <Shield className="w-3 h-3" />
            )}
            <span className="capitalize">{node.riskLevel} Risk</span>
          </div>
        )}
      </div>

      {/* Expand/Collapse */}
      {hasChildren && depth < maxDepth && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="shrink-0 p-1 rounded-md hover:bg-[var(--bg-overlay)] transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--fg-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--fg-muted)]" />
          )}
        </button>
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Vertical connector line from parent */}
      {depth > 0 && (
        <div
          className={cn(
            "absolute -left-8 top-1/2 w-8 h-[2px] bg-[var(--border-default)]",
            parentHasSiblings && "h-[2px]"
          )}
        />
      )}

      {/* Node */}
      <div className="relative z-10">{nodeContent}</div>

      {/* Children */}
      {showChildren && (
        <div className="relative mt-8 ml-12">
          {/* Vertical line down from parent */}
          <div className="absolute -left-8 -top-8 w-[2px] h-8 bg-[var(--border-default)]" />

          {/* Horizontal line for children */}
          <div
            className={cn(
              "absolute -left-8 top-0 w-[2px] bg-[var(--border-default)]",
              node.owners.length > 1 && "h-full"
            )}
          />

          <div className="space-y-6">
            {node.owners.map((child, index) => (
              <div key={index} className="relative">
                {/* Vertical line for each child */}
                <div
                  className={cn(
                    "absolute -left-8 top-1/2 w-[2px] bg-[var(--border-default)]",
                    index === 0 && "h-1/2 top-0",
                    index === node.owners.length - 1 && "h-1/2 top-0",
                    index !== 0 &&
                      index !== node.owners.length - 1 &&
                      "h-full -top-1/2"
                  )}
                />

                <TreeNode
                  node={child}
                  depth={depth + 1}
                  isLast={index === node.owners.length - 1}
                  parentHasSiblings={node.owners.length > 1}
                  onClick={onClick}
                  maxDepth={maxDepth}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function OwnershipTree({
  data,
  onNodeClick,
  maxDepth = 10,
}: OwnershipTreeProps) {
  const handleNodeClick = (node: OwnershipNode) => {
    onNodeClick?.(node);
  };

  return (
    <div className="p-6 overflow-x-auto">
      <div className="min-w-max">
        <TreeNode
          node={data}
          depth={0}
          isLast={true}
          parentHasSiblings={false}
          onClick={handleNodeClick}
          maxDepth={maxDepth}
        />
      </div>
    </div>
  );
}

// ─── Example Data ─────────────────────────────────────────────────────────────

export const exampleOwnershipTree: CompanyNode = {
  name: "Global Holdings Inc.",
  registrationNumber: "US123456789",
  jurisdiction: "Delaware, USA",
  ownershipPercentage: 100,
  owners: [
    {
      name: "Alpha Trust",
      registrationNumber: "TRUST-001",
      jurisdiction: "Cayman Islands",
      ownershipPercentage: 60,
      owners: [
        {
          name: "John Smith",
          nationality: "Russian",
          dateOfBirth: "1975-03-15",
          ownershipPercentage: 25,
          ownershipType: "indirect",
          ownershipPath: "Global Holdings → Alpha Trust → John Smith",
          sanctionsHit: true,
          riskLevel: "critical",
        },
        {
          name: "Jane Doe",
          nationality: "British",
          dateOfBirth: "1980-07-22",
          ownershipPercentage: 35,
          ownershipType: "indirect",
          ownershipPath: "Global Holdings → Alpha Trust → Jane Doe",
          sanctionsHit: false,
          riskLevel: "low",
        },
      ],
    },
    {
      name: "Beta Holding Corp",
      registrationNumber: "HK987654321",
      jurisdiction: "Hong Kong",
      ownershipPercentage: 40,
      owners: [
        {
          name: "David Chen",
          nationality: "Chinese",
          dateOfBirth: "1968-11-30",
          ownershipPercentage: 50,
          ownershipType: "indirect",
          ownershipPath: "Global Holdings → Beta Holding → David Chen",
          sanctionsHit: false,
          riskLevel: "medium",
        },
        {
          name: "Sarah Johnson",
          nationality: "American",
          dateOfBirth: "1972-09-08",
          ownershipPercentage: 50,
          ownershipType: "indirect",
          ownershipPath: "Global Holdings → Beta Holding → Sarah Johnson",
          sanctionsHit: false,
          riskLevel: "low",
        },
      ],
    },
  ],
};

export default OwnershipTree;
