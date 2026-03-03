"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type {
  InvestigationListItem,
  InvestigationStats,
  InvestigationStatus,
} from "@/types/investigations";
import {
  VERDICT_LABELS,
  VERDICT_COLORS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/types/investigations";

const statusFilters: { label: string; value: InvestigationStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "In Progress", value: "in_progress" },
  { label: "Published", value: "published" },
];

export function InvestigationListTable() {
  const [investigations, setInvestigations] = useState<InvestigationListItem[]>([]);
  const [stats, setStats] = useState<InvestigationStats | null>(null);
  const [filter, setFilter] = useState<InvestigationStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  // Fetch stats once on mount (not on filter change)
  useEffect(() => {
    fetch("/api/admin/investigations/stats")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setStats(data); });
  }, []);

  // Fetch investigations on filter change
  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/investigations${filter !== "all" ? `?status=${filter}` : ""}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => { setInvestigations(data); setLoading(false); });
  }, [filter]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total"
            value={stats.total}
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="In Progress"
            value={stats.in_progress}
            icon={<Clock className="h-4 w-4 text-yellow-500" />}
          />
          <StatCard
            label="Published"
            value={stats.published}
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          />
          <StatCard
            label="Confirmed Fake"
            value={stats.confirmed_fake}
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          />
        </div>
      )}

      {/* Filter + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-card rounded-lg p-1 border border-border/50">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === f.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/admin/investigations/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Investigation
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : investigations.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No investigations found</p>
            <Link href="/admin/investigations/new">
              <Button variant="outline" size="sm" className="mt-3 gap-2">
                <Plus className="h-4 w-4" />
                Create your first investigation
              </Button>
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Title
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Category
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                  Verdict
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Confidence
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {investigations.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/investigations/${inv.id}`}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {inv.title}
                    </Link>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{inv.media_count} media</span>
                      <span>{inv.evidence_count} evidence</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[inv.category]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {inv.verdict ? (
                      <Badge className={`text-xs ${VERDICT_COLORS[inv.verdict]}`}>
                        {VERDICT_LABELS[inv.verdict]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {inv.confidence_score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${inv.confidence_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {inv.confidence_score}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[inv.status]}`}
                    >
                      {STATUS_LABELS[inv.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(inv.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
