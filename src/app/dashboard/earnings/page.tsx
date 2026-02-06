import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContributor } from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { EarningsSummary } from "@/components/dashboard/earnings/earnings-summary";
import { EarlyContributorBadge } from "@/components/dashboard/earnings/early-contributor-badge";
import { HowEarningsWork } from "@/components/dashboard/earnings/how-earnings-work";
import { PlaceholderStats } from "@/components/dashboard/earnings/placeholder-stats";

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const contributor = await getContributor(user.id);
  if (!contributor) redirect("/onboarding");

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Earnings"
        description="Track your compensation from AI training contributions."
      />

      <div className="grid gap-6">
        <EarningsSummary />
        <PlaceholderStats />
        <EarlyContributorBadge joinDate={contributor.created_at} />
        <HowEarningsWork />
      </div>
    </div>
  );
}
