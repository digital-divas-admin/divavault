import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { getOptOutCompanyViews, getOptOutStats } from "@/lib/optout-queries";
import { OptOutPageClient } from "./client";
import { Send, CheckCircle2, Clock, Percent } from "lucide-react";

export default async function OptOutsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contributor } = await supabase
    .from("contributors")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (!contributor) redirect("/onboarding");

  const [views, stats] = await Promise.all([
    getOptOutCompanyViews(user.id),
    getOptOutStats(user.id),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="AI Opt-Out Manager"
        description="AI companies don't make it easy to opt out. We help you build a legally documented trail — formal notices sent, delivery records, and follow-ups — so you have proof you exercised your rights."
      />

      {/* Stats row */}
      <div className="grid sm:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <StatCard icon={Send} label="Companies Contacted" value={stats.contacted} />
        <StatCard icon={CheckCircle2} label="Confirmed" value={stats.confirmed} valueClassName="text-accent" />
        <StatCard icon={Clock} label="Pending" value={stats.pending} />
        <StatCard icon={Percent} label="Success Rate" value={`${stats.successRate}%`} />
      </div>

      <OptOutPageClient
        views={views}
        stats={stats}
        userName={contributor.full_name || "User"}
      />
    </div>
  );
}
