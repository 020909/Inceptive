"use client";

import React from "react";
import {
  X,
  Check,
  AlertCircle,
  User,
  Building,
  Shield,
  AlertTriangle,
  Clock,
  FileText,
  RefreshCw,
  TreePine,
  Percent,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Types ───────────────────────────────────────────────────────────────────

type ApprovalStatus = "pending" | "approved" | "rejected";
type ApprovalItemType = "ubo_extraction" | "document" | "compliance_check" | "risk_assessment";
type Priority = "high" | "medium" | "low";

interface ApprovalQueueItem {
  id: string;
  org_id: string;
  item_type: ApprovalItemType;
  item_id: string;
  status: ApprovalStatus;
  priority: Priority;
  requested_by: string;
  requester?: {
    email: string;
  } | null;
  created_at: string;
  updated_at: string;
  metadata?: {
    subject_name?: string;
    confidence?: number;
    extraction_data?: Record<string, unknown>;
  } | null;
}

interface BeneficialOwner {
  name: string;
  ownership_percentage: number;
  address?: string;
  sanctions_match?: boolean;
}

interface SanctionsMatch {
  name: string;
  list: string;
  confidence: number;
}

interface UBOExtractionDetail {
  id: string;
  case_id: string;
  status: string;
  confidence: number;
  extracted_data: {
    beneficial_owners?: BeneficialOwner[];
    ownership_tree?: Record<string, unknown>;
    sanctions_matches?: SanctionsMatch[];
  };
  created_at: string;
  case?: {
    subject_name: string;
    subject_address?: string;
  };
}

interface ApprovalItemDetailProps {
  item: ApprovalQueueItem | null;
  detailData: UBOExtractionDetail | null;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  actionLoading?: boolean;
}

// ─── Helper Components ─────────────────────────────────────────────────────

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  let color = "bg-emerald-500";
  let label = "High";
  
  if (confidence < 0.5) {
    color = "bg-red-500";
    label = "Low";
  } else if (confidence < 0.75) {
    color = "bg-amber-500";
    label = "Medium";
  }
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[var(--bg-overlay)] rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${confidence * 100}%` }}
        />
      </div>
      <span className="text-sm font-medium text-[var(--fg-secondary)] min-w-[60px]">
        {label} ({Math.round(confidence * 100)}%)
      </span>
    </div>
  );
}

function BeneficialOwnerCard({ owner, index }: { owner: BeneficialOwner; index: number }) {
  return (
    <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-surface)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
              <User className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <h4 className="font-medium text-[var(--fg-primary)]">{owner.name}</h4>
          </div>
          
          {owner.address && (
            <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)] mb-2">
              <MapPin className="h-3.5 w-3.5" />
              <span>{owner.address}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Badge
              variant={owner.ownership_percentage >= 25 ? "positive" : "default"}
              className="text-xs"
            >
              <Percent className="h-3 w-3 mr-1" />
              {owner.ownership_percentage}%
            </Badge>
            
            {owner.sanctions_match && (
              <Badge
                variant="outline"
                className="text-xs border-red-200 text-red-600"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Sanctions Match
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SanctionsMatchCard({ match }: { match: SanctionsMatch }) {
  return (
    <div className="p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/10">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="h-4 w-4 text-red-500" />
        <span className="font-medium text-red-700 dark:text-red-400">{match.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--fg-muted)]">{match.list}</span>
        <Badge variant="outline" className="text-xs">
          {Math.round(match.confidence * 100)}% match
        </Badge>
      </div>
    </div>
  );
}

function OwnershipTreeNode({
  node,
  level = 0,
}: {
  node: Record<string, unknown>;
  level?: number;
}) {
  const name = node.name as string || "Unknown";
  const percentage = node.ownership_percentage as number;
  const children = node.children as Record<string, unknown>[] || [];
  
  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-3 p-3 border border-[var(--border-default)] rounded-lg",
          level === 0 ? "bg-[var(--bg-elevated)]" : "bg-[var(--bg-surface)]"
        )}
        style={{ marginLeft: level * 24 }}
      >
        <div className="h-8 w-8 rounded-full bg-[var(--bg-overlay)] flex items-center justify-center">
          {level === 0 ? (
            <Building className="h-4 w-4 text-[var(--fg-secondary)]" />
          ) : (
            <User className="h-4 w-4 text-[var(--fg-secondary)]" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium text-[var(--fg-primary)]">{name}</p>
          {percentage !== undefined && (
            <p className="text-sm text-[var(--fg-muted)]">{percentage}% ownership</p>
          )}
        </div>
      </div>
      
      {children.length > 0 && (
        <div className="mt-2">
          {children.map((child, i) => (
            <div key={i} className="relative">
              {level === 0 && (
                <div className="absolute left-[15px] top-[-8px] w-px h-[20px] bg-[var(--border-default)]" />
              )}
              <div className="absolute left-[15px] top-[16px] w-[24px] h-px bg-[var(--border-default)]" />
              <OwnershipTreeNode node={child} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ApprovalItemDetail({
  item,
  detailData,
  loading,
  open,
  onClose,
  onApprove,
  onReject,
  actionLoading = false,
}: ApprovalItemDetailProps) {
  const isMobile = useIsMobile();
  
  if (!item) return null;

  const isPending = item.status === "pending";
  
  // Calculate risk level based on confidence and sanctions matches
  const riskLevel = React.useMemo(() => {
    if (!detailData) return "unknown";
    
    const hasSanctionsMatches = (detailData.extracted_data?.sanctions_matches?.length || 0) > 0;
    const confidence = detailData.confidence || 0;
    
    if (hasSanctionsMatches || confidence < 0.5) return "high";
    if (confidence < 0.75) return "medium";
    return "low";
  }, [detailData]);

  const riskColor = {
    high: "text-red-600 bg-red-50 border-red-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    low: "text-emerald-600 bg-emerald-50 border-emerald-200",
    unknown: "text-gray-600 bg-gray-50 border-gray-200",
  }[riskLevel];

  const content = (
    <>
      {/* Header */}
      <div className="border-b border-[var(--border-default)] pb-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant={item.priority === "high" ? "outline" : "default"}
                className={cn(
                  "text-xs uppercase",
                  item.priority === "high" && "border-red-200 text-red-600"
                )}
              >
                {item.priority} Priority
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  item.status === "pending" && "border-amber-200 text-amber-600",
                  item.status === "approved" && "border-emerald-200 text-emerald-600",
                  item.status === "rejected" && "border-red-200 text-red-600"
                )}
              >
                {item.status}
              </Badge>
            </div>
            
            <h2 className="text-xl font-semibold text-[var(--fg-primary)] mb-2">
              {item.metadata?.subject_name || detailData?.case?.subject_name || "UBO Extraction Review"}
            </h2>
            
            {detailData?.case?.subject_address && (
              <p className="text-sm text-[var(--fg-muted)] flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {detailData.case.subject_address}
              </p>
            )}
          </div>
          
          {/* Risk Badge */}
          <div
            className={cn(
              "px-3 py-2 rounded-lg border text-sm font-medium",
              riskColor
            )}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : detailData ? (
        <div className="space-y-6">
          {/* Confidence Section */}
          <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-surface)]">
            <h3 className="text-sm font-medium text-[var(--fg-secondary)] mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Extraction Confidence
            </h3>
            <ConfidenceIndicator confidence={detailData.confidence} />
          </div>

          {/* Beneficial Owners Section */}
          {detailData.extracted_data?.beneficial_owners &&
            detailData.extracted_data.beneficial_owners.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--fg-secondary)] mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Beneficial Owners ({detailData.extracted_data.beneficial_owners.length})
              </h3>
              <div className="space-y-3">
                {detailData.extracted_data.beneficial_owners.map((owner, index) => (
                  <BeneficialOwnerCard key={index} owner={owner} index={index} />
                ))}
              </div>
            </div>
          )}

          {/* Ownership Tree Section */}
          {detailData.extracted_data?.ownership_tree && (
            <div>
              <h3 className="text-sm font-medium text-[var(--fg-secondary)] mb-3 flex items-center gap-2">
                <TreePine className="h-4 w-4" />
                Ownership Structure
              </h3>
              <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-surface)] overflow-x-auto">
                <OwnershipTreeNode node={detailData.extracted_data.ownership_tree} />
              </div>
            </div>
          )}

          {/* Sanctions Matches Section */}
          {detailData.extracted_data?.sanctions_matches &&
            detailData.extracted_data.sanctions_matches.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Sanctions Matches ({detailData.extracted_data.sanctions_matches.length})
              </h3>
              <div className="space-y-2">
                {detailData.extracted_data.sanctions_matches.map((match, index) => (
                  <SanctionsMatchCard key={index} match={match} />
                ))}
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <div className="p-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-surface)]">
            <h3 className="text-sm font-medium text-[var(--fg-secondary)] mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Request Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--fg-muted)]">Requested By</span>
                <p className="text-[var(--fg-primary)]">
                  {item.requester?.email || "System"}
                </p>
              </div>
              <div>
                <span className="text-[var(--fg-muted)]">Created At</span>
                <p className="text-[var(--fg-primary)]">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-[var(--fg-muted)]">Item ID</span>
                <p className="text-[var(--fg-primary)] font-mono text-xs">
                  {item.item_id}
                </p>
              </div>
              <div>
                <span className="text-[var(--fg-muted)]">Case ID</span>
                <p className="text-[var(--fg-primary)] font-mono text-xs">
                  {detailData.case_id}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-[var(--fg-muted)]" />
          <p className="text-[var(--fg-muted)]">
            Unable to load extraction details.
          </p>
        </div>
      )}

      {/* Footer Actions */}
      {isPending && (
        <div className="border-t border-[var(--border-default)] pt-6 mt-6">
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onReject}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
            <Button
              onClick={onApprove}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  // Use Sheet for mobile, Dialog for desktop
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Approval Item Details</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Approval Item Details</DialogTitle>
          <DialogDescription className="sr-only">
            Review and approve or reject this item
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
