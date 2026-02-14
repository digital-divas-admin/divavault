import { getAdIntelStats } from "@/lib/ad-intel-admin-queries";
import { DashboardTabs } from "@/components/admin/ad-intel/dashboard-tabs";

export default async function AdIntelDashboardPage() {
  const stats = await getAdIntelStats();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Ad Intelligence
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor ad scanning, face detection, and stock photo matching
        </p>
      </div>

      <DashboardTabs stats={stats} />
    </div>
  );
}
