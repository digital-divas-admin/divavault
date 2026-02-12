import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  ProtectionStats,
  ContributorMatch,
  ContributorMatchDetail,
  ProtectionActivity,
  MatchesPageStats,
} from "@/types/protection";
import type { ProtectionScore } from "@/types/protection-score";

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
    platform?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ matches: ContributorMatch[]; total: number }> {
  const supabase = await createClient();
  const { status, confidence, platform, page = 1, pageSize = 20 } = options;
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
  if (confidence && confidence !== "all") {
    query = query.eq("confidence_tier", confidence);
  }
  if (platform && platform !== "all") {
    query = query.eq("discovered_images.platform", platform);
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

export async function getMatchesPageStats(
  userId: string
): Promise<MatchesPageStats> {
  const supabase = await createClient();

  const [totalRes, newRes, activeTdRes, resolvedTdRes, highRes, platformRes] =
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
        .select("id", { count: "exact", head: true })
        .eq("contributor_id", userId)
        .in("status", ["pending", "submitted"]),
      supabase
        .from("takedowns")
        .select("id", { count: "exact", head: true })
        .eq("contributor_id", userId)
        .in("status", ["completed", "removed"]),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("contributor_id", userId)
        .eq("confidence_tier", "high"),
      supabase
        .from("matches")
        .select("discovered_images!inner(platform)")
        .eq("contributor_id", userId),
    ]);

  const totalMatches = totalRes.count || 0;
  const newMatches = newRes.count || 0;
  const activeTakedowns = activeTdRes.count || 0;
  const resolvedTakedowns = resolvedTdRes.count || 0;
  const highConfidenceCount = highRes.count || 0;

  const totalTakedowns = activeTakedowns + resolvedTakedowns;
  const successRate =
    totalTakedowns > 0
      ? Math.round((resolvedTakedowns / totalTakedowns) * 100)
      : 0;

  // Build platform breakdown
  const platformCounts = new Map<string, number>();
  for (const row of platformRes.data || []) {
    const di = row.discovered_images as unknown as Record<string, unknown>;
    const p = (di?.platform as string) || "unknown";
    platformCounts.set(p, (platformCounts.get(p) || 0) + 1);
  }
  const platformBreakdown = Array.from(platformCounts.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalMatches,
    newMatches,
    activeTakedowns,
    resolvedTakedowns,
    successRate,
    highConfidenceCount,
    platformBreakdown,
  };
}

export async function getDistinctPlatforms(
  userId: string
): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("matches")
    .select("discovered_images!inner(platform)")
    .eq("contributor_id", userId);

  const platforms = new Set<string>();
  for (const row of data || []) {
    const di = row.discovered_images as unknown as Record<string, unknown>;
    const p = di?.platform as string;
    if (p) platforms.add(p);
  }

  return Array.from(platforms).sort();
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

