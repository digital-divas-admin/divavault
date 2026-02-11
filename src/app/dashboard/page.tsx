import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Radar,
  Target,
  Gavel,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/protection/activity-feed";
import { RecentMatchesCard } from "@/components/dashboard/protection/recent-matches-card";
import { NoMatchesCard } from "@/components/dashboard/protection/no-matches-card";
import { TierUpsellBanner } from "@/components/dashboard/protection/tier-upsell-banner";
import { getProtectionStats, getContributorMatches, getProtectionActivityFeed } from "@/lib/protection-queries";
import type { DashboardContributor } from "@/types/dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: contributor } = await supabase
    .from("contributors")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!contributor) redirect("/onboarding");

  const c = contributor as DashboardContributor;

  const [stats, recentMatchesResult, activities] = await Promise.all([
    getProtectionStats(user.id),
    getContributorMatches(user.id, { pageSize: 5 }),
    getProtectionActivityFeed(user.id, 8),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Protection Dashboard"
        description="We're monitoring the web for unauthorized use of your likeness."
      />

      {/* Stats row */}
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <StatCard
          icon={Radar}
          label="Platforms Monitored"
          value={stats.platformsMonitored}
        />
        <StatCard
          icon={Target}
          label="Matches Found"
          value={stats.matchCount}
          valueClassName="text-accent"
        />
        <StatCard
          icon={Gavel}
          label="Takedowns Filed"
          value={stats.takedownsFiled}
          valueClassName="text-accent"
        />
      </div>

      {/* Recent Matches */}
      <Card className="border-border/50 bg-card rounded-2xl mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Matches</CardTitle>
          {recentMatchesResult.total > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/matches">
                View All
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentMatchesResult.matches.length > 0 ? (
            <RecentMatchesCard matches={recentMatchesResult.matches} />
          ) : (
            <NoMatchesCard />
          )}
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card className="border-border/50 bg-card rounded-2xl mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities} />
        </CardContent>
      </Card>

      {/* Tier Upgrade */}
      <TierUpsellBanner tier={c.subscription_tier || "free"} />
    </div>
  );
}
