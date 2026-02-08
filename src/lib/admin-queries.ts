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

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  reviewer: 1,
  admin: 2,
  super_admin: 3,
};

/**
 * Require the user to have at minimum the given admin role.
 * Returns the role if authorized, or null if not.
 */
export async function requireAdmin(
  userId: string,
  minRole: AdminRole = "reviewer"
): Promise<AdminRole | null> {
  const role = await getAdminRole(userId);
  if (!role) return null;
  if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) return null;
  return role;
}

export async function getAllRequests(
  statusFilter?: string
): Promise<BountyRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bounty_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

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
    .select("*, contributors(full_name, display_name), submission_images(id)")
    .eq("request_id", requestId)
    .order("submitted_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data } = await query;
  if (!data) return [];

  const submissions = data as (BountySubmission & {
    contributors: { full_name: string; display_name: string | null } | null;
    submission_images: { id: string }[] | null;
  })[];

  return submissions.map((s) => ({
    ...s,
    contributor_name:
      s.contributors?.display_name || s.contributors?.full_name || "Unknown",
    image_count: s.submission_images?.length || 0,
    contributors: undefined,
    submission_images: undefined,
  })) as SubmissionWithContributor[];
}

export async function getAllPendingSubmissions(): Promise<
  (SubmissionWithContributor & { request_title: string })[]
> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("bounty_submissions")
    .select(
      "*, contributors(full_name, display_name), bounty_requests(title), submission_images(id)"
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true })
    .limit(100);

  if (!data) return [];

  const submissions = data as (BountySubmission & {
    contributors: { full_name: string; display_name: string | null } | null;
    bounty_requests: { title: string } | null;
    submission_images: { id: string }[] | null;
  })[];

  return submissions.map((s) => ({
    ...s,
    contributor_name:
      s.contributors?.display_name || s.contributors?.full_name || "Unknown",
    image_count: s.submission_images?.length || 0,
    request_title: s.bounty_requests?.title || "Unknown Request",
    contributors: undefined,
    bounty_requests: undefined,
    submission_images: undefined,
  })) as (SubmissionWithContributor & { request_title: string })[];
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

  const signedResults = await Promise.allSettled(
    ((images as SubmissionImage[]) || []).map(async (img) => {
      const { data } = await supabase.storage
        .from(img.bucket)
        .createSignedUrl(img.file_path, 3600);
      return { ...img, signed_url: data?.signedUrl || undefined };
    })
  );

  const signedImages = signedResults.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : { ...((images as SubmissionImage[]) || [])[i], signed_url: undefined }
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

    // Create earnings record first (can be cleaned up if budget update fails)
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

    // Optimistic locking: the WHERE clause includes the exact budget_spent_cents
    // and quantity_fulfilled values we read earlier. If another admin accepted
    // between our read and this write, the values will have changed and the
    // UPDATE will match 0 rows → .single() fails → we roll back.
    // The budget overflow check is also in the WHERE clause for defense in depth.
    const newBudgetSpent = req.budget_spent_cents + totalPayout;
    const newFulfilled = req.quantity_fulfilled + 1;

    if (newBudgetSpent > req.budget_total_cents) {
      await supabase.from("earnings").delete().eq("id", earning.id);
      throw new Error(
        `Accepting would exceed budget ($${(newBudgetSpent / 100).toFixed(2)} > $${(req.budget_total_cents / 100).toFixed(2)})`
      );
    }

    const requestUpdate: Record<string, unknown> = {
      budget_spent_cents: newBudgetSpent,
      quantity_fulfilled: newFulfilled,
      updated_at: now,
    };

    // Auto-fulfill if we've hit the target
    if (newFulfilled >= req.quantity_needed) {
      requestUpdate.status = "fulfilled";
    }

    const { data: updatedRequest, error: budgetErr } = await supabase
      .from("bounty_requests")
      .update(requestUpdate)
      .eq("id", s.request_id)
      .eq("budget_spent_cents", req.budget_spent_cents)
      .eq("quantity_fulfilled", req.quantity_fulfilled)
      .select("budget_spent_cents, quantity_fulfilled, quantity_needed")
      .single();

    if (budgetErr || !updatedRequest) {
      // Optimistic lock failed — another admin modified this request concurrently.
      // Roll back the earnings record.
      await supabase.from("earnings").delete().eq("id", earning.id);
      throw new Error(
        "This request was modified by another admin. Please refresh and try again."
      );
    }

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
  totalUsers: number;
  newSignupsToday: number;
  newSignupsThisWeek: number;
  newSignupsThisMonth: number;
  totalSubmissions: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createServiceClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: totalRequests },
    { count: draftRequests },
    { count: publishedRequests },
    { count: pausedRequests },
    { count: fulfilledRequests },
    { count: pendingReviews },
    { data: budgetData },
    { count: totalUsers },
    { count: newSignupsToday },
    { count: newSignupsThisWeek },
    { count: newSignupsThisMonth },
    { count: totalSubmissions },
  ] = await Promise.all([
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "paused"),
    supabase.from("bounty_requests").select("*", { count: "exact", head: true }).eq("status", "fulfilled"),
    supabase.from("bounty_submissions").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("bounty_requests").select("budget_total_cents, budget_spent_cents"),
    supabase.from("contributors").select("*", { count: "exact", head: true }),
    supabase.from("contributors").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("contributors").select("*", { count: "exact", head: true }).gte("created_at", weekStart),
    supabase.from("contributors").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("bounty_submissions").select("*", { count: "exact", head: true }),
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
    totalUsers: totalUsers || 0,
    newSignupsToday: newSignupsToday || 0,
    newSignupsThisWeek: newSignupsThisWeek || 0,
    newSignupsThisMonth: newSignupsThisMonth || 0,
    totalSubmissions: totalSubmissions || 0,
  };
}

