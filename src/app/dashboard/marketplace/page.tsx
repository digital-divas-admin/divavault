import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPublishedRequestsWithMeta,
  getMarketplaceStats,
} from "@/lib/marketplace-queries";
import { RequestGrid } from "@/components/marketplace/request-grid";
import { RequestFilters } from "@/components/marketplace/request-filters";
import { ShoppingBag, Send, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function MarketplacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [requests, stats] = await Promise.all([
    getPublishedRequestsWithMeta(user.id),
    getMarketplaceStats(user.id),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Marketplace
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse paid requests and earn from your contributions
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-neon/10 p-2">
              <ShoppingBag className="h-4 w-4 text-neon" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.openRequests}</p>
              <p className="text-xs text-muted-foreground">Open Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-blue-500/10 p-2">
              <Send className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.activeSubmissions}</p>
              <p className="text-xs text-muted-foreground">
                Your Active Submissions
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-green-500/10 p-2">
              <DollarSign className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                ${(stats.totalEarned / 100).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Marketplace Earnings
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <RequestFilters />

      {/* Grid */}
      <RequestGrid requests={requests} />
    </div>
  );
}
