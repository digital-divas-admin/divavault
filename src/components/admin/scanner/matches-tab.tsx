"use client";

import { useState, useCallback } from "react";
import type { MatchItem } from "@/lib/scanner-command-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Eye,
  Filter,
} from "lucide-react";

interface MatchesTabProps {
  matches: MatchItem[];
  pendingReviewCount: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  new: { label: "New", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  confirmed: {
    label: "Confirmed",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  rejected: {
    label: "Rejected",
    color: "text-zinc-400",
    bg: "bg-zinc-400/10",
  },
  false_positive: {
    label: "False Positive",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
};

const CONFIDENCE_CONFIG: Record<string, { color: string }> = {
  high: { color: "text-green-400" },
  medium: { color: "text-yellow-400" },
  low: { color: "text-zinc-400" },
};

export function MatchesTab({ matches, pendingReviewCount }: MatchesTabProps) {
  const [items, setItems] = useState(matches);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Derive unique platforms from data
  const platforms = Array.from(
    new Set(items.map((m) => m.platform).filter(Boolean))
  ) as string[];

  // Filter items
  const filtered = items.filter((m) => {
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (filterPlatform !== "all" && m.platform !== filterPlatform) return false;
    return true;
  });

  // Status counts
  const statusCounts = items.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const handleStatusChange = useCallback(
    async (matchId: string, newStatus: string) => {
      setUpdatingId(matchId);
      try {
        const res = await fetch("/api/admin/scanner/matches", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: matchId, status: newStatus }),
        });
        if (res.ok) {
          setItems((prev) =>
            prev.map((m) =>
              m.id === matchId ? { ...m, status: newStatus } : m
            )
          );
          if (expandedId === matchId) setExpandedId(null);
        }
      } catch {
        // Silently fail
      } finally {
        setUpdatingId(null);
      }
    },
    [expandedId]
  );

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPlatform !== "all") params.set("platform", filterPlatform);
      params.set("limit", "100");
      const res = await fetch(
        `/api/admin/scanner/matches?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.matches);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPlatform]);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["new", "confirmed", "rejected", "false_positive"] as const).map(
          (status) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <Card key={status} className="border-border/30">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">{cfg.label}</div>
                  <div className={`text-2xl font-bold ${cfg.color}`}>
                    {statusCounts[status] || 0}
                  </div>
                </CardContent>
              </Card>
            );
          }
        )}
        <Card className="border-border/30">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold text-foreground">
              {items.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="false_positive">False Positive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="h-8 text-xs"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          Refresh
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} match{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Match table */}
      <div className="rounded-md border border-border/30 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-card">
              <th className="text-left p-2 font-medium text-muted-foreground">
                Contributor
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                Platform
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                Similarity
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                Confidence
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground">
                Date
              </th>
              <th className="text-right p-2 font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-muted-foreground"
                >
                  No matches found
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const statusCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.new;
                const confCfg =
                  CONFIDENCE_CONFIG[m.confidence_tier || ""] ||
                  CONFIDENCE_CONFIG.low;
                const isExpanded = expandedId === m.id;
                const isUpdating = updatingId === m.id;

                return (
                  <tr
                    key={m.id}
                    className="border-b border-border/20 hover:bg-card/50 transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : m.id)
                    }
                  >
                    <td className="p-2">
                      <span className="font-medium text-foreground">
                        {m.contributor_name || m.contributor_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {m.platform || "?"}
                      </span>
                    </td>
                    <td className="p-2 font-mono">
                      {m.similarity_score
                        ? `${(m.similarity_score * 100).toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className="p-2">
                      <span className={confCfg.color}>
                        {m.confidence_tier || "-"}
                      </span>
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {m.created_at
                        ? new Date(m.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td
                      className="p-2 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.status === "new" && (
                        <div className="flex items-center justify-end gap-1">
                          {isUpdating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-green-400 hover:text-green-300 hover:bg-green-400/10"
                                onClick={() =>
                                  handleStatusChange(m.id, "confirmed")
                                }
                                title="Confirm match"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-400/10"
                                onClick={() =>
                                  handleStatusChange(m.id, "rejected")
                                }
                                title="Reject match"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                onClick={() =>
                                  handleStatusChange(m.id, "false_positive")
                                }
                                title="Mark false positive"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                      {m.status !== "new" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-muted-foreground"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : m.id)
                          }
                          title="View details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded detail panel */}
      {expandedId && (
        <MatchDetailPanel
          match={filtered.find((m) => m.id === expandedId) || null}
          onClose={() => setExpandedId(null)}
          onStatusChange={handleStatusChange}
          isUpdating={updatingId === expandedId}
        />
      )}
    </div>
  );
}

function ImageWithFallback({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800/50 border border-border/30 rounded text-muted-foreground text-[10px] ${className}`}
      >
        No image
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`object-cover rounded border border-border/30 ${className}`}
      onError={() => setError(true)}
    />
  );
}

function MatchDetailPanel({
  match,
  onClose,
  onStatusChange,
  isUpdating,
}: {
  match: MatchItem | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  isUpdating: boolean;
}) {
  if (!match) return null;

  const statusCfg = STATUS_CONFIG[match.status] || STATUS_CONFIG.new;

  return (
    <Card className="border-border/30">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Match Detail</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 text-xs">
            Close
          </Button>
        </div>

        {/* Side-by-side image comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Contributor Photo
            </div>
            <ImageWithFallback
              src={match.contributor_photo_url}
              alt={match.contributor_name || "Contributor"}
              className="w-full aspect-square"
            />
            <div className="text-xs text-center text-foreground font-medium truncate">
              {match.contributor_name || match.contributor_id.slice(0, 12)}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Discovered Image
            </div>
            <ImageWithFallback
              src={match.discovered_image_url}
              alt={match.page_title || "Discovered image"}
              className="w-full aspect-square"
            />
            <div className="text-xs text-center text-muted-foreground truncate">
              {match.platform || "Unknown"} &middot;{" "}
              {match.similarity_score
                ? `${(match.similarity_score * 100).toFixed(1)}% match`
                : ""}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Match info */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Similarity</span>
              <span className="font-mono">
                {match.similarity_score
                  ? `${(match.similarity_score * 100).toFixed(2)}%`
                  : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence</span>
              <span
                className={
                  CONFIDENCE_CONFIG[match.confidence_tier || ""]?.color ||
                  "text-zinc-400"
                }
              >
                {match.confidence_tier || "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color}`}
              >
                {statusCfg.label}
              </span>
            </div>
            {match.is_ai_generated !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI Generated</span>
                <span>
                  {match.is_ai_generated ? "Yes" : "No"}
                  {match.ai_detection_score
                    ? ` (${(match.ai_detection_score * 100).toFixed(0)}%)`
                    : ""}
                </span>
              </div>
            )}
            {match.is_known_account && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Known Account</span>
                <span className="text-green-400">Yes</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>
                {match.created_at
                  ? new Date(match.created_at).toLocaleString()
                  : "-"}
              </span>
            </div>
            {match.page_title && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Title</span>
                <span className="truncate text-right">{match.page_title}</span>
              </div>
            )}
          </div>

          {/* Links and actions */}
          <div className="space-y-3">
            {match.page_url && (
              <a
                href={match.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View source page
              </a>
            )}
            {match.source_url && (
              <a
                href={match.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View original image
              </a>
            )}

            {/* Action buttons */}
            {match.status === "new" && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => onStatusChange(match.id, "confirmed")}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onStatusChange(match.id, "rejected")}
                  disabled={isUpdating}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-400 border-red-400/30 hover:bg-red-400/10"
                  onClick={() => onStatusChange(match.id, "false_positive")}
                  disabled={isUpdating}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  False Positive
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
