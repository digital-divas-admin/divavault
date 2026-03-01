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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VerificationStatusBadge } from "@/components/admin/verification-status-badge";
import { Search, ChevronLeft, ChevronRight, AlertTriangle, Ban } from "lucide-react";
import type { ContributorListItem } from "@/lib/admin-queries";

interface UserTableProps {
  contributors: ContributorListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const verificationOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "green", label: "Verified" },
  { value: "red", label: "Rejected" },
  { value: "retry", label: "Retry" },
];

export function UserTable({ contributors, total, page, pageSize }: UserTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const activeFilter = searchParams.get("verification") || "all";

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
      router.push(`/admin/users?${params.toString()}`);
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search: searchInput, page: "1" });
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" disabled={isPending}>
            Search
          </Button>
        </form>
        <div className="flex gap-1">
          {verificationOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={activeFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ verification: opt.value, page: "1" })}
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              contributors.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-accent/30">
                  <TableCell>
                    <Link href={`/admin/users/${c.id}`} className="font-medium hover:text-primary">
                      {c.display_name || c.full_name}
                      {c.suspended && (
                        <Ban className="inline h-3.5 w-3.5 ml-1.5 text-red-500" />
                      )}
                      {c.flagged && (
                        <AlertTriangle className="inline h-3.5 w-3.5 ml-1.5 text-yellow-500" />
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.email}</TableCell>
                  <TableCell>
                    {c.suspended ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                        Suspended
                      </Badge>
                    ) : c.onboarding_completed ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Onboarding
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <VerificationStatusBadge status={c.verification_status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
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
