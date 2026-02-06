import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getRequestById,
  getSubmissionForRequest,
  getSubmissionImages,
  createSubmission,
} from "@/lib/marketplace-queries";
import { SubmissionFlow } from "@/components/marketplace/submission-flow";

interface Props {
  params: Promise<{ requestId: string }>;
}

export default async function SubmitPage({ params }: Props) {
  const { requestId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const request = await getRequestById(requestId);
  if (!request || request.status !== "published") notFound();

  // Get or create submission
  let submission = await getSubmissionForRequest(user.id, requestId);
  if (!submission) {
    submission = await createSubmission(user.id, requestId);
  }

  // Get existing images
  const images = await getSubmissionImages(submission.id);

  return (
    <SubmissionFlow
      request={request}
      submission={submission}
      existingImages={images}
    />
  );
}
