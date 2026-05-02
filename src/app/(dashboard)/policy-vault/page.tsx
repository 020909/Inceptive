"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Landmark,
  RefreshCw,
  Plus,
  Search,
  X,
  Eye,
  Bot,
  Loader2,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn, formatTimeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PolicyRow } from "@/types/compliance";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "aml", label: "AML" },
  { value: "kyc", label: "KYC" },
  { value: "sanctions", label: "Sanctions" },
  { value: "general", label: "General" },
  { value: "data_privacy", label: "Data Privacy" },
  { value: "operational", label: "Operational" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "deprecated", label: "Deprecated" },
];

const POLICY_STATUS_COLORS: Record<string, string> = {
  draft: "bg-blue-500",
  active: "bg-emerald-500",
  archived: "bg-slate-500",
  deprecated: "bg-red-500",
};

function escapePostgrest(str: string): string {
  return str.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export default function PolicyVaultPage() {
  const { user, loading: authLoading } = useAuth();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedPolicy, setSelectedPolicy] = useState<PolicyRow | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [searchAnswer, setSearchAnswer] = useState("");
  const [searchCitations, setSearchCitations] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      let query = supabase.from("policies").select("*").order("updated_at", { ascending: false });
      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${escapePostgrest(searchQuery.trim())}%,policy_number.ilike.%${escapePostgrest(searchQuery.trim())}%`);
      }
      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      setPolicies((data || []) as PolicyRow[]);
    } catch (err) {
      console.error("Error fetching policies:", err);
      setError("Failed to load policies.");
    } finally {
      setLoading(false);
    }
  }, [user, categoryFilter, statusFilter, searchQuery]);

  useEffect(() => {
    if (!authLoading && user) void fetchPolicies();
  }, [authLoading, user, fetchPolicies]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/policy-vault", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ title: newTitle, category: newCategory, content: newContent, status: "draft" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Create failed");
      }
      setCreateModalOpen(false);
      setNewTitle("");
      setNewContent("");
      void fetchPolicies();
    } catch (err: any) {
      setError(err.message || "Failed to create policy.");
    } finally {
      setCreating(false);
    }
  };

  const handleSemanticSearch = async () => {
    if (!semanticQuery.trim()) return;
    setSearching(true);
    setSearchAnswer("");
    setSearchCitations([]);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/policy-vault/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ query: semanticQuery }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Search failed");
      }
      const data = await res.json();
      setSearchAnswer(data.answer || "");
      setSearchCitations(data.citations || []);
    } catch (err: any) {
      setError(err.message || "Semantic search failed.");
    } finally {
      setSearching(false);
    }
  };

  if (authLoading) {
    return <div className="flex h-full items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--fg-primary)]">Policy Vault</h1>
            <p className="mt-1 text-base text-[var(--fg-muted)]">Store, manage, and semantically search your compliance policies and SOPs.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setSearchModalOpen(true)} variant="outline" className="h-10 px-4 border-[var(--accent)] text-[var(--accent)]">
              <Bot className="h-4 w-4 mr-2" /> AI Search
            </Button>
            <Button onClick={fetchPolicies} variant="ghost" className="h-10 px-4">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button onClick={() => setCreateModalOpen(true)} className="bg-white text-[#070A0B] hover:bg-[#D0D5D9] rounded-lg px-4 h-10">
              <Plus className="h-4 w-4 mr-2" /> Add Policy
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <Input
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-[var(--fg-muted)] hover:text-[var(--fg-primary)]" />
                </button>
              )}
            </div>
            <Select value={categoryFilter} onValueChange={(v) => v !== null && setCategoryFilter(v)}>
              <SelectTrigger className="w-full lg:w-[180px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => v !== null && setStatusFilter(v)}>
              <SelectTrigger className="w-full lg:w-[160px] h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Policies <span className="ml-2 text-sm text-[var(--fg-muted)] font-normal">({policies.length} total)</span></CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : policies.length === 0 ? (
            <div className="py-12 px-6">
              <EmptyState icon={Landmark} title="No policies" description="Add your first compliance policy to the vault." actionLabel="Add Policy" onAction={() => setCreateModalOpen(true)} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <span className="text-sm font-medium text-[var(--fg-primary)]">{policy.title}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-[var(--fg-muted)]">{policy.policy_number || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{policy.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-secondary)]">v{policy.version}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", POLICY_STATUS_COLORS[policy.status] || "bg-slate-400")} />
                          <span className="text-sm text-[var(--fg-secondary)] capitalize">{policy.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-muted)]">{policy.owner || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[var(--fg-muted)]">{policy.updated_at ? formatTimeAgo(new Date(policy.updated_at)) : "—"}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPolicy(policy)} className="text-[var(--accent)]">
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPolicy} onOpenChange={(open) => setSelectedPolicy(open ? selectedPolicy : null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--fg-muted)]" />
              {selectedPolicy?.title}
              <Badge variant="outline" className="text-xs ml-2">v{selectedPolicy?.version}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-1">Category</div>
                <div className="text-sm text-[var(--fg-primary)]">{selectedPolicy?.category}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3">
                <div className="text-xs label-caps mb-1">Owner</div>
                <div className="text-sm text-[var(--fg-primary)]">{selectedPolicy?.owner || "—"}</div>
              </div>
            </div>
            {selectedPolicy?.tags && selectedPolicy.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedPolicy.tags.map((tag, i) => <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>)}
              </div>
            )}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
              <div className="text-xs label-caps mb-2">Content</div>
              <div className="text-sm leading-relaxed text-[var(--fg-primary)] whitespace-pre-wrap">
                {selectedPolicy?.content || selectedPolicy?.summary || "No content available."}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[var(--accent)]" /> Add Policy
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Title</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. AML Transaction Monitoring Policy" className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]" />
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Category</label>
              <Select value={newCategory} onValueChange={(v) => v !== null && setNewCategory(v)}>
                <SelectTrigger className="w-full h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.filter((o) => o.value !== "all").map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--fg-muted)] mb-2 block">Content</label>
              <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Policy content or SOP text..." className="min-h-[200px] bg-[var(--bg-elevated)] border-[var(--border-default)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || creating} className="bg-white text-[#070A0B]">
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {creating ? "Creating..." : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={searchModalOpen} onOpenChange={setSearchModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--accent)]" /> AI Policy Search
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-3">
              <Input
                value={semanticQuery}
                onChange={(e) => setSemanticQuery(e.target.value)}
                placeholder="Ask a compliance question..."
                className="h-10 bg-[var(--bg-elevated)] border-[var(--border-default)]"
                onKeyDown={(e) => { if (e.key === "Enter") void handleSemanticSearch(); }}
              />
              <Button onClick={handleSemanticSearch} disabled={searching || !semanticQuery.trim()} className="bg-white text-[#070A0B] shrink-0">
                {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>
            {searchAnswer && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
                <div className="text-xs label-caps mb-2">AI Answer</div>
                <div className="text-sm leading-relaxed text-[var(--fg-primary)] whitespace-pre-wrap">{searchAnswer}</div>
              </div>
            )}
            {searchCitations.length > 0 && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4">
                <div className="text-xs label-caps mb-2">Citations</div>
                <div className="space-y-3">
                  {searchCitations.map((c: any, i: number) => (
                    <div key={i} className="border-l-2 border-[var(--accent)] pl-3">
                      <div className="text-xs font-medium text-[var(--fg-primary)]">{c.policy_title}</div>
                      <div className="text-xs text-[var(--fg-muted)] mt-1">{c.excerpt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
