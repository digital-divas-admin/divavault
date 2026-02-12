import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Target,
  Gavel,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { MatchCard } from "@/components/dashboard/matches/match-card";
import { MatchFilters } from "@/components/dashboard/matches/match-filters";
import {
  getContributorMatches,
  getMatchesPageStats,
  getDistinctPlatforms,
} from "@/lib/protection-queries";
import { getTierCapabilities } from "@/lib/tier-capabilities";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    confidence?: string;
    platform?: string;
    page?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const status = params.status || undefined;
  const confidence = params.confidence || undefined;
  const platform = params.platform || undefined;
  const page = parseInt(params.page || "1", 10);
  const pageSize = 20;

  const [{ matches, total }, stats, platforms, contributorRes] =
    await Promise.all([
      getContributorMatches(user.id, {
        status,
        confidence,
        platform,
        page,
        pageSize,
      }),
      getMatchesPageStats(user.id),
      getDistinctPlatforms(user.id),
      supabase
        .from("contributors")
        .select("subscription_tier")
        .eq("id", user.id)
        .single(),
    ]);

  const tier = getTierCapabilities(contributorRes.data?.subscription_tier);
  const totalPages = Math.ceil(total / pageSize);

  // Build pagination URL preserving filters
  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (confidence) sp.set("confidence", confidence);
    if (platform) sp.set("platform", platform);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/dashboard/matches${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Matches"
        description="Content found across AI platforms that matches your likeness."
      />

      {/* Stats bar */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={AlertTriangle}
          label="New Matches"
          value={stats.newMatches}
          valueClassName={
            stats.newMatches > 0 ? "text-destructive" : "text-accent"
          }
        />
        <StatCard icon={Target} label="Total Matches" value={stats.totalMatches} />
        <StatCard
          icon={Gavel}
          label="Active Takedowns"
          value={stats.activeTakedowns}
          valueClassName="text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Success Rate"
          value={`${stats.successRate}%`}
          valueClassName="text-accent"
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <Suspense fallback={null}>
          <MatchFilters platforms={platforms} totalCount={total} />
        </Suspense>
      </div>

      {matches.length > 0 ? (
        <>
          <div className="space-y-3 mb-6">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 text-sm">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageUrl(page - 1)}>Previous</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              )}
              <span className="text-muted-foreground text-xs">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageUrl(page + 1)}>Next</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <Card className="border-accent/20 bg-accent/5 rounded-2xl">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-accent mx-auto mb-4" />
            <h3 className="font-[family-name:var(--font-heading)] text-xl mb-2">
              You&apos;re Protected
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-3">
              No unauthorized use detected. We&apos;re actively scanning AI
              platforms for your likeness.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Scan frequency: {tier.scanFrequency}
              {tier.tier === "free" && (
                <span>
                  {" "}
                  &middot;{" "}
                  <Link
                    href="/dashboard/account"
                    className="text-primary hover:underline"
                  >
                    Upgrade for faster scans
                  </Link>
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
