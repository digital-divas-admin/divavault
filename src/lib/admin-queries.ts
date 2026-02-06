import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  AdminUser,
  AdminRole,
  BountyRequest,
  BountySubmission,
  SubmissionImage,
  RequestStatus,
} from "@/types/marketplace";
import { logActivity } from "@/lib/dashboard-queries";

export async function getAdminUser(
  userId: string
): Promise<AdminUser | null> {
  // Use service client to bypass RLS — admin_users has a self-referential
  // SELECT policy that would block reads via the session client.
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("admin_users")
    .select("*")
    .eq("id", userId)
    .single();
  return data as AdminUser | null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const admin = await getAdminUser(userId);
  return admin !== null;
}

export async function getAdminRole(
  userId: string
): Promise<AdminRole | null> {
  const admin = await getAdminUser(userId);
  return admin?.role || null;
}

export async function getAllRequests(
  statusFilter?: string
): Promise<BountyRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bounty_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data } = await query;
  return (data as BountyRequest[]) || [];
}

export async function createBountyRequest(
  adminId: string,
  request: {
    title: string;
    description: string;
    model_context?: string;
    category: string;
    track_type: string;
    pay_type: string;
    pay_amount_cents: number;
    set_size?: number;
    speed_bonus_cents?: number;
    speed_bonus_deadline?: string;
    quality_bonus_cents?: number;
    budget_total_cents: number;
    quantity_needed: number;
    min_resolution_width?: number;
    min_resolution_height?: number;
    quality_guidelines?: string;
    estimated_effort?: string;
    visibility?: string;
    deadline?: string;
    scenario_tags?: string[];
    setting_tags?: string[];
    status?: string;
  }
): Promise<BountyRequest> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bounty_requests")
    .insert({
      created_by: adminId,
      title: request.title,
      description: request.description,
      model_context: request.model_context || null,
      category: request.category,
      track_type: request.track_type,
      pay_type: request.pay_type,
      pay_amount_cents: request.pay_amount_cents,
      set_size: request.set_size || null,
      speed_bonus_cents: request.speed_bonus_cents || 0,
      speed_bonus_deadline: request.speed_bonus_deadline || null,
      quality_bonus_cents: request.quality_bonus_cents || 0,
      budget_total_cents: request.budget_total_cents,
      quantity_needed: request.quantity_needed,
      min_resolution_width: request.min_resolution_width || 1024,
      min_resolution_height: request.min_resolution_height || 1024,
      quality_guidelines: request.quality_guidelines || null,
      estimated_effort: request.estimated_effort || null,
      visibility: request.visibility || "open",
      deadline: request.deadline || null,
      scenario_tags: request.scenario_tags || [],
      setting_tags: request.setting_tags || [],
      status: request.status || "draft",
      published_at: request.status === "published" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountyRequest;
}

// --- New Phase 2 functions ---

export async function updateBountyRequest(
  requestId: string,
  updates: Partial<{
    title: string;
    description: string;
    model_context: string | null;
    category: string;
    track_type: string;
    pay_type: string;
    pay_amount_cents: number;
    set_size: number | null;
    speed_bonus_cents: number;
    speed_bonus_deadline: string | null;
    quality_bonus_cents: number;
    budget_total_cents: number;
    quantity_needed: number;
    min_resolution_width: number;
    min_resolution_height: number;
    quality_guidelines: string | null;
    estimated_effort: string | null;
    visibility: string;
    deadline: string | null;
    scenario_tags: string[];
    setting_tags: string[];
  }>
): Promise<BountyRequest> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bounty_requests")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["draft", "pending_review"])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountyRequest;
}

const VALID_TRANSITIONS: Record<string, RequestStatus[]> = {
  publish: ["draft", "pending_review"],
  pause: ["published"],
  unpause: ["paused"],
  close: ["published", "paused"],
  cancel: ["draft", "pending_review", "published", "paused"],
};

export async function publishBountyRequest(
  requestId: string,
  adminId: string
): Promise<BountyRequest> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("bounty_requests")
    .update({
      status: "published",
      published_at: now,
      reviewed_by: adminId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", requestId)
    .in("status", VALID_TRANSITIONS.publish)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountyRequest;
}

export async function pauseBountyRequest(
  requestId: string
): Promise<BountyRequest> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bounty_requests")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", VALID_TRANSITIONS.pause)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountyRequest;
}

export async function unpauseBountyRequest(
  requestId: string
): Promise<BountyRequest> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bounty_requests")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", VALID_TRANSITIONS.unpause)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountyRequest;
}

export async function closeBountyRequest(
  requestId: string
): Promise<BountyRequest> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bounty_requests")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", VALID_TRANSITIONS.close)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountyRequest;
}

export async function cancelBountyRequest(
  requestId: string
): Promise<BountyRequest> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("bounty_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", VALID_TRANSITIONS.cancel)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BountyRequest;
}

export interface SubmissionWithContributor extends BountySubmission {
  contributor_name: string;
  image_count: number;
}