// Recent admin activity feed
export interface AdminActivityItem {
  type: "signup" | "submission" | "published";
  title: string;
  description: string;
  timestamp: string;
}

export async function getRecentAdminActivity(
  limit = 10
): Promise<AdminActivityItem[]> {
  const supabase = await createServiceClient();

  const [
    { data: recentSignups },
    { data: recentSubmissions },
    { data: recentPublished },
  ] = await Promise.all([
    supabase
      .from("contributors")
      .select("full_name, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("bounty_submissions")
      .select("id, submitted_at, contributors(full_name, display_name), bounty_requests(title)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(limit),
    supabase
      .from("bounty_requests")
      .select("title, published_at")
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit),
  ]);

  const items: AdminActivityItem[] = [];

  for (const s of recentSignups || []) {
    items.push({
      type: "signup",
      title: "New signup",
      description: (s as { display_name: string | null; full_name: string }).display_name || (s as { full_name: string }).full_name,
      timestamp: (s as { created_at: string }).created_at,
    });
  }

  for (const sub of recentSubmissions || []) {
    const s = sub as unknown as {
      submitted_at: string | null;
      contributors: { full_name: string; display_name: string | null } | null;
      bounty_requests: { title: string } | null;
    };
    if (s.submitted_at) {
      items.push({
        type: "submission",
        title: "New submission",
        description: `${s.contributors?.display_name || s.contributors?.full_name || "Unknown"} submitted to "${s.bounty_requests?.title || "Unknown"}"`,
        timestamp: s.submitted_at,
      });
    }
  }

  for (const r of recentPublished || []) {
    const req = r as unknown as { title: string; published_at: string };
    items.push({
      type: "published",
      title: "Request published",
      description: req.title,
      timestamp: req.published_at,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, limit);
}

// User management queries
export interface ContributorListItem {
  id: string;
  full_name: string;
  email: string;
  display_name: string | null;
  sumsub_status: string;
  photo_count: number;
  onboarding_completed: boolean;
  suspended: boolean;
  flagged: boolean;
  created_at: string;
  submission_count: number;
  total_earned_cents: number;
}

export async function getAllContributors({
  search,
  verificationStatus,
  page = 1,
  pageSize = 20,
}: {
  search?: string;
  verificationStatus?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ contributors: ContributorListItem[]; total: number }> {
  const supabase = await createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contributors")
    .select("id, full_name, email, display_name, sumsub_status, photo_count, onboarding_completed, suspended, flagged, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }
  if (verificationStatus && verificationStatus !== "all") {
    query = query.eq("sumsub_status", verificationStatus);
  }

  const { data, count } = await query;

  if (!data) return { contributors: [], total: 0 };

  // Fetch submission counts and earnings for these users
  const userIds = data.map((c) => (c as { id: string }).id);

  const [{ data: submissionCounts }, { data: earningsSums }] = await Promise.all([
    supabase
      .from("bounty_submissions")
      .select("contributor_id")
      .in("contributor_id", userIds),
    supabase
      .from("earnings")
      .select("contributor_id, amount_cents")
      .in("contributor_id", userIds),
  ]);

  const subCountMap = new Map<string, number>();
  for (const s of submissionCounts || []) {
    const cid = (s as { contributor_id: string }).contributor_id;
    subCountMap.set(cid, (subCountMap.get(cid) || 0) + 1);
  }

  const earningsMap = new Map<string, number>();
  for (const e of earningsSums || []) {
    const rec = e as { contributor_id: string; amount_cents: number };
    earningsMap.set(rec.contributor_id, (earningsMap.get(rec.contributor_id) || 0) + rec.amount_cents);
  }

  const contributors: ContributorListItem[] = data.map((c) => {
    const row = c as {
      id: string;
      full_name: string;
      email: string;
      display_name: string | null;
      sumsub_status: string;
      photo_count: number;
      onboarding_completed: boolean;
      suspended: boolean;
      flagged: boolean;
      created_at: string;
    };
    return {
      ...row,
      submission_count: subCountMap.get(row.id) || 0,
      total_earned_cents: earningsMap.get(row.id) || 0,
    };
  });

  return { contributors, total: count || 0 };
}

export interface ContributorDetail {
  id: string;
  full_name: string;
  email: string;
  display_name: string | null;
  sumsub_status: string;
  instagram_username: string | null;
  photo_count: number;
  consent_given: boolean;
  consent_timestamp: string | null;
  onboarding_completed: boolean;
  opted_out: boolean;
  opted_out_at: string | null;
  last_login_at: string | null;
  suspended: boolean;
  suspended_at: string | null;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
  submission_count: number;
  total_earned_cents: number;
  pending_earned_cents: number;
  paid_earned_cents: number;
}

export async function getContributorAdmin(
  userId: string
): Promise<ContributorDetail | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("contributors")
    .select("*")
    .eq("id", userId)
    .single();

  if (!data) return null;

  const [{ count: submissionCount }, { data: earningsData }] = await Promise.all([
    supabase
      .from("bounty_submissions")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", userId),
    supabase
      .from("earnings")
      .select("amount_cents, status")
      .eq("contributor_id", userId),
  ]);

  let totalEarned = 0;
  let pendingEarned = 0;
  let paidEarned = 0;
  for (const e of earningsData || []) {
    const rec = e as { amount_cents: number; status: string };
    totalEarned += rec.amount_cents;
    if (rec.status === "pending" || rec.status === "processing") pendingEarned += rec.amount_cents;
    if (rec.status === "paid") paidEarned += rec.amount_cents;
  }

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    full_name: row.full_name as string,
    email: row.email as string,
    display_name: row.display_name as string | null,
    sumsub_status: row.sumsub_status as string,
    instagram_username: row.instagram_username as string | null,
    photo_count: row.photo_count as number,
    consent_given: row.consent_given as boolean,
    consent_timestamp: row.consent_timestamp as string | null,
    onboarding_completed: row.onboarding_completed as boolean,
    opted_out: row.opted_out as boolean,
    opted_out_at: row.opted_out_at as string | null,
    last_login_at: row.last_login_at as string | null,
    suspended: (row.suspended as boolean) || false,
    suspended_at: row.suspended_at as string | null,
    flagged: (row.flagged as boolean) || false,
    flag_reason: row.flag_reason as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    submission_count: submissionCount || 0,
    total_earned_cents: totalEarned,
    pending_earned_cents: pendingEarned,
    paid_earned_cents: paidEarned,
  };
}

export interface ContributorSubmissionItem {
  id: string;
  request_id: string;
  request_title: string;
  status: string;
  submitted_at: string | null;
  earned_amount_cents: number;
  bonus_amount_cents: number;
  created_at: string;
}

export async function getSubmissionsForContributor(
  contributorId: string
): Promise<ContributorSubmissionItem[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("bounty_submissions")
    .select("id, request_id, status, submitted_at, earned_amount_cents, bonus_amount_cents, created_at, bounty_requests(title)")
    .eq("contributor_id", contributorId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data) return [];

  return data.map((s) => {
    const row = s as unknown as {
      id: string;
      request_id: string;
      status: string;
      submitted_at: string | null;
      earned_amount_cents: number;
      bonus_amount_cents: number;
      created_at: string;
      bounty_requests: { title: string } | null;
    };
    return {
      ...row,
      request_title: row.bounty_requests?.title || "Unknown Request",
      bounty_requests: undefined,
    };
  }) as ContributorSubmissionItem[];
}

export async function suspendContributor(
  userId: string,
  suspend: boolean
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("contributors")
    .update({
      suspended: suspend,
      suspended_at: suspend ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function flagContributor(
  userId: string,
  flagged: boolean,
  reason?: string
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("contributors")
    .update({
      flagged,
      flag_reason: flagged ? (reason || null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

// Payout queries
export interface PayoutStats {
  pendingCents: number;
  pendingCount: number;
  processingCents: number;
  paidCents: number;
  heldCents: number;
}

export async function getPayoutStats(): Promise<PayoutStats> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("earnings")
    .select("amount_cents, status");

  const stats: PayoutStats = {
    pendingCents: 0,
    pendingCount: 0,
    processingCents: 0,
    paidCents: 0,
    heldCents: 0,
  };

  for (const e of data || []) {
    const rec = e as { amount_cents: number; status: string };
    switch (rec.status) {
      case "pending":
        stats.pendingCents += rec.amount_cents;
        stats.pendingCount++;
        break;
      case "processing": stats.processingCents += rec.amount_cents; break;
      case "paid": stats.paidCents += rec.amount_cents; break;
      case "held": stats.heldCents += rec.amount_cents; break;
    }
  }

  return stats;
}

export interface EarningListItem {
  id: string;
  contributor_id: string;
  contributor_name: string;
  contributor_email: string;
  amount_cents: number;
  status: string;
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

export async function getAllEarnings({
  statusFilter,
  page = 1,
  pageSize = 20,
}: {
  statusFilter?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ earnings: EarningListItem[]; total: number }> {
  const supabase = await createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("earnings")
    .select("id, contributor_id, amount_cents, status, description, paid_at, created_at, contributors(full_name, display_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, count } = await query;

  if (!data) return { earnings: [], total: 0 };

  const earnings: EarningListItem[] = data.map((e) => {
    const row = e as unknown as {
      id: string;
      contributor_id: string;
      amount_cents: number;
      status: string;
      description: string | null;
      paid_at: string | null;
      created_at: string;
      contributors: { full_name: string; display_name: string | null; email: string } | null;
    };
    return {
      id: row.id,
      contributor_id: row.contributor_id,
      contributor_name: row.contributors?.display_name || row.contributors?.full_name || "Unknown",
      contributor_email: row.contributors?.email || "",
      amount_cents: row.amount_cents,
      status: row.status,
      description: row.description,
      paid_at: row.paid_at,
      created_at: row.created_at,
    };
  });

  return { earnings, total: count || 0 };
}

export async function updateEarningStatus(
  earningId: string,
  newStatus: "pending" | "processing" | "paid" | "held"
): Promise<void> {
  const supabase = await createServiceClient();
  const updates: Record<string, unknown> = {
    status: newStatus,
  };
  if (newStatus === "paid") {
    updates.paid_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("earnings")
    .update(updates)
    .eq("id", earningId);

  if (error) throw new Error(error.message);
}
