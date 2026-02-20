"use client";

import { useState } from "react";
import type {
  ScoutDiscovery,
  ScoutRun,
  ScoutKeyword,
} from "@/lib/scanner-command-queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Radar,
  Globe,
  Search,
  CheckCircle2,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  Tag,
  Loader2,
  Clock,
  XCircle,
} from "lucide-react";

interface ScoutTabProps {
  discoveries: ScoutDiscovery[];
  runs: ScoutRun[];
  keywords: ScoutKeyword[];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riskBadge(score: number) {
  if (score >= 0.6)
    return <Badge variant="destructive">{score.toFixed(2)}</Badge>;
  if (score >= 0.3)
    return <Badge variant="warning">{score.toFixed(2)}</Badge>;
  return (
    <Badge variant="secondary">{score.toFixed(2)}</Badge>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge variant="success">Approved</Badge>;
    case "pending":
      return <Badge variant="warning">Pending</Badge>;
    case "dismissed":
      return <Badge variant="destructive">Dismissed</Badge>;
    case "promoted":
      return <Badge variant="primary">Promoted</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function runStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Completed</Badge>;
    case "running":
      return <Badge variant="primary">Running</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function ScoutTab({ discoveries, runs, keywords }: ScoutTabProps) {
  const [localDiscoveries, setLocalDiscoveries] =
    useState<ScoutDiscovery[]>(discoveries);
  const [localKeywords, setLocalKeywords] =
    useState<ScoutKeyword[]>(keywords);
  const [localRuns, setLocalRuns] = useState<ScoutRun[]>(runs);

  // Run scout
  const [runningScout, setRunningScout] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {}
  );

  // Add keyword form
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("risk_indicator");
  const [newWeight, setNewWeight] = useState("1.0");
  const [newUseFor, setNewUseFor] = useState("search");
  const [addingKeyword, setAddingKeyword] = useState(false);

  const pendingCount = localDiscoveries.filter(
    (d) => d.status === "pending"
  ).length;
  const approvedCount = localDiscoveries.filter(
    (d) => d.status === "approved"
  ).length;
  const avgRisk =
    localDiscoveries.length > 0
      ? localDiscoveries.reduce((s, d) => s + d.risk_score, 0) /
        localDiscoveries.length
      : 0;

  async function handleRunScout() {
    setRunningScout(true);
    setRunResult(null);
    setRunError(null);
    try {
      const res = await fetch("/api/admin/scanner/scout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRunError(data.error || "Scout run failed");
      } else {
        setRunResult(
          `Scout run started. ${data.message || "Check runs table for progress."}`
        );
        // Refresh runs
        const runsRes = await fetch("/api/admin/scanner/scout/runs");
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          if (Array.isArray(runsData)) setLocalRuns(runsData);
        }
      }
    } catch {
      setRunError("Failed to reach server");
    } finally {
      setRunningScout(false);
    }
  }

  async function handleApprove(id: string) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/scanner/scout/${id}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        setLocalDiscoveries((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "approved" } : d))
        );
      }
    } catch {
      // silent
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleDismiss(id: string) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/scanner/scout/${id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual dismiss from command center" }),
      });
      if (res.ok) {
        setLocalDiscoveries((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "dismissed" } : d))
        );
      }
    } catch {
      // silent
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleAddKeyword() {
    if (!newKeyword.trim()) return;
    setAddingKeyword(true);
    try {
      const res = await fetch("/api/admin/scanner/scout/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          category: newCategory,
          weight: parseFloat(newWeight) || 1.0,
          use_for: newUseFor,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalKeywords((prev) => [...prev, data]);
        setNewKeyword("");
      }
    } catch {
      // silent
    } finally {
      setAddingKeyword(false);
    }
  }

  async function handleToggleKeyword(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/scanner/scout/keywords/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setLocalKeywords((prev) =>
          prev.map((k) => (k.id === id ? { ...k, enabled } : k))
        );
      }
    } catch {
      // silent
    }
  }

  async function handleDeleteKeyword(id: string) {
    setActionLoading((prev) => ({ ...prev, [`kw-${id}`]: true }));
    try {
      const res = await fetch(`/api/admin/scanner/scout/keywords/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLocalKeywords((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      // silent
    } finally {
      setActionLoading((prev) => ({ ...prev, [`kw-${id}`]: false }));
    }
  }

  // Group keywords by category
  const keywordsByCategory = localKeywords.reduce<
    Record<string, ScoutKeyword[]>
  >((acc, kw) => {
    if (!acc[kw.category]) acc[kw.category] = [];
    acc[kw.category].push(kw);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-purple-500/10">
                <Radar className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-sm font-medium">Total Discoveries</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {localDiscoveries.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Domains found across all sources
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-yellow-500/10">
                <Clock className="h-4 w-4 text-yellow-400" />
              </div>
              <span className="text-sm font-medium">Pending Review</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {pendingCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting admin approval or dismissal
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </div>
              <span className="text-sm font-medium">Approved</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {approvedCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Promoted to active platform monitoring
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="rounded-full p-1.5 bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <span className="text-sm font-medium">Avg Risk Score</span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-mono)]">
              {avgRisk.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across all discovered domains
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discoveries section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            Discoveries
          </h3>
          <div className="flex items-center gap-2">
            {runResult && (
              <span className="text-xs text-green-400">{runResult}</span>
            )}
            {runError && (
              <span className="text-xs text-red-400">{runError}</span>
            )}
            <Button
              size="sm"
              onClick={handleRunScout}
              disabled={runningScout}
              className="h-8"
            >
              {runningScout ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              Run Scout
            </Button>
          </div>
        </div>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            {localDiscoveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No discoveries yet. Run Scout to search for new AI platforms.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/30">
                      <th className="text-left py-2 pr-3 font-medium">
                        Domain
                      </th>
                      <th className="text-left py-2 pr-3 font-medium">Risk</th>
                      <th className="text-left py-2 pr-3 font-medium">
                        Source
                      </th>
                      <th className="text-left py-2 pr-3 font-medium">
                        Description
                      </th>
                      <th className="text-left py-2 pr-3 font-medium">Date</th>
                      <th className="text-left py-2 pr-3 font-medium">
                        Status
                      </th>
                      <th className="text-right py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localDiscoveries.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-border/20 last:border-0"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{d.domain}</p>
                              {d.name && (
                                <p className="text-xs text-muted-foreground">
                                  {d.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {riskBadge(d.risk_score)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <Search className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {d.source}
                            </span>
                          </div>
                          {d.source_query && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate max-w-[120px]">
                              {d.source_query}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {d.description || "--"}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(d.discovered_at)}
                        </td>
                        <td className="py-2.5 pr-3">
                          {statusBadge(d.status)}
                        </td>
                        <td className="py-2.5 text-right">
                          {d.status === "pending" && (
                            <div className="flex items-center gap-1.5 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleApprove(d.id)}
                                disabled={actionLoading[d.id]}
                              >
                                {actionLoading[d.id] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleDismiss(d.id)}
                                disabled={actionLoading[d.id]}
                              >
                                {actionLoading[d.id] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <XCircle className="h-3 w-3 mr-1 text-red-400" />
                                )}
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Keywords management */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Scout Keywords
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4 space-y-4">
            {/* Add keyword form */}
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Keyword</label>
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="e.g. deepfake generator"
                  className="w-48 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk_indicator">Risk Indicator</SelectItem>
                    <SelectItem value="platform_type">Platform Type</SelectItem>
                    <SelectItem value="content_type">Content Type</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Weight</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="w-20 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Use For</label>
                <Select value={newUseFor} onValueChange={setNewUseFor}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="search">Search</SelectItem>
                    <SelectItem value="assess">Assess</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handleAddKeyword}
                disabled={addingKeyword || !newKeyword.trim()}
                className="h-9"
              >
                {addingKeyword ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                )}
                Add
              </Button>
            </div>

            {/* Keywords table grouped by category */}
            {Object.keys(keywordsByCategory).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No keywords configured. Add keywords to improve scout searches.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(keywordsByCategory).map(
                  ([category, catKeywords]) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {category.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          ({catKeywords.length})
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b border-border/30">
                              <th className="text-left py-1.5 pr-3 font-medium">
                                Keyword
                              </th>
                              <th className="text-left py-1.5 pr-3 font-medium">
                                Weight
                              </th>
                              <th className="text-left py-1.5 pr-3 font-medium">
                                Use For
                              </th>
                              <th className="text-left py-1.5 pr-3 font-medium">
                                Enabled
                              </th>
                              <th className="text-right py-1.5 font-medium">
                                Delete
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {catKeywords.map((kw) => (
                              <tr
                                key={kw.id}
                                className="border-b border-border/20 last:border-0"
                              >
                                <td className="py-2 pr-3 font-medium text-sm">
                                  {kw.keyword}
                                </td>
                                <td className="py-2 pr-3 font-[family-name:var(--font-mono)] text-xs">
                                  {kw.weight.toFixed(1)}
                                </td>
                                <td className="py-2 pr-3">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {kw.use_for}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-3">
                                  <Switch
                                    checked={kw.enabled}
                                    onCheckedChange={(checked) =>
                                      handleToggleKeyword(kw.id, checked)
                                    }
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleDeleteKeyword(kw.id)}
                                    disabled={actionLoading[`kw-${kw.id}`]}
                                  >
                                    {actionLoading[`kw-${kw.id}`] ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
                                    )}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent runs */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-3">
          Recent Runs
        </h3>
        <Card className="bg-card border-border/30">
          <CardContent className="p-4">
            {localRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No scout runs recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/30">
                      <th className="text-left py-2 pr-3 font-medium">
                        Source
                      </th>
                      <th className="text-left py-2 pr-3 font-medium">Time</th>
                      <th className="text-left py-2 pr-3 font-medium">
                        Domains Found
                      </th>
                      <th className="text-left py-2 pr-3 font-medium">New</th>
                      <th className="text-left py-2 pr-3 font-medium">
                        Status
                      </th>
                      <th className="text-left py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="border-b border-border/20 last:border-0"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <Search className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{run.source}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(run.started_at)}
                        </td>
                        <td className="py-2.5 pr-3 font-[family-name:var(--font-mono)]">
                          {run.domains_found}
                        </td>
                        <td className="py-2.5 pr-3 font-[family-name:var(--font-mono)]">
                          <span className="text-green-400">
                            +{run.domains_new}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          {runStatusBadge(run.status)}
                        </td>
                        <td className="py-2.5">
                          {run.error_message ? (
                            <p className="text-xs text-red-400 truncate max-w-[200px]">
                              {run.error_message}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              --
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
