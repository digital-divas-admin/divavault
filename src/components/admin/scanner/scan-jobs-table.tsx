"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScanStatusBadge } from "@/components/admin/scanner/scan-status-badge";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import type { ScanJobListItem } from "@/lib/scanner-admin-queries";

interface ScanJobsTableProps {
  jobs: ScanJobListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const statusOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function ScanJobsTable({ jobs, total, page, pageSize }: ScanJobsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeStatus = searchParams.get("status") || "all";
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
      router.push(`/admin/scanner/jobs?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
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

      {/* Table */}
      <div className="rounded-lg border border-border/30 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contributor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Images</TableHead>
              <TableHead className="text-right">Matches</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No scan jobs found
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    {job.contributor_name || (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{job.scan_type}</TableCell>
                  <TableCell>
                    <ScanStatusBadge status={job.status} />
                    {job.status === "failed" && job.error_message && (
                      <div className="flex items-start gap-1 mt-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{job.error_message}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{job.images_processed}</TableCell>
                  <TableCell className="text-right">{job.matches_found}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDuration(job.started_at, job.completed_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(job.created_at).toLocaleDateString()}
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