export async function getProtectionScore(
  userId: string
): Promise<ProtectionScore> {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // Look up the contributor row for this auth user
  const { data: contributor } = await supabase
    .from("contributors")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  const contributorId = contributor?.id || userId;

  // Query three data sources in parallel
  const [imagesRes, uploadsRes, embeddingsRes] = await Promise.all([
    // contributor_images: capture_step + quality_score
    supabase
      .from("contributor_images")
      .select("capture_step, quality_score")
      .eq("contributor_id", contributorId),
    // uploads: count + embedding_status
    supabase
      .from("uploads")
      .select("id, embedding_status")
      .eq("contributor_id", contributorId),
    // contributor_embeddings: count by embedding_type (use service client for RLS)
    serviceClient
      .from("contributor_embeddings")
      .select("id, embedding_type")
      .eq("contributor_id", contributorId),
  ]);

  const images = imagesRes.data || [];
  const uploads = uploadsRes.data || [];
  const embeddings = embeddingsRes.data || [];

  // --- Angle coverage (30 pts, 6 per angle) ---
  const angleSteps = [
    "face_front",
    "face_left",
    "face_right",
    "face_up",
    "face_down",
  ] as const;
  const angleLabelMap: Record<string, string> = {
    face_front: "front",
    face_left: "left profile",
    face_right: "right profile",
    face_up: "upward tilt",
    face_down: "downward tilt",
  };
  const capturedSteps = new Set(images.map((img) => img.capture_step));
  const coveredAngles = angleSteps.filter((s) => capturedSteps.has(s));
  const missingAngles = angleSteps.filter((s) => !capturedSteps.has(s));
  const angleCoverageScore = coveredAngles.length * 6;

  // --- Expression coverage (15 pts, 5 per expression) ---
  const expressionSteps = [
    "expression_smile",
    "expression_neutral",
    "expression_serious",
  ] as const;
  const expressionLabelMap: Record<string, string> = {
    expression_smile: "smiling",
    expression_neutral: "neutral",
    expression_serious: "serious",
  };
  const coveredExpressions = expressionSteps.filter((s) =>
    capturedSteps.has(s)
  );
  const missingExpressions = expressionSteps.filter(
    (s) => !capturedSteps.has(s)
  );
  const expressionCoverageScore = coveredExpressions.length * 5;

  // --- Photo count (20 pts, 1 per photo, cap 20) ---
  const totalPhotoCount = images.length + uploads.length;
  const photoCountScore = Math.min(totalPhotoCount, 20);

  // --- Average quality (15 pts) ---
  const qualityScores = images
    .map((img) => img.quality_score)
    .filter((q): q is number => q !== null && q !== undefined);
  const avgQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length
      : 0;
  const averageQualityScore = Math.round(avgQuality * 15 * 100) / 100;

  // --- Centroid computed (10 pts) ---
  const hasCentroid = embeddings.some(
    (e) => e.embedding_type === "centroid"
  );
  const centroidScore = hasCentroid ? 10 : 0;

  // --- Embedding success rate (10 pts) ---
  const totalItems = totalPhotoCount;
  const successfulEmbeddings = embeddings.filter(
    (e) => e.embedding_type !== "centroid"
  ).length;
  const embeddingRate =
    totalItems > 0 ? successfulEmbeddings / totalItems : 0;
  const embeddingSuccessScore =
    Math.round(Math.min(embeddingRate, 1) * 10 * 100) / 100;

  // --- Total score ---
  const totalScore = Math.round(
    angleCoverageScore +
      expressionCoverageScore +
      photoCountScore +
      averageQualityScore +
      centroidScore +
      embeddingSuccessScore
  );

  // --- Tier mapping ---
  let tier: ProtectionScore["tier"];
  if (totalScore >= 85) tier = "excellent";
  else if (totalScore >= 70) tier = "strong";
  else if (totalScore >= 50) tier = "good";
  else if (totalScore >= 25) tier = "basic";
  else tier = "minimal";

  // --- Suggestions ---
  const suggestions: string[] = [];

  for (const step of missingAngles) {
    const label = angleLabelMap[step] || step;
    suggestions.push(
      `Add a ${label} photo to improve angle coverage`
    );
  }

  for (const step of missingExpressions) {
    const label = expressionLabelMap[step] || step;
    suggestions.push(
      `Add a ${label} photo to improve expression diversity`
    );
  }

  if (totalPhotoCount < 10) {
    suggestions.push(
      "Upload more photos to strengthen your facial signature"
    );
  }

  if (!hasCentroid) {
    suggestions.push(
      "Your photos will generate a centroid embedding once 3+ are processed"
    );
  }

  if (qualityScores.length > 0 && avgQuality < 0.7) {
    suggestions.push(
      "Retake some photos in better lighting to improve quality scores"
    );
  }

  if (totalItems > 0 && embeddingRate < 0.8) {
    suggestions.push(
      "Some photos failed embedding processing — consider replacing low-quality images"
    );
  }

  return {
    score: totalScore,
    breakdown: {
      angleCoverage: {
        score: angleCoverageScore,
        max: 30,
        covered: coveredAngles.map((s) => angleLabelMap[s] || s),
        missing: missingAngles.map((s) => angleLabelMap[s] || s),
      },
      expressionCoverage: {
        score: expressionCoverageScore,
        max: 15,
        covered: coveredExpressions.map(
          (s) => expressionLabelMap[s] || s
        ),
        missing: missingExpressions.map(
          (s) => expressionLabelMap[s] || s
        ),
      },
      photoCount: {
        score: photoCountScore,
        max: 20,
        count: totalPhotoCount,
      },
      averageQuality: {
        score: averageQualityScore,
        max: 15,
        avgQuality: Math.round(avgQuality * 100) / 100,
      },
      centroidComputed: {
        score: centroidScore,
        max: 10,
        exists: hasCentroid,
      },
      embeddingSuccessRate: {
        score: embeddingSuccessScore,
        max: 10,
        rate: Math.round(embeddingRate * 100) / 100,
      },
    },
    suggestions,
    tier,
  };
}
