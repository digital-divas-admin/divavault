import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Target,
  Fingerprint,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getRegistryStatus,
  getRegistryMatchSummary,
} from "@/lib/registry-status-queries";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function relativeTime(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "verified":
      return <Badge variant="success">Verified</Badge>;
    case "claimed":
      return <Badge variant="primary">Claimed</Badge>;
    case "suspended":
      return <Badge variant="destructive">Suspended</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function EmbeddingBadge({ status }: { status: string | null }) {
  switch (status) {
    case "processed":
      return <Badge variant="success">Processed</Badge>;
    case "pending":
      return <Badge variant="warning">Processing</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

function ConfidenceBadge({ tier }: { tier: string }) {
  switch (tier) {
    case "high":
      return <Badge variant="destructive">High</Badge>;
    case "medium":
      return <Badge variant="warning">Medium</Badge>;
    default:
      return <Badge variant="secondary">Low</Badge>;
  }
}

export default async function RegistryStatusPage({
  params,
}: {
  params: Promise<{ cid: string }>;
}) {
  const { cid } = await params;

  // Validate CID format (CID-1 + 16 hex chars)
  if (!/^CID-1[0-9a-f]{16}$/i.test(cid)) {
    notFound();
  }

  const identity = await getRegistryStatus(cid);
  if (!identity) notFound();

  const matchSummary = await getRegistryMatchSummary(cid);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-full p-2.5 bg-primary/10">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
              Registry Status
            </h1>
            <p className="font-mono text-sm text-muted-foreground">{cid}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Identity Card */}
          <Card className="bg-card border-border/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-medium text-foreground">
                  Identity
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={identity.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Embedding
                  </p>
                  <EmbeddingBadge status={identity.embeddingStatus} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Registered
                  </p>
                  <p className="text-sm text-foreground">
                    {formatDate(identity.createdAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Match Summary Card */}
          <Card className="bg-card border-border/30">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-medium text-foreground">
                    Matches
                  </h2>
                </div>
                {matchSummary.totalMatches > 0 && (
                  <span className="text-2xl font-bold text-foreground">
                    {matchSummary.totalMatches}
                  </span>
                )}
              </div>

              {matchSummary.totalMatches === 0 ? (
                <div className="flex items-center gap-3 py-3">
                  <div className="rounded-full p-2 bg-green-500/10">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      No matches found yet
                    </p>
                    <p className="text-xs text-muted-foreground">
                      We&apos;re actively scanning AI platforms for unauthorized
                      use of your likeness
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Confidence breakdown */}
                  <div className="flex gap-4 text-sm">
                    {matchSummary.highConfidence > 0 && (
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-muted-foreground">
                          {matchSummary.highConfidence} high
                        </span>
                      </div>
                    )}
                    {matchSummary.mediumConfidence > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-muted-foreground">
                          {matchSummary.mediumConfidence} medium
                        </span>
                      </div>
                    )}
                    {matchSummary.lowConfidence > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                          {matchSummary.lowConfidence} low
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Match list */}
                  <div className="space-y-2 pt-1">
                    {matchSummary.matches.map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border/20"
                      >
                        <div className="flex items-center gap-3">
                          <ConfidenceBadge tier={match.confidenceTier} />
                          <span className="text-sm text-foreground">
                            {match.platform || "Unknown platform"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(match.discoveredAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Upgrade CTA */}
          <Card className="bg-card border-primary/20 border">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full p-2 bg-primary/10 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    Get Full Protection
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Unlock evidence screenshots, AI detection analysis,
                    automated DMCA takedowns, and continuous monitoring across
                    250+ platforms.
                  </p>
                  <Button asChild size="sm">
                    <Link href="/signup">
                      Upgrade Now
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
