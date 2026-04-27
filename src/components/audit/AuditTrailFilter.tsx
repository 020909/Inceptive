"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Filter,
  User,
  X,
  ChevronDown,
  Check,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRange = "today" | "7days" | "30days" | "custom";

interface AuditFilter {
  dateRange: DateRange;
  customStartDate?: string;
  customEndDate?: string;
  actionTypes: string[];
  users: string[];
}

interface AuditTrailFilterProps {
  onFilterChange: (filter: AuditFilter) => void;
  users: { id: string; email: string }[];
}

const ACTION_TYPES = [
  { value: "CASE_CREATED", label: "Case Created" },
  { value: "CASE_UPDATED", label: "Case Updated" },
  { value: "DOCUMENT_UPLOADED", label: "Document Uploaded" },
  { value: "DOCUMENT_PARSED", label: "Document Parsed" },
  { value: "AGENT_RUN_STARTED", label: "Agent Started" },
  { value: "AGENT_RUN_COMPLETED", label: "Agent Completed" },
  { value: "UBO_EXTRACTION_COMPLETED", label: "UBO Extraction" },
  { value: "APPROVAL_ITEM_CREATED", label: "Approval Requested" },
  { value: "APPROVAL_ITEM_APPROVED", label: "Item Approved" },
  { value: "APPROVAL_ITEM_REJECTED", label: "Item Rejected" },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function AuditTrailFilter({ onFilterChange, users }: AuditTrailFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<AuditFilter>({
    dateRange: "30days",
    actionTypes: [],
    users: [],
  });

  // ─── Get Active Filter Count ───────────────────────────────────────────────

  const getActiveCount = useCallback(() => {
    let count = 0;
    if (filter.dateRange !== "30days") count++;
    if (filter.actionTypes.length > 0) count++;
    if (filter.users.length > 0) count++;
    return count;
  }, [filter]);

  // ─── Apply Filter ───────────────────────────────────────────────────────────

  const applyFilter = () => {
    onFilterChange(filter);
    setIsOpen(false);
  };

  // ─── Clear Filter ───────────────────────────────────────────────────────────

  const clearFilter = () => {
    const defaultFilter: AuditFilter = {
      dateRange: "30days",
      actionTypes: [],
      users: [],
    };
    setFilter(defaultFilter);
    onFilterChange(defaultFilter);
  };

  // ─── Toggle Action Type ─────────────────────────────────────────────────────

  const toggleActionType = (type: string) => {
    setFilter((prev) => ({
      ...prev,
      actionTypes: prev.actionTypes.includes(type)
        ? prev.actionTypes.filter((t) => t !== type)
        : [...prev.actionTypes, type],
    }));
  };

  // ─── Toggle User ────────────────────────────────────────────────────────────

  const toggleUser = (userId: string) => {
    setFilter((prev) => ({
      ...prev,
      users: prev.users.includes(userId)
        ? prev.users.filter((u) => u !== userId)
        : [...prev.users, userId],
    }));
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const activeCount = getActiveCount();

  return (
    <div className="relative">
      {/* Filter Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative",
          activeCount > 0 && "border-[var(--accent)] text-[var(--accent)]"
        )}
      >
        <Filter className="w-4 h-4 mr-2" />
        Filters
        {activeCount > 0 && (
<Badge className="ml-2 bg-[var(--accent)] text-white px-1.5 py-0 text-xs">
              {activeCount}
            </Badge>
        )}
      </Button>

      {/* Filter Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-[400px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-xl z-50 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--fg-primary)]">
                Filter Audit Trail
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Date Range */}
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--fg-primary)] mb-2 block">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date Range
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "today", label: "Today" },
                  { value: "7days", label: "Last 7 Days" },
                  { value: "30days", label: "Last 30 Days" },
                ].map((range) => (
                  <button
                    key={range.value}
                    onClick={() =>
                      setFilter((prev) => ({
                        ...prev,
                        dateRange: range.value as DateRange,
                      }))
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm transition-colors",
                      filter.dateRange === range.value
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--bg-overlay)] text-[var(--fg-secondary)] hover:bg-[var(--border-default)]"
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Custom Date */}
              {filter.dateRange === "custom" && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="date"
                    value={filter.customStartDate || ""}
                    onChange={(e) =>
                      setFilter((prev) => ({
                        ...prev,
                        customStartDate: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md text-sm text-[var(--fg-primary)]"
                  />
                  <input
                    type="date"
                    value={filter.customEndDate || ""}
                    onChange={(e) =>
                      setFilter((prev) => ({
                        ...prev,
                        customEndDate: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md text-sm text-[var(--fg-primary)]"
                  />
                </div>
              )}
            </div>

            {/* Action Types */}
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--fg-primary)] mb-2 block">
                Action Types
              </label>
              <div className="max-h-[150px] overflow-y-auto space-y-1">
                {ACTION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => toggleActionType(type.value)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      filter.actionTypes.includes(type.value)
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "hover:bg-[var(--bg-overlay)] text-[var(--fg-secondary)]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        filter.actionTypes.includes(type.value)
                          ? "bg-[var(--accent)] border-[var(--accent)]"
                          : "border-[var(--border-default)]"
                      )}
                    >
                      {filter.actionTypes.includes(type.value) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Users */}
            {users.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-medium text-[var(--fg-primary)] mb-2 block">
                  <User className="w-4 h-4 inline mr-2" />
                  Users
                </label>
                <div className="max-h-[120px] overflow-y-auto space-y-1">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                        filter.users.includes(user.id)
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "hover:bg-[var(--bg-overlay)] text-[var(--fg-secondary)]"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                          filter.users.includes(user.id)
                            ? "bg-[var(--accent)] border-[var(--accent)]"
                            : "border-[var(--border-default)]"
                        )}
                      >
                        {filter.users.includes(user.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="truncate">{user.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 pt-4 border-t border-[var(--border-subtle)]">
              <Button
                variant="outline"
                onClick={clearFilter}
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                onClick={applyFilter}
                className="flex-1 bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AuditTrailFilter;
