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
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AdIntelMatchListItem } from "@/lib/ad-intel-admin-queries";

interface AdIntelMatchesTableProps {
  matches: AdIntelMatchListItem[];
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
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "escalated", label: "Escalated" },
];

const matchTypeOptions = [
  { value: "all", label: "All Types" },
  { value: "stock_to_ad", label: "Stock to Ad" },
  { value: "contributor_to_ad", label: "Contributor to Ad" },
];

function confidenceBadge(tier: string) {
  const styles: Record<string, string> = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <Badge variant="outline" className={styles[tier] || styles.low}>
      {tier}
    </Badge>
  );
}

function reviewStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    confirmed: "bg-green-500/10 text-green-400 border-green-500/20",
    dismissed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    escalated: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={styles[status] || styles.pending}>
      {status}
    </Badge>
  );
}

export function AdIntelMatchesTable({
  matches,
  total,
  page,
  pageSize,
}: AdIntelMatchesTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeConfidence = searchParams.get("confidence") || "all";
  const activeStatus = searchParams.get("status") || "all";
  const activeMatchType = searchParams.get("matchType") || "all";
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
      router.push(`/admin/ad-intel/matches?${params.toString()}`);
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
        <div className="flex gap-1 items-center">
          <span className="text-xs text-muted-foreground mr-1">Type:</span>
          {matchTypeOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={activeMatchType === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ matchType: opt.value, page: "1" })}
              disabled={isPending}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/30 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Match Type</TableHead>
              <TableHead className="text-right">Similarity</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Advertiser</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No matches found
                </TableCell>
              </TableRow>
            ) : (
              matches.map((m) => (
                <TableRow key={m.id} className="cursor-pointer hover:bg-accent/30">
                  <TableCell>
                    <Link
                      href={`/admin/ad-intel/matches/${m.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {m.match_type === "stock_to_ad"
                        ? "Stock to Ad"
                        : "Contributor to Ad"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {(m.similarity_score * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell>{confidenceBadge(m.confidence_tier)}</TableCell>
                  <TableCell className="text-sm">
                    {m.advertiser_name || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.ad_platform || "-"}
                  </TableCell>
                  <TableCell>{reviewStatusBadge(m.review_status)}</TableCell>
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
            Showing {(page - 1) * pageSize + 1}
            &ndash;{Math.min(page * pageSize, total)} of {total}
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
