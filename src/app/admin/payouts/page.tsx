import { getPayoutStats, getAllEarnings } from "@/lib/admin-queries";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { PayoutTable } from "@/components/admin/payout-table";
import { BatchPayoutButton } from "@/components/admin/batch-payout-button";
import { Clock, RefreshCw, CheckCircle2, ShieldAlert } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 20;

  const [stats, { earnings, total }] = await Promise.all([
    getPayoutStats(),
    getAllEarnings({
      statusFilter: params.status,
      page,
      pageSize,
    }),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Payouts
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage contributor earnings
          </p>
        </div>
        <BatchPayoutButton
          pendingCount={stats.pendingCount}
          pendingAmount={`$${(stats.pendingCents / 100).toFixed(2)}`}
        />
      </div>

      {/* Payout stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          icon={Clock}
          value={`$${(stats.pendingCents / 100).toFixed(2)}`}
          label="Pending"
          iconClassName="text-yellow-400"
          iconBgClassName="bg-yellow-500/10"
        />
        <AdminStatCard
          icon={RefreshCw}
          value={`$${(stats.processingCents / 100).toFixed(2)}`}
          label="Processing"
          iconClassName="text-blue-400"
          iconBgClassName="bg-blue-500/10"
        />
        <AdminStatCard
          icon={CheckCircle2}
          value={`$${(stats.paidCents / 100).toFixed(2)}`}
          label="Paid"
          iconClassName="text-green-400"
          iconBgClassName="bg-green-500/10"
        />
        <AdminStatCard
          icon={ShieldAlert}
          value={`$${(stats.heldCents / 100).toFixed(2)}`}
          label="Held"
          iconClassName="text-red-400"
          iconBgClassName="bg-red-500/10"
        />
      </div>

      {/* Earnings table */}
      <PayoutTable
        earnings={earnings}
        total={total}
        page={page}
        pageSize={pageSize}
      />
    </div>
  );
}
