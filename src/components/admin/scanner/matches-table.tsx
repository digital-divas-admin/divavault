"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/admin/scanner/confidence-badge";
import { MatchStatusBadge } from "@/components/admin/scanner/match-status-badge";
import { ChevronLeft, ChevronRight, Bot } from "lucide-react";
import type { MatchListItem } from "@/lib/scanner-admin-queries";

interface MatchesTableProps {
  matches: MatchListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const confidenceOptions = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusOptions = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
];

function truncateUrl(url: string, maxLen = 40): string {
  if (!url) return "-";
  try {
    const u = new URL(url);
    const path = u.hostname + u.pathname;
    return path.length > maxLen ? path.slice(0, maxLen) + "..." : path;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + "..." : url;
  }
}

export function MatchesTable({ matches, total, page, pageSize }: MatchesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeConfidence = searchParams.get("confidence") || "all";
  const activeStatus = searchParams.get("status") || "all";
  const activeAi = searchParams.get("ai") === "true";
  const totalPages = Math.ceil(total / pageSize);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    startTransition(() => {
      router.push(`/admin/scanner/matches?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex gap-1 items-center">
          <span className="text-xs text-muted-foreground mr-1">Confidence:</span>
          {confidenceOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={activeConfidence === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ confidence: opt.value, page: "1" })}
              disabled={isPending}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-xs text-muted-foreground mr-1">Status:</span>
          {statusOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={activeStatus === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ status: opt.value, page: "1" })}
              disabled={isPending}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <Button
          variant={activeAi ? "default" : "outline"}
          size="sm"
          onClick={() => updateParams({ ai: activeAi ? "" : "true", page: "1" })}
          disabled={isPending}
        >
          <Bot className="h-3.5 w-3.5 mr-1" />
          AI Only
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/30 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contributor</TableHead>
              <TableHead>Source URL</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Similarity</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>AI</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No matches found
                </TableCell>
              </TableRow>
            ) : (
              matches.map((m) => (
                <TableRow key={m.id} className="cursor-pointer hover:bg-accent/30">
                  <TableCell>
                    <Link
                      href={`/admin/scanner/matches/${m.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {m.contributor_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    <span title={m.source_url}>{truncateUrl(m.source_url)}</span>
                  </TableCell>
                  <TableCell className="text-sm">{m.platform || "-"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {(m.similarity_score * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <ConfidenceBadge confidence={m.confidence_tier} />
                  </TableCell>
                  <TableCell>
                    {m.is_ai_generated ? (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                        <Bot className="h-3 w-3 mr-0.5" />
                        AI
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <MatchStatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
