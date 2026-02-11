import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { MatchCard } from "@/components/dashboard/matches/match-card";
import { MatchFilters } from "@/components/dashboard/matches/match-filters";
import { getContributorMatches } from "@/lib/protection-queries";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const status = params.status || undefined;
  const page = parseInt(params.page || "1", 10);

  const { matches, total } = await getContributorMatches(user.id, {
    status,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Matches"
        description="Content found across AI platforms that matches your likeness."
      />

      <div className="mb-6">
        <Suspense fallback={null}>
          <MatchFilters />
        </Suspense>
      </div>

      {matches.length > 0 ? (
        <>
          <div className="space-y-3 mb-6">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({total} matches)
              </span>
            </div>
          )}
        </>
      ) : (
        <Card className="border-accent/20 bg-accent/5 rounded-2xl">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-accent mx-auto mb-4" />
            <h3 className="font-[family-name:var(--font-heading)] text-xl mb-2">
              No unauthorized use detected
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              We&apos;re actively scanning AI platforms for your likeness. If any
              unauthorized use is found, it will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
