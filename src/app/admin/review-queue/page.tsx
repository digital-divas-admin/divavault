import {
  getAllPendingSubmissions,
  getSubmissionWithImages,
} from "@/lib/admin-queries";
import { SubmissionReviewCard } from "@/components/admin/submission-review-card";
import { ClipboardCheck } from "lucide-react";

export default async function ReviewQueuePage() {
  const submissions = await getAllPendingSubmissions();

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
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          Review Queue
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {submissions.length} submission{submissions.length !== 1 ? "s" : ""}{" "}
          waiting for review
        </p>
      </div>

      {submissionsWithImages.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">All caught up! No pending reviews.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissionsWithImages.map((submission) => (
            <SubmissionReviewCard
              key={submission.id}
              submission={submission}
              showRequestTitle
            />
          ))}
        </div>
      )}
    </div>
  );
}
