import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmissionStatusBadge } from "@/components/marketplace/submission-status-badge";
import { ReviewFeedbackForm } from "@/components/admin/review-feedback-form";
import type { SubmissionWithContributor } from "@/lib/admin-queries";
import type { SubmissionImage } from "@/types/marketplace";

interface SubmissionReviewCardProps {
  submission: SubmissionWithContributor & {
    images?: SubmissionImage[];
    request_title?: string;
  };
  showRequestTitle?: boolean;
}

export function SubmissionReviewCard({
  submission,
  showRequestTitle,
}: SubmissionReviewCardProps) {
  const isReviewable =
    submission.status === "submitted" || submission.status === "in_review";

  return (
    <Card className="bg-card border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            {showRequestTitle && submission.request_title && (
              <p className="text-xs text-muted-foreground mb-1">
                {submission.request_title}
              </p>
            )}
            <CardTitle className="text-sm font-medium">
              {submission.contributor_name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {submission.image_count} image{submission.image_count !== 1 ? "s" : ""} ·{" "}
              {submission.submitted_at
                ? new Date(submission.submitted_at).toLocaleDateString()
                : "Not submitted"}
              {submission.revision_count > 0 && (
                <span className="ml-2 text-orange-400">
                  Rev #{submission.revision_count}
                </span>
              )}
            </p>
          </div>
          <SubmissionStatusBadge status={submission.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Image thumbnails */}
        {submission.images && submission.images.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {submission.images.map((img) => (
              <div
                key={img.id}
                className="aspect-square rounded-md overflow-hidden bg-muted/30 border border-border/20"
              >
                {img.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.signed_url}
                    alt={img.caption || "Submission image"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    No preview
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Previous feedback */}
        {submission.review_feedback && !isReviewable && (
          <div className="p-3 rounded-lg bg-muted/20 text-sm">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Feedback
            </p>
            <p className="text-muted-foreground">{submission.review_feedback}</p>
          </div>
        )}

        {/* Review form */}
        {isReviewable && <ReviewFeedbackForm submissionId={submission.id} />}
      </CardContent>
    </Card>
  );
}
