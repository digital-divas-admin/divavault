import { DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";

interface EarningsStatsProps {
  totalEarnedCents: number;
  pendingCents: number;
  paidCents: number;
}

export function EarningsStats({
  totalEarnedCents,
  pendingCents,
  paidCents,
}: EarningsStatsProps) {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <StatCard
        icon={DollarSign}
        label="Total Earned"
        value={`$${(totalEarnedCents / 100).toFixed(2)}`}
        muted={totalEarnedCents === 0}
      />
      <StatCard
        icon={Clock}
        label="Pending"
        value={`$${(pendingCents / 100).toFixed(2)}`}
        muted={pendingCents === 0}
      />
      <StatCard
        icon={CheckCircle2}
        label="Paid"
        value={`$${(paidCents / 100).toFixed(2)}`}
        muted={paidCents === 0}
      />
    </div>
  );
}
