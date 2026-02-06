import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  BountyRequest,
  BountyRequestWithMeta,
  BountySubmission,
  SubmissionWithRequest,
  SubmissionImage,
  MarketplaceStats,
  RequestCategory,
  TrackType,
  RequestSortBy,
} from "@/types/marketplace";

export async function getPublishedRequests(filters?: {
  search?: string;
  category?: RequestCategory | "all";
  trackType?: TrackType | "all";
  sortBy?: RequestSortBy;
}): Promise<BountyRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bounty_requests")
    .select("*")
    .eq("status", "published");

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (filters?.trackType && filters.trackType !== "all") {
    // "both" requests should show for sfw and nsfw filters
    query = query.or(
      `track_type.eq.${filters.trackType},track_type.eq.both`
    );
  }

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  switch (filters?.sortBy) {
    case "deadline":
      query = query.order("deadline", { ascending: true, nullsFirst: false });
      break;
    case "highest_pay":
      query = query.order("pay_amount_cents", { ascending: false });
      break;
    default:
      query = query.order("published_at", { ascending: false });
  }

  const { data } = await query;
  return (data as BountyRequest[]) || [];
}

export async function getPublishedRequestsWithMeta(
  userId: string,
  filters?: {
    search?: string;
    category?: RequestCategory | "all";
    trackType?: TrackType | "all";
    sortBy?: RequestSortBy;
  }
): Promise<BountyRequestWithMeta[]> {
  const requests = await getPublishedRequests(filters);
  if (requests.length === 0) return [];

  const supabase = await createClient();

  // Fetch bookmarks and submissions for the user in parallel
  const requestIds = requests.map((r) => r.id);

  const [{ data: bookmarks }, { data: submissions }] = await Promise.all([
    supabase
      .from("bounty_bookmarks")
      .select("request_id")
      .eq("contributor_id", userId)
      .in("request_id", requestIds),
    supabase
      .from("bounty_submissions")
      .select("request_id, id, status")
      .eq("contributor_id", userId)
      .in("request_id", requestIds),
  ]);

  const bookmarkSet = new Set(bookmarks?.map((b) => b.request_id) || []);
  const submissionMap = new Map(
    submissions?.map((s) => [s.request_id, { id: s.id, status: s.status }]) || []
  );

  return requests.map((r) => ({
    ...r,
    is_bookmarked: bookmarkSet.has(r.id),
    existing_submission_id: submissionMap.get(r.id)?.id || null,
    existing_submission_status: submissionMap.get(r.id)?.status || null,
  }));
}

export async function getRequestById(
  requestId: string
): Promise<BountyRequest | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bounty_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  return data as BountyRequest | null;
}

export async function getMySubmissions(
  userId: string,
  statusFilter?: string
): Promise<SubmissionWithRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bounty_submissions")
    .select(
      "*, bounty_requests(title, category, track_type, pay_type, pay_amount_cents, deadline)"
    )
    .eq("contributor_id", userId)
    .order("updated_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    if (statusFilter === "active") {
      query = query.in("status", ["draft", "submitted", "in_review"]);
    } else if (statusFilter === "completed") {
      query = query.in("status", ["accepted", "rejected"]);
    } else if (statusFilter === "needs_revision") {
      query = query.eq("status", "revision_requested");
    } else {
      query = query.eq("status", statusFilter);
    }
  }

  const { data } = await query;
  return (data as SubmissionWithRequest[]) || [];
}

export async function getSubmissionById(
  submissionId: string
): Promise<BountySubmission | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bounty_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();
  return data as BountySubmission | null;
}

export async function getSubmissionForRequest(
  userId: string,
  requestId: string
): Promise<BountySubmission | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bounty_submissions")
    .select("*")
    .eq("contributor_id", userId)
    .eq("request_id", requestId)
    .single();
  return data as BountySubmission | null;
}

export async function getSubmissionImages(
  submissionId: string
): Promise<SubmissionImage[]> {
  const supabase = await createClient();
  const { data: images } = await supabase
    .from("submission_images")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  if (!images || images.length === 0) return [];

  // Generate signed URLs
  const withUrls = await Promise.all(
    (images as SubmissionImage[]).map(async (img) => {
      const { data } = await supabase.storage
        .from(img.bucket)
        .createSignedUrl(img.file_path, 3600);
      return { ...img, signed_url: data?.signedUrl || undefined };
    })
  );

  return withUrls;
}

export async function getMarketplaceStats(
  userId: string
): Promise<MarketplaceStats> {
  const supabase = await createClient();

  const [{ count: openRequests }, { data: submissions }, { data: earnings }] =
    await Promise.all([
      supabase
        .from("bounty_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("bounty_submissions")
        .select("status")
        .eq("contributor_id", userId)
        .in("status", ["draft", "submitted", "in_review"]),
      supabase
        .from("bounty_submissions")
        .select("earned_amount_cents, bonus_amount_cents")
        .eq("contributor_id", userId)
        .eq("status", "accepted"),
    ]);

  const totalEarned = (earnings || []).reduce(
    (sum, e) => sum + (e.earned_amount_cents || 0) + (e.bonus_amount_cents || 0),
    0
  );

  return {
    openRequests: openRequests || 0,
    activeSubmissions: submissions?.length || 0,
    totalEarned,
  };
}

export async function getUserBookmarks(
  userId: string
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bounty_bookmarks")
    .select("request_id")
    .eq("contributor_id", userId);
  return new Set(data?.map((b) => b.request_id) || []);
}

export async function createSubmission(
  userId: string,
  requestId: string
): Promise<BountySubmission> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bounty_submissions")
    .insert({
      request_id: requestId,
      contributor_id: userId,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountySubmission;
}
