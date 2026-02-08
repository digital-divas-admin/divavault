"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EarningsStatusBadge } from "@/components/admin/earnings-status-badge";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { EarningListItem } from "@/lib/admin-queries";

interface PayoutTableProps {
  earnings: EarningListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const statusTabs = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "held", label: "Held" },
];

export function PayoutTable({ earnings, total, page, pageSize }: PayoutTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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
      router.push(`/admin/payouts?${params.toString()}`);
    });
  }

  async function handleStatusChange(earningId: string, newStatus: string) {
    setUpdatingId(earningId);
    try {
      const res = await fetch(`/api/admin/payouts/${earningId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to update:", data.error);
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to update earning status:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeStatus === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => updateParams({ status: tab.value, page: "1" })}
            disabled={isPending}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/30 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contributor</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {earnings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No earnings found
                </TableCell>
              </TableRow>
            ) : (
              earnings.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link
                      href={`/admin/users/${e.contributor_id}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {e.contributor_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{e.contributor_email}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {e.description || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${(e.amount_cents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <EarningsStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {updatingId === e.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Select
                        value={e.status}
                        onValueChange={(val) => handleStatusChange(e.id, val)}
                      >
                        <SelectTrigger className="h-8 w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="held">Held</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
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
