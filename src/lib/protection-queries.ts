import { createClient } from "@/lib/supabase/server";
import type {
  ProtectionStats,
  ContributorMatch,
  ContributorMatchDetail,
  ProtectionActivity,
} from "@/types/protection";

export async function getProtectionStats(
  userId: string
): Promise<ProtectionStats> {
  const supabase = await createClient();

  const [matchesRes, newMatchesRes, takedownsRes, scanJobsRes, scheduleRes] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("contributor_id", userId),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("contributor_id", userId)
        .eq("status", "new"),
      supabase
        .from("takedowns")
        .select("id, status", { count: "exact" })
        .eq("contributor_id", userId),
      supabase
        .from("scan_jobs")
        .select("images_processed")
        .eq("contributor_id", userId)
        .eq("status", "completed"),
      supabase
        .from("scan_schedule")
        .select("last_scan_at, next_scan_at")
        .eq("contributor_id", userId)
        .limit(1)
        .maybeSingle(),
    ]);

  const imagesScanned =
    scanJobsRes.data?.reduce(
      (sum: number, j: { images_processed: number | null }) =>
        sum + (j.images_processed || 0),
      0
    ) || 0;

  const takedownsFiled = takedownsRes.count || 0;
  const takedownsResolved =
    takedownsRes.data?.filter(
      (t: { status: string }) =>
        t.status === "completed" || t.status === "removed"
    ).length || 0;

  // Count monitored platforms from crawl schedule
  const { count: platformCount } = await supabase
    .from("platform_crawl_schedule")
    .select("platform", { count: "exact", head: true })
    .eq("enabled", true);

  return {
    matchCount: matchesRes.count || 0,
    newMatchCount: newMatchesRes.count || 0,
    imagesScanned,
    platformsMonitored: platformCount || 0,
    takedownsFiled,
    takedownsResolved,
    lastScanAt: scheduleRes.data?.last_scan_at || null,
    nextScanAt: scheduleRes.data?.next_scan_at || null,
  };
}

