import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRequestById, getSubmissionForRequest } from "@/lib/marketplace-queries";
import { RequestDetail } from "@/components/marketplace/request-detail";

interface Props {
  params: Promise<{ requestId: string }>;
}

export default async function RequestDetailPage({ params }: Props) {
  const { requestId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const request = await getRequestById(requestId);
  if (!request || request.status !== "published") notFound();

  // Check bookmark status and existing submission
  const [{ data: bookmark }, submission] = await Promise.all([
    supabase
      .from("bounty_bookmarks")
      .select("request_id")
      .eq("contributor_id", user.id)
      .eq("request_id", requestId)
      .maybeSingle(),
    getSubmissionForRequest(user.id, requestId),
  ]);

  return (
    <RequestDetail
      request={request}
      isBookmarked={!!bookmark}
      existingSubmissionId={submission?.id}
      existingSubmissionStatus={submission?.status}
    />
  );
}
