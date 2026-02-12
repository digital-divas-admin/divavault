import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Camera } from "lucide-react";
import { TierGate } from "@/components/dashboard/matches/tier-gate";
import { MatchHero } from "@/components/dashboard/matches/match-hero";
import { AiDetectionCallout } from "@/components/dashboard/matches/ai-detection-callout";
import { MatchActions } from "@/components/dashboard/matches/match-actions";
import { TakedownTimeline } from "@/components/dashboard/matches/takedown-timeline";
import { getContributorMatchDetail } from "@/lib/protection-queries";
import { getTierCapabilities } from "@/lib/tier-capabilities";
import { timeAgo } from "@/lib/format";

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
    supabase
      .from("contributors")
      .select("subscription_tier")
      .eq("id", user.id)
      .single(),
  ]);

  if (!detail) notFound();

  const tier = getTierCapabilities(contributorRes.data?.subscription_tier);
  const hasPendingTakedown = detail.takedowns.some(
    (t) => t.status === "pending" || t.status === "submitted"
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <div className="mb-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Link href="/dashboard/matches">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Matches
          </Link>
        </Button>
      </div>

      {/* Hero */}
      <MatchHero
        similarityScore={detail.similarity_score}
        confidenceTier={detail.confidence_tier}
        platform={detail.platform}
        createdAt={detail.created_at}
        status={detail.status}
      />

      {/* AI Detection Callout */}
      <AiDetectionCallout
        isAiGenerated={detail.is_ai_generated}
        aiDetectionScore={detail.ai_detection_score}
        aiGenerator={detail.ai_generator}
      />

      {/* Actions */}
      <MatchActions
        matchId={detail.id}
        currentStatus={detail.status}
        canRequestTakedown={tier.canRequestTakedown}
        hasPendingTakedown={hasPendingTakedown}
      />

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
              <div className="grid sm:grid-cols-2 gap-3">
                {detail.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-border/50 bg-secondary/30 p-4"
                  >
                    <div className="flex items-center justify-center h-24 bg-muted/20 rounded-md mb-3">
                      <Camera className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium capitalize">
                      {ev.evidence_type.replace(/_/g, " ")}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(ev.captured_at)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {ev.sha256_hash.slice(0, 8)}
                      </span>
                    </div>
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
          <CardTitle className="text-lg">Takedown Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <TakedownTimeline takedowns={detail.takedowns} />
        </CardContent>
      </Card>
    </div>
  );
}
