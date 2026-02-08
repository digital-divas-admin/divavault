import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BountyBadge } from "./bounty-badge";
import { ProgressIndicator } from "./progress-indicator";
import { DeadlineCountdown } from "./deadline-countdown";
import { SubmissionStatusBadge } from "./submission-status-badge";
import { BookmarkButton } from "./bookmark-button";
import { ArrowLeft, ImageIcon, Ruler, FileType } from "lucide-react";
import type { BountyRequest, SubmissionStatus } from "@/types/marketplace";

const categoryLabels: Record<string, string> = {
  portrait: "Portrait",
  full_body: "Full Body",
  lifestyle: "Lifestyle",
  fashion: "Fashion",
  fitness: "Fitness",
  artistic: "Artistic",
  professional: "Professional",
  casual: "Casual",
  themed: "Themed",
  other: "Other",
};

interface RequestDetailProps {
  request: BountyRequest;
  isBookmarked: boolean;
  existingSubmissionId?: string | null;
  existingSubmissionStatus?: SubmissionStatus | null;
}

export function RequestDetail({
  request,
  isBookmarked,
  existingSubmissionId,
  existingSubmissionStatus,
}: RequestDetailProps) {
  const payDollars = (request.pay_amount_cents / 100).toFixed(2);
  const budgetDollars = (request.budget_total_cents / 100).toFixed(2);
  const speedBonusDollars = request.speed_bonus_cents
    ? (request.speed_bonus_cents / 100).toFixed(2)
    : null;
  const qualityBonusDollars = request.quality_bonus_cents
    ? (request.quality_bonus_cents / 100).toFixed(2)
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/marketplace"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      {/* Title */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          {request.title}
        </h1>
        <BookmarkButton requestId={request.id} initialBookmarked={isBookmarked} />
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2 flex-wrap">
        <BountyBadge
          payAmountCents={request.pay_amount_cents}
          payType={request.pay_type}
        />
        <DeadlineCountdown deadline={request.deadline} />
        <ProgressIndicator
          fulfilled={request.quantity_fulfilled}
          needed={request.quantity_needed}
          size="md"
        />
        <Badge variant="secondary" className="text-xs">
          {categoryLabels[request.category] || request.category}
        </Badge>
      </div>

      {/* Model context card */}
      {request.model_context && (
        <Card className="bg-card border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Why we need this</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{request.model_context}</p>
          </CardContent>
        </Card>
      )}

      {/* What we're looking for */}
      <Card className="bg-card border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            What we&apos;re looking for
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{request.description}</p>
          {request.quality_guidelines && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">
                Quality guidelines
              </p>
              <p className="text-xs text-muted-foreground">
                {request.quality_guidelines}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              Min {request.min_resolution_width}x{request.min_resolution_height}px
            </span>
            <span className="flex items-center gap-1">
              <FileType className="h-3 w-3" />
              {request.accepted_formats.map((f) => f.split("/")[1]?.toUpperCase()).join(", ")}
            </span>
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Max {(request.max_file_size_bytes / (1024 * 1024)).toFixed(0)}MB
            </span>
          </div>
          {(request.scenario_tags.length > 0 || request.setting_tags.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {request.scenario_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
              {request.setting_tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estimated effort */}
      {(request.estimated_effort || request.set_size) && (
        <Card className="bg-card border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estimated effort</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {request.estimated_effort && <p>{request.estimated_effort}</p>}
            {request.set_size && (
              <p>{request.set_size} images per set</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compensation */}
      <Card className="bg-card border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Compensation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Base pay ({request.pay_type === "per_image" ? "per image" : "per set"})
              </span>
              <span className="font-medium text-green-400">${payDollars}</span>
            </div>
            {speedBonusDollars && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed bonus</span>
                <span className="font-medium text-yellow-400">
                  +${speedBonusDollars}
                </span>
              </div>
            )}
            {qualityBonusDollars && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quality bonus</span>
                <span className="font-medium text-yellow-400">
                  +${qualityBonusDollars}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border/20">
              <span className="text-muted-foreground">Total budget</span>
              <span className="font-medium">${budgetDollars}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="pt-2">
        {existingSubmissionId ? (
          <div className="flex items-center gap-3">
            <SubmissionStatusBadge status={existingSubmissionStatus!} />
            <Link href={`/dashboard/marketplace/${request.id}/submit`}>
              <Button variant="outline">View Submission</Button>
            </Link>
          </div>
        ) : (
          <Link href={`/dashboard/marketplace/${request.id}/submit`}>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Start Submission
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
