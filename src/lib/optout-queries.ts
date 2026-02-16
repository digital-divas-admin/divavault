import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AI_COMPANIES, AI_COMPANIES_MAP } from "@/lib/ai-companies";
import type {
  OptOutRequest,
  OptOutCompanyView,
  OptOutStats,
  OptOutRequestDetail,
  OptOutCommunication,
} from "@/types/optout";

// ---------------------------------------------------------------------------
// Opt-out database query helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all opt-out requests for a user, ordered by most recent first.
 */
export async function getOptOutRequests(
  userId: string
): Promise<OptOutRequest[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("opt_out_requests")
    .select("*")
    .eq("contributor_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[optout-queries] getOptOutRequests error:", error);
    return [];
  }

  return (data || []) as OptOutRequest[];
}

/**
 * Build a merged view of all AI companies with the user's opt-out status.
 *
 * For each company in the static registry, left-joins the user's request
 * (if one exists), counts communications, and finds the latest activity date.
 * Results are sorted: pending statuses first, then not_started, then completed.
 */
export async function getOptOutCompanyViews(
  userId: string
): Promise<OptOutCompanyView[]> {
  const supabase = await createClient();

  // Fetch all user requests in one query
  const { data: requests } = await supabase
    .from("opt_out_requests")
    .select("*")
    .eq("contributor_id", userId);

  // Build a lookup by company_slug
  const requestMap = new Map<string, OptOutRequest>();
  for (const req of (requests || []) as OptOutRequest[]) {
    requestMap.set(req.company_slug, req);
  }

  // Fetch communication counts per request
  const requestIds = (requests || []).map((r) => r.id);
  let commCountMap = new Map<string, number>();
  let commLatestMap = new Map<string, string>();

  if (requestIds.length > 0) {
    const { data: comms } = await supabase
      .from("opt_out_communications")
      .select("request_id, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: false });

    for (const comm of comms || []) {
      const rid = comm.request_id as string;
      commCountMap.set(rid, (commCountMap.get(rid) || 0) + 1);
      if (!commLatestMap.has(rid)) {
        commLatestMap.set(rid, comm.created_at as string);
      }
    }
  }

  // Merge companies with requests
  const views: OptOutCompanyView[] = AI_COMPANIES.map((company) => {
    const request = requestMap.get(company.slug) || null;
    const communicationCount = request
      ? commCountMap.get(request.id) || 0
      : 0;
    const lastActivity = request
      ? commLatestMap.get(request.id) || request.updated_at
      : null;

    return {
      company,
      request,
      communicationCount,
      lastActivity,
    };
  });

  // Sort: pending first, then not_started, then completed/confirmed
  const statusOrder: Record<string, number> = {
    sent: 0,
    follow_up_sent: 0,
    denied: 1,
    unresponsive: 1,
    not_started: 2,
    confirmed: 3,
    completed_web: 3,
    completed_settings: 3,
  };

  views.sort((a, b) => {
    const aStatus = a.request?.status || "not_started";
    const bStatus = b.request?.status || "not_started";
    const aOrder = statusOrder[aStatus] ?? 2;
    const bOrder = statusOrder[bStatus] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Within the same group, sort alphabetically by company name
    return a.company.name.localeCompare(b.company.name);
  });

  return views;
}

/**
 * Compute aggregate opt-out statistics for a user.
 */
export async function getOptOutStats(
  userId: string
): Promise<OptOutStats> {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("opt_out_requests")
    .select("status")
    .eq("contributor_id", userId);

  const allRequests = (requests || []) as { status: string }[];
  const totalCompanies = AI_COMPANIES.length;

  const contacted = allRequests.filter(
    (r) => r.status !== "not_started"
  ).length;

  const confirmedStatuses = new Set([
    "confirmed",
    "completed_web",
    "completed_settings",
  ]);
  const confirmed = allRequests.filter((r) =>
    confirmedStatuses.has(r.status)
  ).length;

  const pendingStatuses = new Set(["sent", "follow_up_sent"]);
  const pending = allRequests.filter((r) =>
    pendingStatuses.has(r.status)
  ).length;

  const successRate =
    totalCompanies > 0
      ? Math.round((confirmed / totalCompanies) * 100)
      : 0;

  return {
    totalCompanies,
    contacted,
    confirmed,
    pending,
    successRate,
  };
}

/**
 * Fetch a single opt-out request with its communications and company info.
 */
export async function getOptOutRequestDetail(
  userId: string,
  requestId: string
): Promise<OptOutRequestDetail | null> {
  const supabase = await createClient();

  const { data: requestData, error } = await supabase
    .from("opt_out_requests")
    .select("*")
    .eq("id", requestId)
    .eq("contributor_id", userId)
    .single();

  if (error || !requestData) return null;

  const request = requestData as OptOutRequest;
  const company = AI_COMPANIES_MAP[request.company_slug];

  if (!company) return null;

  const { data: commsData } = await supabase
    .from("opt_out_communications")
    .select("*")
    .eq("request_id", requestId)
    .eq("contributor_id", userId)
    .order("created_at", { ascending: true });

  const communications = (commsData || []) as OptOutCommunication[];

  return {
    request,
    company,
    communications,
  };
}

/**
 * Find opt-out requests that are due for a follow-up email.
 *
 * Used by the cron job. Uses the service client to bypass RLS.
 * Finds requests where:
 *   - status is 'sent' or 'follow_up_sent'
 *   - last_sent_at is older than follow_up_days ago
 *   - follow_up_count < max_follow_ups
 */
export async function getPendingFollowUps(): Promise<OptOutRequest[]> {
  const serviceClient = await createServiceClient();

  const { data, error } = await serviceClient
    .from("opt_out_requests")
    .select("*")
    .in("status", ["sent", "follow_up_sent"]);

  if (error) {
    console.error("[optout-queries] getPendingFollowUps error:", error);
    return [];
  }

  const now = Date.now();
  const results: OptOutRequest[] = [];

  for (const row of (data || []) as OptOutRequest[]) {
    if (!row.last_sent_at) continue;
    if (row.follow_up_count >= row.max_follow_ups) continue;

    const lastSent = new Date(row.last_sent_at).getTime();
    const followUpMs = row.follow_up_days * 24 * 60 * 60 * 1000;

    if (now - lastSent >= followUpMs) {
      results.push(row);
    }
  }

  return results;
}
