import { getAdIntelMatches } from "@/lib/ad-intel-admin-queries";
import { AdIntelMatchesTable } from "@/components/admin/ad-intel/matches-table";

interface PageProps {
  searchParams: Promise<{
    confidence?: string;
    status?: string;
    matchType?: string;
    page?: string;
  }>;
}

export default async function AdIntelMatchesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 20;

  const { matches, total } = await getAdIntelMatches({
    confidence: params.confidence,
    status: params.status,
    matchType: params.matchType,
    page,
    pageSize,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Ad Matches
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} match{total !== 1 ? "es" : ""} found
        </p>
      </div>

      <AdIntelMatchesTable
        matches={matches}
        total={total}
        page={page}
        pageSize={pageSize}
      />
    </div>
  );
}
