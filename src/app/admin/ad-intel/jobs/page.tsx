import { getAdIntelJobs } from "@/lib/ad-intel-admin-queries";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { AdIntelJobsTable } from "@/components/admin/ad-intel/jobs-table";
import { Play, CheckCircle2, XCircle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

async function getAdIntelJobSummary() {
  const supabase = await createServiceClient();
  const [
    { count: running },
    { count: completed },
    { count: failed },
  ] = await Promise.all([
    supabase
      .from("scan_jobs")
      .select("*", { count: "exact", head: true })
      .eq("scan_type", "ad_intel")
      .eq("status", "running"),
    supabase
      .from("scan_jobs")
      .select("*", { count: "exact", head: true })
      .eq("scan_type", "ad_intel")
      .eq("status", "completed"),
    supabase
      .from("scan_jobs")
      .select("*", { count: "exact", head: true })
      .eq("scan_type", "ad_intel")
      .eq("status", "failed"),
  ]);
  return {
    running: running || 0,
    completed: completed || 0,
    failed: failed || 0,
  };
}

export default async function AdIntelJobsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 20;

  const [{ jobs, total }, summary] = await Promise.all([
    getAdIntelJobs({
      status: params.status,
      page,
      pageSize,
    }),
    getAdIntelJobSummary(),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Ad Scan Jobs
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} total job{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminStatCard
          icon={Play}
          value={summary.running}
          label="Running"
          iconClassName="text-blue-400"
          iconBgClassName="bg-blue-500/10"
        />
        <AdminStatCard
          icon={CheckCircle2}
          value={summary.completed}
          label="Completed"
          iconClassName="text-green-400"
          iconBgClassName="bg-green-500/10"
        />
        <AdminStatCard
          icon={XCircle}
          value={summary.failed}
          label="Failed"
          iconClassName="text-red-400"
          iconBgClassName="bg-red-500/10"
        />
      </div>

      <AdIntelJobsTable
        jobs={jobs}
        total={total}
        page={page}
        pageSize={pageSize}
      />
    </div>
  );
}