export async function getContributorMatches(
  userId: string,
  options: {
    status?: string;
    confidence?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ matches: ContributorMatch[]; total: number }> {
  const supabase = await createClient();
  const { status, confidence, page = 1, pageSize = 20 } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("matches")
    .select(
      `
      *,
      discovered_images!inner (
        platform,
        source_url,
        page_url,
        page_title
      )
    `,
      { count: "exact" }
    )
    .eq("contributor_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (confidence) {
    query = query.eq("confidence_tier", confidence);
  }

  const { data, count } = await query;

  const matches: ContributorMatch[] = (data || []).map(
    (row: Record<string, unknown>) => {
      const di = row.discovered_images as Record<string, unknown> | null;
      return {
        id: row.id as string,
        discovered_image_id: row.discovered_image_id as string,
        contributor_id: row.contributor_id as string,
        similarity_score: row.similarity_score as number,
        confidence_tier: row.confidence_tier as string,
        is_ai_generated: row.is_ai_generated as boolean | null,
        ai_detection_score: row.ai_detection_score as number | null,
        ai_generator: row.ai_generator as string | null,
        status: row.status as string,
        reviewed_at: row.reviewed_at as string | null,
        created_at: row.created_at as string,
        platform: (di?.platform as string) || null,
        source_url: (di?.source_url as string) || null,
        page_url: (di?.page_url as string) || null,
        page_title: (di?.page_title as string) || null,
      };
    }
  );

  return { matches, total: count || 0 };
}

export async function getContributorMatchDetail(
  userId: string,
  matchId: string
): Promise<ContributorMatchDetail | null> {
  const supabase = await createClient();

  const { data: matchData } = await supabase
    .from("matches")
    .select(
      `
      *,
      discovered_images!inner (
        platform,
        source_url,
        page_url,
        page_title
      )
    `
    )
    .eq("id", matchId)
    .eq("contributor_id", userId)
    .single();

  if (!matchData) return null;

  const [evidenceRes, takedownRes] = await Promise.all([
    supabase
      .from("evidence")
      .select("*")
      .eq("match_id", matchId)
      .order("captured_at", { ascending: false }),
    supabase
      .from("takedowns")
      .select("*")
      .eq("match_id", matchId)
      .eq("contributor_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const di = matchData.discovered_images as Record<string, unknown> | null;

  return {
    id: matchData.id,
    discovered_image_id: matchData.discovered_image_id,
    contributor_id: matchData.contributor_id,
    similarity_score: matchData.similarity_score,
    confidence_tier: matchData.confidence_tier,
    is_ai_generated: matchData.is_ai_generated,
    ai_detection_score: matchData.ai_detection_score,
    ai_generator: matchData.ai_generator,
    status: matchData.status,
    reviewed_at: matchData.reviewed_at,
    created_at: matchData.created_at,
    platform: (di?.platform as string) || null,
    source_url: (di?.source_url as string) || null,
    page_url: (di?.page_url as string) || null,
    page_title: (di?.page_title as string) || null,
    evidence: evidenceRes.data || [],
    takedowns: takedownRes.data || [],
  };
}

export async function getProtectionActivityFeed(
  userId: string,
  limit = 10
): Promise<ProtectionActivity[]> {
  const supabase = await createClient();
  const activities: ProtectionActivity[] = [];

  // Get recent scan jobs for this user, grouped by source + time window
  const { data: scans } = await supabase
    .from("scan_jobs")
    .select("id, source_name, images_processed, matches_found, completed_at, status")
    .eq("contributor_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(100);

  // Group scans by source_name + 5-minute window
  const scanGroups = new Map<
    string,
    { id: string; source: string; images: number; matches: number; timestamp: string }
  >();
  for (const scan of scans || []) {
    const ts = new Date(scan.completed_at || 0);
    // Round to 5-minute bucket
    const bucket = new Date(
      Math.floor(ts.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)
    ).toISOString();
    const key = `${scan.source_name}-${bucket}`;
    const existing = scanGroups.get(key);
    if (existing) {
      existing.images += scan.images_processed || 0;
      existing.matches += scan.matches_found || 0;
    } else {
      scanGroups.set(key, {
        id: scan.id,
        source: scan.source_name || "platform",
        images: scan.images_processed || 0,
        matches: scan.matches_found || 0,
        timestamp: scan.completed_at || "",
      });
    }
  }

  for (const group of scanGroups.values()) {
    activities.push({
      id: group.id,
      type: "scan",
      title: `Scanned ${group.source}`,
      description: `Processed ${group.images} images${group.matches ? `, found ${group.matches} match${group.matches > 1 ? "es" : ""}` : ""}`,
      timestamp: group.timestamp,
    });
  }

  // Get recent matches
  const { data: matches } = await supabase
    .from("matches")
    .select("id, status, similarity_score, created_at, discovered_images!inner(platform)")
    .eq("contributor_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const match of matches || []) {
    const di = match.discovered_images as unknown as Record<string, unknown> | null;
    activities.push({
      id: match.id,
      type: "match",
      title: `Match found on ${(di?.platform as string) || "unknown platform"}`,
      description: `${Math.round(match.similarity_score * 100)}% similarity`,
      timestamp: match.created_at,
    });
  }

  // Get recent takedowns
  const { data: takedowns } = await supabase
    .from("takedowns")
    .select("id, platform, status, submitted_at, resolved_at, created_at")
    .eq("contributor_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const td of takedowns || []) {
    activities.push({
      id: td.id,
      type: "takedown",
      title: `Takedown ${td.status} on ${td.platform}`,
      description:
        td.status === "completed" || td.status === "removed"
          ? "Content successfully removed"
          : td.status === "pending"
            ? "Takedown request submitted"
            : `Status: ${td.status}`,
      timestamp: td.resolved_at || td.submitted_at || td.created_at,
    });
  }

  // Sort by timestamp descending and limit
  return activities
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, limit);
}

export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("scanner_notifications")
    .select("id", { count: "exact", head: true })
    .eq("contributor_id", userId)
    .eq("read", false);
  return count || 0;
}