export async function getSubmissionsForRequest(
  requestId: string,
  status?: string
): Promise<SubmissionWithContributor[]> {
  const supabase = await createServiceClient();
  let query = supabase
    .from("bounty_submissions")
    .select("*, contributors(full_name, display_name)")
    .eq("request_id", requestId)
    .order("submitted_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  if (!data) return [];

  // Get image counts in parallel
  const submissions = data as (BountySubmission & {
    contributors: { full_name: string; display_name: string | null } | null;
  })[];

  const withCounts = await Promise.all(
    submissions.map(async (s) => {
      const { count } = await supabase
        .from("submission_images")
        .select("*", { count: "exact", head: true })
        .eq("submission_id", s.id);

      return {
        ...s,
        contributor_name:
          s.contributors?.display_name || s.contributors?.full_name || "Unknown",
        image_count: count || 0,
        contributors: undefined,
      } as SubmissionWithContributor;
    })
  );

  return withCounts;
}

export async function getAllPendingSubmissions(): Promise<
  (SubmissionWithContributor & { request_title: string })[]
> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("bounty_submissions")
    .select(
      "*, contributors(full_name, display_name), bounty_requests(title)"
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });

  if (!data) return [];

  const submissions = data as (BountySubmission & {
    contributors: { full_name: string; display_name: string | null } | null;
    bounty_requests: { title: string } | null;
  })[];

  const withCounts = await Promise.all(
    submissions.map(async (s) => {
      const { count } = await supabase
        .from("submission_images")
        .select("*", { count: "exact", head: true })
        .eq("submission_id", s.id);

      return {
        ...s,
        contributor_name:
          s.contributors?.display_name || s.contributors?.full_name || "Unknown",
        image_count: count || 0,
        request_title: s.bounty_requests?.title || "Unknown Request",
        contributors: undefined,
        bounty_requests: undefined,
      } as SubmissionWithContributor & { request_title: string };
    })
  );

  return withCounts;
}

export interface SubmissionDetail extends BountySubmission {
  contributor_name: string;
  contributor_email: string;
  images: SubmissionImage[];
  request_title: string;
}

export async function getSubmissionWithImages(
  submissionId: string
): Promise<SubmissionDetail | null> {
  const supabase = await createServiceClient();

  const { data: submission } = await supabase
    .from("bounty_submissions")
    .select(
      "*, contributors(full_name, display_name, email), bounty_requests(title)"
    )
    .eq("id", submissionId)
    .single();

  if (!submission) return null;

  const s = submission as BountySubmission & {
    contributors: {
      full_name: string;
      display_name: string | null;
      email: string;
    } | null;
    bounty_requests: { title: string } | null;
  };

  // Fetch images with signed URLs
  const { data: images } = await supabase
    .from("submission_images")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  const signedImages = await Promise.all(
    ((images as SubmissionImage[]) || []).map(async (img) => {
      const { data } = await supabase.storage
        .from(img.bucket)
        .createSignedUrl(img.file_path, 3600);
      return { ...img, signed_url: data?.signedUrl || undefined };
    })
  );

  return {
    ...s,
    contributor_name:
      s.contributors?.display_name || s.contributors?.full_name || "Unknown",
    contributor_email: s.contributors?.email || "",
    images: signedImages,
    request_title: s.bounty_requests?.title || "Unknown Request",
    contributors: undefined,
    bounty_requests: undefined,
  } as unknown as SubmissionDetail;
}

