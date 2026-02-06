import { notFound } from "next/navigation";
import Link from "next/link";
import { getRequestById } from "@/lib/marketplace-queries";
import {
  getSubmissionsForRequest,
  getSubmissionWithImages,
} from "@/lib/admin-queries";
import { RequestStatusBadge } from "@/components/admin/request-status-badge";
import { BudgetTracker } from "@/components/admin/budget-tracker";
import { ProgressIndicator } from "@/components/marketplace/progress-indicator";
import { SubmissionReviewCard } from "@/components/admin/submission-review-card";
import { ArrowLeft } from "lucide-react";

export default async function RequestSubmissionsPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const request = await getRequestById(requestId);

  if (!request) {
    notFound();
  }

  const submissions = await getSubmissionsForRequest(requestId, "all");

  // Get images for each submission
  const submissionsWithImages = await Promise.all(
    submissions.map(async (s) => {
      const detail = await getSubmissionWithImages(s.id);
      return {
        ...s,
        images: detail?.images || [],
      };
    })
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href={`/admin/requests/${requestId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to request
      </Link>

      {/* Request header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            {request.title}
          </h1>
          <RequestStatusBadge status={request.status} />
        </div>
        <div className="flex items-center gap-4 mt-3">
          <ProgressIndicator
            fulfilled={request.quantity_fulfilled}
            needed={request.quantity_needed}
            size="md"
          />
          <span className="text-sm text-muted-foreground">
            {request.quantity_fulfilled} / {request.quantity_needed} fulfilled
          </span>
        </div>
      </div>

      <BudgetTracker
        spentCents={request.budget_spent_cents}
        totalCents={request.budget_total_cents}
      />

      {/* Submissions */}
      {submissionsWithImages.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No submissions yet
        </div>
      ) : (
        <div className="space-y-4">
          {submissionsWithImages.map((submission) => (
            <SubmissionReviewCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
