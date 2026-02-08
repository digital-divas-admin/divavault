import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContributor, getEarnings } from "@/lib/dashboard-queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { EarningsStats } from "@/components/dashboard/earnings/earnings-stats";
import { PaymentSettingsForm } from "@/components/dashboard/earnings/payment-settings-form";
import { EarningsHistory } from "@/components/dashboard/earnings/earnings-history";
import { EarlyContributorBadge } from "@/components/dashboard/earnings/early-contributor-badge";
import { HowEarningsWork } from "@/components/dashboard/earnings/how-earnings-work";

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const contributor = await getContributor(user.id);
  if (!contributor) redirect("/onboarding");

  const earnings = await getEarnings(user.id);

  let totalEarnedCents = 0;
  let pendingCents = 0;
  let paidCents = 0;

  for (const e of earnings) {
    totalEarnedCents += e.amount_cents;
    if (e.status === "pending" || e.status === "processing") {
      pendingCents += e.amount_cents;
    }
    if (e.status === "paid") {
      paidCents += e.amount_cents;
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Earnings"
        description="Track your compensation from AI training contributions."
      />

      <div className="grid gap-6">
        <EarningsStats
          totalEarnedCents={totalEarnedCents}
          pendingCents={pendingCents}
          paidCents={paidCents}
        />
        <PaymentSettingsForm paypalEmail={contributor.paypal_email} />
        <EarningsHistory earnings={earnings} />
        <EarlyContributorBadge joinDate={contributor.created_at} />
        <HowEarningsWork />
      </div>
    </div>
  );
}
