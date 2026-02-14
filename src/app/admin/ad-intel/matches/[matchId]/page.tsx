import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdIntelMatchDetail } from "@/lib/ad-intel-admin-queries";
import { Badge } from "@/components/ui/badge";
import { ReviewForm } from "@/components/admin/ad-intel/review-form";
import {
  ArrowLeft,
  Megaphone,
  ImageIcon,
  User,
  ExternalLink,
} from "lucide-react";

interface PageProps {
  params: Promise<{ matchId: string }>;
}

function confidenceBadge(tier: string) {
  const styles: Record<string, string> = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <Badge variant="outline" className={`text-xs ${styles[tier] || styles.low}`}>
      {tier}
    </Badge>
  );
}

function reviewStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    confirmed: "bg-green-500/10 text-green-400 border-green-500/20",
    dismissed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    escalated: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={styles[status] || styles.pending}>
      {status}
    </Badge>
  );
}

export default async function AdIntelMatchDetailPage({ params }: PageProps) {
  const { matchId } = await params;
  const match = await getAdIntelMatchDetail(matchId);

  if (!match) {
    notFound();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link + header */}
      <div>
        <Link
          href="/admin/ad-intel/matches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Matches
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            Match Detail
          </h1>
          {reviewStatusBadge(match.review_status)}
          {confidenceBadge(match.confidence_tier)}
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {match.match_type === "stock_to_ad"
            ? "Stock Photo to Ad"
            : "Contributor to Ad"}{" "}
          &middot; {(match.similarity_score * 100).toFixed(1)}% similarity
          &middot; Created{" "}
          {new Date(match.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Ad Creative */}
        <div className="rounded-lg border border-border/30 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">Ad Creative</h2>
          </div>

          {match.ad?.creative_url ? (
            <div className="rounded-lg overflow-hidden bg-black/20 flex items-center justify-center min-h-[200px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={match.ad.creative_url}
                alt="Ad creative"
                className="max-w-full max-h-[400px] object-contain"
              />
            </div>
          ) : (
            <div className="rounded-lg bg-black/20 flex items-center justify-center min-h-[200px]">
              <p className="text-sm text-muted-foreground">No creative URL</p>
            </div>
          )}

          {match.ad && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span>{match.ad.platform}</span>
              </div>
              {match.ad.advertiser_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advertiser</span>
                  <span>{match.ad.advertiser_name}</span>
                </div>
              )}
              {match.ad.is_ai_generated !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Generated</span>
                  <span>
                    {match.ad.is_ai_generated ? "Yes" : "No"}
                    {match.ad.ai_detection_score !== null &&
                      ` (${(match.ad.ai_detection_score * 100).toFixed(0)}%)`}
                  </span>
                </div>
              )}
              {match.ad.landing_page_url && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Landing Page</span>
                  <a
                    href={match.ad.landing_page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Stock Photo or Contributor */}
        <div className="rounded-lg border border-border/30 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {match.match_type === "stock_to_ad" ? (
              <ImageIcon className="h-4 w-4 text-blue-400" />
            ) : (
              <User className="h-4 w-4 text-green-400" />
            )}
            <h2 className="text-sm font-medium">
              {match.match_type === "stock_to_ad"
                ? "Stock Photo"
                : "Contributor"}
            </h2>
          </div>

          {match.stock_candidate?.stock_image_url ? (
            <div className="rounded-lg overflow-hidden bg-black/20 flex items-center justify-center min-h-[200px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={match.stock_candidate.stock_image_url}
                alt="Stock photo"
                className="max-w-full max-h-[400px] object-contain"
              />
            </div>
          ) : (
            <div className="rounded-lg bg-black/20 flex items-center justify-center min-h-[200px]">
              <p className="text-sm text-muted-foreground">
                {match.match_type === "stock_to_ad"
                  ? "No stock image URL"
                  : "Contributor match"}
              </p>
            </div>
          )}

          {match.stock_candidate && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span>{match.stock_candidate.stock_platform}</span>
              </div>
              {match.stock_candidate.photographer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Photographer</span>
                  <span>{match.stock_candidate.photographer}</span>
                </div>
              )}
              {match.stock_candidate.model_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span>{match.stock_candidate.model_name}</span>
                </div>
              )}
              {match.stock_candidate.license_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">License</span>
                  <span>{match.stock_candidate.license_type}</span>
                </div>
              )}
            </div>
          )}

          {match.contributor && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contributor</span>
                <span>{match.contributor.full_name || "Unknown"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Face Description */}
      {match.face && (
        <div className="rounded-lg border border-border/30 bg-card p-4 space-y-3">
          <h2 className="text-sm font-medium">Face Description</h2>
          {match.face.description && (
            <p className="text-sm text-muted-foreground">
              {match.face.description}
            </p>
          )}
          {match.face.description_keywords &&
            match.face.description_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {match.face.description_keywords.map((kw) => (
                  <Badge
                    key={kw}
                    variant="outline"
                    className="text-xs bg-primary/5 border-primary/20"
                  >
                    {kw}
                  </Badge>
                ))}
              </div>
            )}
          {match.face.demographics &&
            Object.keys(match.face.demographics).length > 0 && (
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground font-medium text-xs">
                  Demographics
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(match.face.demographics).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground capitalize">
                        {key}
                      </span>
                      <span>{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Review Notes (if already reviewed) */}
      {match.reviewer_notes && (
        <div className="rounded-lg border border-border/30 bg-card p-4 space-y-2">
          <h2 className="text-sm font-medium">Previous Review Notes</h2>
          <p className="text-sm text-muted-foreground">
            {match.reviewer_notes}
          </p>
          {match.reviewed_at && (
            <p className="text-xs text-muted-foreground">
              Reviewed {new Date(match.reviewed_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Review Form */}
      <div className="rounded-lg border border-border/30 bg-card p-4">
        <ReviewForm matchId={match.id} currentStatus={match.review_status} />
      </div>
    </div>
  );
}
