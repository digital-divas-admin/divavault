"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BountyBadge } from "./bounty-badge";
import { DeadlineCountdown } from "./deadline-countdown";
import { SubmissionUpload } from "./submission-upload";
import { SubmissionPreview, type PreviewImage } from "./submission-preview";
import { SubmissionStatusBadge } from "./submission-status-badge";
import type { BountyRequest, BountySubmission, SubmissionImage } from "@/types/marketplace";

interface SubmissionFlowProps {
  request: BountyRequest;
  submission: BountySubmission;
  existingImages: SubmissionImage[];
}

export function SubmissionFlow({
  request,
  submission,
  existingImages,
}: SubmissionFlowProps) {
  const router = useRouter();
  const [images, setImages] = useState<PreviewImage[]>(
    existingImages.map((img) => ({
      filePath: img.file_path,
      bucket: img.bucket,
      fileSize: img.file_size || 0,
      signedUrl: img.signed_url,
      caption: img.caption || "",
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditable = submission.status === "draft" || submission.status === "revision_requested";

  const handleImagesUploaded = useCallback(
    async (
      uploaded: Array<{
        filePath: string;
        bucket: string;
        fileSize: number;
        localUrl: string;
      }>
    ) => {
      // Optimistically add to UI immediately
      setImages((prev) => [
        ...prev,
        ...uploaded.map((img) => ({
          filePath: img.filePath,
          bucket: img.bucket,
          fileSize: img.fileSize,
          localUrl: img.localUrl,
          caption: "",
        })),
      ]);

      // Persist image records to DB in background
      for (const img of uploaded) {
        try {
          await fetch(`/api/marketplace/submissions/${submission.id}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filePath: img.filePath,
              bucket: img.bucket,
              fileSize: img.fileSize,
            }),
          });
        } catch {
          console.error("Failed to save image record for", img.filePath);
        }
      }
    },
    [submission.id]
  );

  const handleRemove = async (filePath: string) => {
    setImages((prev) => prev.filter((img) => img.filePath !== filePath));

    // Delete from DB
    try {
      await fetch(`/api/marketplace/submissions/${submission.id}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
    } catch {
      console.error("Failed to delete image record");
    }
  };

  const handleCaptionChange = (filePath: string, caption: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.filePath === filePath ? { ...img, caption } : img
      )
    );
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      setError("Please upload at least one photo before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/marketplace/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit.");
        return;
      }

      router.push("/dashboard/marketplace/my-submissions");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/marketplace/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to withdraw.");
        return;
      }

      router.push("/dashboard/marketplace");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href={`/dashboard/marketplace/${request.id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Request
      </Link>

      {/* Request summary */}
      <Card className="bg-card/50 border-border/30">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] font-semibold text-lg">
                {request.title}
              </h2>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {request.description}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <BountyBadge
                payAmountCents={request.pay_amount_cents}
                payType={request.pay_type}
              />
              <DeadlineCountdown deadline={request.deadline} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submission status */}
      {submission.status !== "draft" && (
        <div className="flex items-center gap-3">
          <SubmissionStatusBadge status={submission.status} />
          {submission.review_feedback && (
            <p className="text-sm text-muted-foreground">
              {submission.review_feedback}
            </p>
          )}
        </div>
      )}

      {/* Upload zone */}
      {isEditable && (
        <SubmissionUpload
          submissionId={submission.id}
          minWidth={request.min_resolution_width}
          minHeight={request.min_resolution_height}
          acceptedFormats={request.accepted_formats}
          maxFileSizeBytes={request.max_file_size_bytes}
          onImagesUploaded={handleImagesUploaded}
        />
      )}

      {/* Preview grid */}
      <SubmissionPreview
        images={images}
        onRemove={isEditable ? handleRemove : () => {}}
        onCaptionChange={isEditable ? handleCaptionChange : () => {}}
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      {isEditable && (
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting || images.length === 0}
            className="bg-neon hover:bg-neon/90 text-neon-foreground"
          >
            {submitting ? "Submitting..." : "Submit for Review"}
          </Button>
          {submission.status !== "draft" && (
            <Button
              variant="outline"
              onClick={handleWithdraw}
              disabled={submitting}
            >
              Withdraw
            </Button>
          )}
        </div>
      )}

      {/* Info */}
      {isEditable && (
        <p className="text-xs text-muted-foreground">
          Ready to submit? Our team reviews within 48 hours. You&apos;ll be
          notified of the outcome.
        </p>
      )}
    </div>
  );
}
