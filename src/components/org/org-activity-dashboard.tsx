"use client";

import React, { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  CheckCircle2,
  Search,
  FileSearch,
  FileText,
  ListChecks,
  Mail,
  Shield,
  X,
  XCircle,
  PenSquare,
  UserRoundSearch,
} from "lucide-react";
import { ExportButtons } from "@/components/ExportButtons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFuseSearch } from "@/hooks/useFuseSearch";
import { cn } from "@/lib/utils";
import type {
  ActivityDateRange,
  ActivityFilterGroup,
  AgentActivityActionType,
  AgentActivityLogWithUser,
} from "@/lib/supabase/activity";

interface OrgActivityDashboardProps {
  logs: AgentActivityLogWithUser[];
  orgName: string;
  orgId: string;
  userId: string;
}

const ACTION_GROUP_LABELS: Array<{ value: ActivityFilterGroup; label: string }> = [
  { value: "all", label: "All" },
  { value: "emails", label: "Emails" },
  { value: "research", label: "Research" },
  { value: "content", label: "Content" },
  { value: "tasks", label: "Tasks" },
  { value: "governance", label: "Governance" },
];

const DATE_RANGE_LABELS: Array<{ value: ActivityDateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
];

function getActionIcon(actionType: AgentActivityActionType) {
  switch (actionType) {
    case "email_drafted":
    case "email_sent":
      return Mail;
    case "research_completed":
      return FileSearch;
    case "lead_generated":
      return UserRoundSearch;
    case "report_generated":
      return FileText;
    case "content_created":
      return PenSquare;
    case "task_completed":
      return ListChecks;
    case "approval_requested":
    case "settings_updated":
      return Shield;
    case "approval_approved":
      return CheckCircle2;
    case "approval_rejected":
      return XCircle;
    case "workflow_updated":
      return Activity;
    default:
      return Activity;
  }
}

function getRangeStart(dateRange: ActivityDateRange) {
  const now = new Date();
  if (dateRange === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (dateRange === "this_week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function matchesActionGroup(log: AgentActivityLogWithUser, actionGroup: ActivityFilterGroup) {
  if (actionGroup === "all") return true;
  if (actionGroup === "emails") return log.action_type === "email_drafted" || log.action_type === "email_sent";
  if (actionGroup === "research") {
    return (
      log.action_type === "research_completed" ||
      log.action_type === "lead_generated" ||
      log.action_type === "report_generated"
    );
  }
  if (actionGroup === "content") return log.action_type === "content_created";
  if (actionGroup === "governance") {
    return (
      log.action_type === "approval_requested" ||
      log.action_type === "approval_approved" ||
      log.action_type === "approval_rejected" ||
      log.action_type === "workflow_updated" ||
      log.action_type === "settings_updated"
    );
  }
  return log.action_type === "task_completed";
}

function statusDotClass(status: AgentActivityLogWithUser["status"]) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "failed") return "bg-red-500";
  return "animate-pulse bg-amber-400";
}

