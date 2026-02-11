import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TierGate } from "@/components/dashboard/matches/tier-gate";
import { getContributorMatchDetail } from "@/lib/protection-queries";
import { getTierCapabilities } from "@/lib/tier-capabilities";
import type { DashboardContributor } from "@/types/dashboard";

const statusVariant: Record<string, "success" | "warning" | "purple" | "secondary"> = {
  new: "purple",
  reviewed: "secondary",
  takedown_filed: "success",
  removed: "success",
  disputed: "warning",
  dismissed: "secondary",
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { id } = await params;
  const [detail, contributorRes] = await Promise.all([
    getContributorMatchDetail(user.id, id),
    supabase.from("contributors").select("subscription_tier").eq("id", user.id).single(),
  ]);

  if (!detail) notFound();

  const tier = getTierCapabilities(contributorRes.data?.subscription_tier);
  const confidencePercent = Math.round(detail.similarity_score * 100);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/dashboard/matches">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Matches
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Match on ${detail.platform || "Unknown Platform"}`}
        description={`Detected on ${new Date(detail.created_at).toLocaleDateString()}`}
      />

      {/* Match overview */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card className="border-border/50 bg-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Similarity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{confidencePercent}%</p>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {detail.confidence_tier} confidence
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={statusVariant[detail.status] || "secondary"}
              className="capitalize text-sm px-3 py-1"
            >
              {detail.status.replace(/_/g, " ")}
            </Badge>
            {detail.ai_generator && (
              <p className="text-xs text-muted-foreground mt-2">
                AI Model: {detail.ai_generator}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Details — tier-gated */}
      <TierGate feature="platform details" canAccess={tier.canSeePlatformUrls}>
        <Card className="border-border/50 bg-card rounded-xl mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Platform Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.page_title && (
              <div>
                <p className="text-xs text-muted-foreground">Page Title</p>
                <p className="text-sm">{detail.page_title}</p>
              </div>
            )}
            {detail.page_url && (
              <div>
                <p className="text-xs text-muted-foreground">URL</p>
                <a
                  href={detail.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  {detail.page_url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </TierGate>

      {/* Evidence — tier-gated */}
      <TierGate feature="evidence" canAccess={tier.canSeeEvidence}>
        <Card className="border-border/50 bg-card rounded-xl mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.evidence.length > 0 ? (
              <div className="space-y-3">
                {detail.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <div>
                      <p className="text-sm capitalize">
                        {ev.evidence_type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ev.captured_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {ev.sha256_hash.slice(0, 12)}...
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No evidence captured yet.
              </p>
            )}
          </CardContent>
        </Card>
      </TierGate>

      {/* Takedown Timeline */}
      <Card className="border-border/50 bg-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">Takedown History</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.takedowns.length > 0 ? (
            <div className="space-y-3">
              {detail.takedowns.map((td) => (
                <div
                  key={td.id}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                >
                  <div>
                    <p className="text-sm">
                      {td.takedown_type.toUpperCase()} — {td.platform}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {td.submitted_at
                        ? `Submitted ${new Date(td.submitted_at).toLocaleDateString()}`
                        : `Created ${new Date(td.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      td.status === "completed" || td.status === "removed"
                        ? "success"
                        : td.status === "pending"
                          ? "warning"
                          : "secondary"
                    }
                    className="capitalize text-[10px]"
                  >
                    {td.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No takedowns filed for this match yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