export async function reviewSubmission(
  submissionId: string,
  action: "accept" | "reject" | "revision_requested",
  feedback: string | undefined,
  adminId: string,
  awardQualityBonus?: boolean
): Promise<BountySubmission> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Fetch the submission + request data
  const { data: submission, error: fetchErr } = await supabase
    .from("bounty_submissions")
    .select("*, bounty_requests(status, pay_type, pay_amount_cents, speed_bonus_cents, speed_bonus_deadline, quality_bonus_cents, quantity_needed, quantity_fulfilled, budget_total_cents, budget_spent_cents)")
    .eq("id", submissionId)
    .in("status", ["submitted", "in_review"])
    .single();

  if (fetchErr || !submission) {
    throw new Error("Submission not found or not reviewable");
  }

  const s = submission as BountySubmission & {
    bounty_requests: {
      status: string;
      pay_type: string;
      pay_amount_cents: number;
      speed_bonus_cents: number;
      speed_bonus_deadline: string | null;
      quality_bonus_cents: number;
      quantity_needed: number;
      quantity_fulfilled: number;
      budget_total_cents: number;
      budget_spent_cents: number;
    };
  };

  // Validate parent request is in a reviewable state
  const reviewableRequestStatuses = ["published", "paused", "fulfilled"];
  if (!reviewableRequestStatuses.includes(s.bounty_requests.status)) {
    throw new Error(
      `Cannot review submissions for a ${s.bounty_requests.status} request`
    );
  }

  if (action === "accept") {
    // Count images for this submission
    const { count: imageCount } = await supabase
      .from("submission_images")
      .select("*", { count: "exact", head: true })
      .eq("submission_id", submissionId);

    const req = s.bounty_requests;
    const earnedAmountCents =
      req.pay_type === "per_image"
        ? req.pay_amount_cents * (imageCount || 0)
        : req.pay_amount_cents;

    // Speed bonus: if submitted before the speed bonus deadline
    let speedBonus = 0;
    if (req.speed_bonus_cents > 0 && req.speed_bonus_deadline && s.submitted_at) {
      if (new Date(s.submitted_at) < new Date(req.speed_bonus_deadline)) {
        speedBonus = req.speed_bonus_cents;
      }
    }

    // Quality bonus: only if admin explicitly awards it
    const qualityBonus = awardQualityBonus ? (req.quality_bonus_cents || 0) : 0;
    const bonusAmountCents = speedBonus + qualityBonus;
    const totalPayout = earnedAmountCents + bonusAmountCents;

    // Budget overflow check — use current budget_spent_cents from the request row
    const newBudgetSpent = req.budget_spent_cents + totalPayout;
    if (newBudgetSpent > req.budget_total_cents) {
      throw new Error(
        `Accepting would exceed budget ($${(newBudgetSpent / 100).toFixed(2)} > $${(req.budget_total_cents / 100).toFixed(2)})`
      );
    }

    // Create earnings record
    const todayDate = now.split("T")[0]; // DATE column expects YYYY-MM-DD
    const { data: earning, error: earningErr } = await supabase
      .from("earnings")
      .insert({
        contributor_id: s.contributor_id,
        period_start: todayDate,
        period_end: todayDate,
        amount_cents: totalPayout,
        currency: "USD",
        status: "pending",
        description: `Bounty: ${s.request_id}`,
      })
      .select()
      .single();

    if (earningErr) throw new Error(earningErr.message);

    // Update submission
    const { data: updated, error: updateErr } = await supabase
      .from("bounty_submissions")
      .update({
        status: "accepted",
        reviewed_by: adminId,
        reviewed_at: now,
        review_feedback: feedback || null,
        earned_amount_cents: earnedAmountCents,
        bonus_amount_cents: bonusAmountCents,
        earning_id: earning.id,
        updated_at: now,
      })
      .eq("id", submissionId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // Increment quantity_fulfilled + budget_spent on the request
    // Use current values from the fetched row (not a re-query) to avoid double-counting
    const newFulfilled = req.quantity_fulfilled + 1;
    const requestUpdate: Record<string, unknown> = {
      quantity_fulfilled: newFulfilled,
      budget_spent_cents: newBudgetSpent,
      updated_at: now,
    };

    // Auto-fulfill if we've hit the target
    if (newFulfilled >= req.quantity_needed) {
      requestUpdate.status = "fulfilled";
    }

    await supabase
      .from("bounty_requests")
      .update(requestUpdate)
      .eq("id", s.request_id);

    // Log activity for contributor
    await logActivity(
      s.contributor_id,
      "submission_accepted",
      `Your submission was accepted! You earned $${(totalPayout / 100).toFixed(2)}.`,
      { submission_id: submissionId, request_id: s.request_id, earned: earnedAmountCents, bonus: bonusAmountCents }
    );

    return updated as BountySubmission;
  }

  // Reject or revision_requested
  const newStatus = action === "reject" ? "rejected" : "revision_requested";

  const { data: updated, error: updateErr } = await supabase
    .from("bounty_submissions")
    .update({
      status: newStatus,
      reviewed_by: adminId,
      reviewed_at: now,
      review_feedback: feedback || null,
      updated_at: now,
    })
    .eq("id", submissionId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  const activityAction =
    action === "reject" ? "submission_rejected" : "submission_revision_requested";
  const activityDesc =
    action === "reject"
      ? "Your submission was not accepted. Check the feedback for details."
      : "Your submission needs some changes. Check the feedback and resubmit.";

  await logActivity(s.contributor_id, activityAction, activityDesc, {
    submission_id: submissionId,
    request_id: s.request_id,
    feedback: feedback || null,
  });

  return updated as BountySubmission;
}

// Admin dashboard stats
export interface AdminStats {
  totalRequests: number;
  draftRequests: number;
  publishedRequests: number;
  pausedRequests: number;
  fulfilledRequests: number;
  pendingReviews: number;
  budgetTotal: number;
  budgetSpent: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createServiceClient();

  const [
    { count: totalRequests },
    { count: draftRequests },
    { count: publishedRequests },
    { count: pausedRequests },
    { count: fulfilledRequests },
    { count: pendingReviews },
    { data: budgetData },
  ] = await Promise.all([
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "paused"),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "fulfilled"),
    supabase.from("bounty_submissions").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("bounty_requests").select("budget_total_cents, budget_spent_cents"),
  ]);

  const budgetTotal = (budgetData || []).reduce((s, r) => s + (r.budget_total_cents || 0), 0);
  const budgetSpent = (budgetData || []).reduce((s, r) => s + (r.budget_spent_cents || 0), 0);

  return {
    totalRequests: totalRequests || 0,
    draftRequests: draftRequests || 0,
    publishedRequests: publishedRequests || 0,
    pausedRequests: pausedRequests || 0,
    fulfilledRequests: fulfilledRequests || 0,
    pendingReviews: pendingReviews || 0,
    budgetTotal,
    budgetSpent,
  };
}