function statusLabel(status: AgentActivityLogWithUser["status"]) {
  if (status === "in_progress") return "In Progress";
  return status === "completed" ? "Completed" : "Failed";
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function OrgActivityDashboard({ logs, orgName, orgId, userId }: OrgActivityDashboardProps) {
  const [actionGroup, setActionGroup] = useState<ActivityFilterGroup>("all");
  const [dateRange, setDateRange] = useState<ActivityDateRange>("this_week");
  const { query, setQuery, results } = useFuseSearch(logs, ["title", "description", "action_type"]);

  const visibleLogs = useMemo(() => {
    const start = getRangeStart(dateRange).getTime();
    return results.filter((log) => {
      const createdAt = new Date(log.created_at).getTime();
      return createdAt >= start && matchesActionGroup(log, actionGroup);
    });
  }, [actionGroup, dateRange, results]);

  const stats = useMemo(() => {
    const weekStart = getRangeStart("this_week").getTime();
    const weekLogs = logs.filter((log) => new Date(log.created_at).getTime() >= weekStart);
    const completedTasks = weekLogs.filter(
      (log) => log.status === "completed" && log.action_type === "task_completed"
    ).length;
    const emailsHandled = weekLogs.filter(
      (log) => log.action_type === "email_drafted" || log.action_type === "email_sent"
    ).length;
    const leadsResearched = weekLogs.filter(
      (log) => log.action_type === "lead_generated" || log.action_type === "research_completed"
    ).length;
    const hoursSaved = (completedTasks * 0.5).toFixed(completedTasks % 2 === 0 ? 0 : 1);

    return {
      completedTasks,
      emailsHandled,
      leadsResearched,
      hoursSaved,
    };
  }, [logs]);

  const exportPayloads = useMemo(() => {
    const highlights = logs
      .slice(0, 5)
      .map((log) => log.description?.trim() || log.title)
      .filter(Boolean);

    const agentLog = logs.slice(0, 20).map((log) => ({
      time: new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      action: log.title,
      result: log.description?.trim() || statusLabel(log.status),
    }));

    const activityRows = logs.map((log) => ({
      dateTime: new Date(log.created_at).toLocaleString(),
      actionType: log.action_type,
      title: log.title,
      description: log.description ?? "",
      status: statusLabel(log.status),
      duration: typeof log.metadata?.duration === "string" ? log.metadata.duration : "",
    }));

    return {
      pdfData: {
        date: new Date().toLocaleDateString(),
        orgName,
        stats: {
          tasks: stats.completedTasks,
          emails: stats.emailsHandled,
          leads: stats.leadsResearched,
          hoursSaved: stats.hoursSaved,
        },
        highlights,
        agentLog,
      },
      excelData: activityRows,
    };
  }, [logs, orgName, stats.completedTasks, stats.emailsHandled, stats.hoursSaved, stats.leadsResearched]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="rounded-[32px]">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--fg-primary)]">Export activity reports</p>
            <p className="text-sm text-[var(--fg-muted)]">
              Generate a PDF summary for the morning handoff or download the full activity log as Excel.
            </p>
          </div>
          <ExportButtons
            orgId={orgId}
            userId={userId}
            pdfType="morning_report"
            pdfData={exportPayloads.pdfData}
            excelType="activity"
            excelData={exportPayloads.excelData}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Tasks Completed This Week</CardDescription>
            <CardTitle className="text-3xl">{stats.completedTasks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Emails Handled</CardDescription>
            <CardTitle className="text-3xl">{stats.emailsHandled}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Leads Researched</CardDescription>
            <CardTitle className="text-3xl">{stats.leadsResearched}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Hours Saved</CardDescription>
            <CardTitle className="text-3xl">{stats.hoursSaved}h saved</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="rounded-[32px]">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">Filter By Type</p>
            <Tabs value={actionGroup} onValueChange={(value) => setActionGroup(value as ActivityFilterGroup)}>
              <TabsList>
                {ACTION_GROUP_LABELS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">Date Range</p>
            <Tabs value={dateRange} onValueChange={(value) => setDateRange(value as ActivityDateRange)}>
              <TabsList>
                {DATE_RANGE_LABELS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[32px]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3">
            <Search size={18} className="text-[var(--fg-muted)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search activity by title, description, or action type..."
              className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
            />
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="flex size-7 items-center justify-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-base)] hover:text-[var(--fg-primary)]"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-[var(--fg-muted)]">
            {query.trim()
              ? `Searching "${query}" — ${visibleLogs.length} results found`
              : `${visibleLogs.length} activity results`}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[32px]">
        <CardHeader className="border-b border-[var(--border-subtle)]">
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Every AI action taken inside this workspace, across the team.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {visibleLogs.length === 0 ? (
            <div className="p-6 text-sm text-[var(--fg-muted)]">No activity matches the current filters.</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {visibleLogs.map((log) => {
                const Icon = getActionIcon(log.action_type);
                return (
                  <div key={log.id} className="flex gap-4 px-6 py-5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
                      <Icon size={18} className="text-[var(--fg-primary)]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-medium text-[var(--fg-primary)]">{log.title}</h3>
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <span className={cn("inline-block size-2 rounded-full", statusDotClass(log.status))} />
                              {statusLabel(log.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[var(--fg-muted)]">{log.description}</p>
                        </div>

                        <p className="whitespace-nowrap text-xs uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-xs font-medium text-[var(--fg-primary)]">
                          {initialsFromName(log.user_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--fg-primary)]">{log.user_name}</p>
                          <p className="truncate text-xs text-[var(--fg-muted)]">
                            {log.user_email ?? "AI system action"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
