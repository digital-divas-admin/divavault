import { DollarSign, Clock, Calendar } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";

export function PlaceholderStats() {
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <StatCard
        icon={DollarSign}
        label="Total Earned"
        value="--"
        muted
      />
      <StatCard
        icon={Clock}
        label="Pending"
        value="--"
        muted
      />
      <StatCard
        icon={Calendar}
        label="Next Payout"
        value="--"
        muted
      />
    </div>
  );
}
