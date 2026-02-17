import { createServiceClient } from "@/lib/supabase/server";

// --- Interfaces ---

export interface ScannerStats {
  // Embedding pipeline
  totalEmbeddings: number;
  pendingEmbeddings: number;
  failedEmbeddings: number;
  contributorsProtected: number;
  // Scan activity (24h)
  scansCompleted24h: number;
  scansRunning: number;
  scansFailed24h: number;
  // Matches
  totalMatches: number;
  newMatches: number;
  highConfidenceNew: number;
  aiGeneratedMatches: number;
  // Takedowns
  takedownsPending: number;
  takedownsSubmitted: number;
  takedownsResolved: number;
  // Registry
  registrySelfiesPending: number;
  registryWithEmbedding: number;
  registryMatches24h: number;
  // System
  discoveredImages: number;
  scheduledScans: number;
  crawlSchedules: number;
}

export async function getScannerStats(): Promise<ScannerStats> {
  const supabase = await createServiceClient();

  const now = new Date();
  const twentyFourHoursAgo = new Date(
    now.getTime() - 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    // Embedding pipeline
    { count: totalEmbeddings },
    { count: pendingEmbeddingsImg },
    { count: pendingEmbeddingsUpload },
    { count: failedEmbeddingsImg },
    { count: failedEmbeddingsUpload },
    { data: contributorEmbeddingIds },
    // Scan activity
    { count: scansCompleted24h },
    { count: scansRunning },
    { count: scansFailed24h },
    // Matches
    { count: totalMatches },
    { count: newMatches },
    { count: highConfidenceNew },
    { count: aiGeneratedMatches },
    // Takedowns
    { count: takedownsPending },
    { count: takedownsSubmitted },
    { count: takedownsResolved },
    // Registry
    { count: registrySelfiesPending },
    { count: registryWithEmbedding },
    { count: registryMatches24h },
    // System
    { count: discoveredImages },
    { count: scheduledScans },
    { count: crawlSchedules },
  ] = await Promise.all([
    // Embedding pipeline
    supabase
      .from("contributor_embeddings")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("contributor_images")
      .select("*", { count: "exact", head: true })
      .eq("embedding_status", "pending"),
    supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .eq("embedding_status", "pending"),
    supabase
      .from("contributor_images")
      .select("*", { count: "exact", head: true })
      .eq("embedding_status", "failed"),
    supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .eq("embedding_status", "failed"),
    supabase
      .from("contributor_embeddings")
      .select("contributor_id"),
    // Scan activity (24h)
    supabase
      .from("scan_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", twentyFourHoursAgo),
    supabase
      .from("scan_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "running"),
    supabase
      .from("scan_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", twentyFourHoursAgo),
    // Matches
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("status", "new")
      .eq("confidence_tier", "high"),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("is_ai_generated", true),
    // Takedowns
    supabase
      .from("takedowns")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("takedowns")
      .select("*", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("takedowns")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved"),
    // Registry
    supabase
      .from("registry_identities")
      .select("*", { count: "exact", head: true })
      .eq("embedding_status", "pending"),
    supabase
      .from("registry_identities")
      .select("*", { count: "exact", head: true })
      .not("face_embedding", "is", null),
    supabase
      .from("registry_matches")
      .select("*", { count: "exact", head: true })
      .gte("discovered_at", twentyFourHoursAgo),
    // System
    supabase
      .from("discovered_images")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("scan_schedule")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("platform_crawl_schedule")
      .select("*", { count: "exact", head: true }),
  ]);

  // Dedupe contributor IDs in JS
  const uniqueContributors = new Set(
    (contributorEmbeddingIds || []).map(
      (r) => (r as { contributor_id: string }).contributor_id
    )
  );

  return {
    totalEmbeddings: totalEmbeddings || 0,
    pendingEmbeddings: (pendingEmbeddingsImg || 0) + (pendingEmbeddingsUpload || 0),
    failedEmbeddings: (failedEmbeddingsImg || 0) + (failedEmbeddingsUpload || 0),
    contributorsProtected: uniqueContributors.size,
    scansCompleted24h: scansCompleted24h || 0,
    scansRunning: scansRunning || 0,
    scansFailed24h: scansFailed24h || 0,
    totalMatches: totalMatches || 0,
    newMatches: newMatches || 0,
    highConfidenceNew: highConfidenceNew || 0,
    aiGeneratedMatches: aiGeneratedMatches || 0,
    takedownsPending: takedownsPending || 0,
    takedownsSubmitted: takedownsSubmitted || 0,
    takedownsResolved: takedownsResolved || 0,
    registrySelfiesPending: registrySelfiesPending || 0,
    registryWithEmbedding: registryWithEmbedding || 0,
    registryMatches24h: registryMatches24h || 0,
    discoveredImages: discoveredImages || 0,
    scheduledScans: scheduledScans || 0,
    crawlSchedules: crawlSchedules || 0,
  };
}

// --- Matches ---

export interface MatchListItem {
  id: string;
  contributor_name: string;
  contributor_id: string;
  source_url: string;
  page_url: string | null;
  platform: string | null;
  similarity_score: number;
  confidence_tier: string;
  is_ai_generated: boolean | null;
  ai_detection_score: number | null;
  status: string;
  created_at: string;
}

export async function getAllMatches({
  confidence,
  status,
  ai,
  page = 1,
  pageSize = 20,
}: {
  confidence?: string;
  status?: string;
  ai?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ matches: MatchListItem[]; total: number }> {
  const supabase = await createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("matches")
    .select(
      "id, contributor_id, similarity_score, confidence_tier, is_ai_generated, ai_detection_score, status, created_at, contributors(full_name, display_name), discovered_images(source_url, page_url, platform)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (confidence && confidence !== "all") {
    query = query.eq("confidence_tier", confidence);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (ai === "true") {
    query = query.eq("is_ai_generated", true);
  }

  const { data, count } = await query;

  if (!data) return { matches: [], total: 0 };

  const matches: MatchListItem[] = data.map((row) => {
    const r = row as unknown as {
      id: string;
      contributor_id: string;
      similarity_score: number;
      confidence_tier: string;
      is_ai_generated: boolean | null;
      ai_detection_score: number | null;
      status: string;
      created_at: string;
      contributors: { full_name: string; display_name: string | null } | null;
      discovered_images: {
        source_url: string;
        page_url: string | null;
        platform: string | null;
      } | null;
    };
    return {
      id: r.id,
      contributor_id: r.contributor_id,
      contributor_name:
        r.contributors?.display_name || r.contributors?.full_name || "Unknown",
      source_url: r.discovered_images?.source_url || "",
      page_url: r.discovered_images?.page_url || null,
      platform: r.discovered_images?.platform || null,
      similarity_score: r.similarity_score,
      confidence_tier: r.confidence_tier,
      is_ai_generated: r.is_ai_generated,
      ai_detection_score: r.ai_detection_score,
      status: r.status,
      created_at: r.created_at,
    };
  });

  return { matches, total: count || 0 };
}

// --- Match Detail ---

export interface MatchDetail {
  id: string;
  contributor_id: string;
  contributor_name: string;
  similarity_score: number;
  confidence_tier: string;
  face_index: number | null;
  source_account: string | null;
  is_known_account: boolean;
  is_ai_generated: boolean | null;
  ai_detection_score: number | null;
  ai_generator: string | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  // Discovered image
  discovered_image: {
    id: string;
    source_url: string;
    page_url: string | null;
    page_title: string | null;
    platform: string | null;
    has_face: boolean | null;
    face_count: number | null;
    width: number | null;
    height: number | null;
    discovered_at: string;
  } | null;
  // Evidence
  evidence: {
    id: string;
    evidence_type: string;
    storage_url: string;
    sha256_hash: string;
    file_size_bytes: number | null;
    captured_at: string;
  }[];
  // Takedowns
  takedowns: {
    id: string;
    platform: string;
    takedown_type: string;
    status: string;
    submitted_at: string | null;
    resolved_at: string | null;
    created_at: string;
  }[];
}

export async function getMatchDetail(
  matchId: string
): Promise<MatchDetail | null> {
  const supabase = await createServiceClient();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "*, contributors(full_name, display_name), discovered_images(id, source_url, page_url, page_title, platform, has_face, face_count, width, height, discovered_at)"
    )
    .eq("id", matchId)
    .single();

  if (!match) return null;

  const m = match as unknown as {
    id: string;
    contributor_id: string;
    similarity_score: number;
    confidence_tier: string;
    face_index: number | null;
    source_account: string | null;
    is_known_account: boolean;
    is_ai_generated: boolean | null;
    ai_detection_score: number | null;
    ai_generator: string | null;
    status: string;
    reviewed_at: string | null;
    created_at: string;
    contributors: { full_name: string; display_name: string | null } | null;
    discovered_images: {
      id: string;
      source_url: string;
      page_url: string | null;
      page_title: string | null;
      platform: string | null;
      has_face: boolean | null;
      face_count: number | null;
      width: number | null;
      height: number | null;
      discovered_at: string;
    } | null;
  };

  // Fetch evidence and takedowns in parallel
  const [{ data: evidence }, { data: takedowns }] = await Promise.all([
    supabase
      .from("evidence")
      .select("id, evidence_type, storage_url, sha256_hash, file_size_bytes, captured_at")
      .eq("match_id", matchId)
      .order("captured_at", { ascending: false }),
    supabase
      .from("takedowns")
      .select("id, platform, takedown_type, status, submitted_at, resolved_at, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    id: m.id,
    contributor_id: m.contributor_id,
    contributor_name:
      m.contributors?.display_name || m.contributors?.full_name || "Unknown",
    similarity_score: m.similarity_score,
    confidence_tier: m.confidence_tier,
    face_index: m.face_index,
    source_account: m.source_account,
    is_known_account: m.is_known_account,
    is_ai_generated: m.is_ai_generated,
    ai_detection_score: m.ai_detection_score,
    ai_generator: m.ai_generator,
    status: m.status,
    reviewed_at: m.reviewed_at,
    created_at: m.created_at,
    discovered_image: m.discovered_images,
    evidence: (evidence || []) as MatchDetail["evidence"],
    takedowns: (takedowns || []) as MatchDetail["takedowns"],
  };
}

// --- Scan Jobs ---

export interface ScanJobListItem {
  id: string;
  contributor_name: string | null;
  contributor_id: string | null;
  scan_type: string;
  status: string;
  source_name: string | null;
  images_processed: number;
  matches_found: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function getAllScanJobs({
  status,
  page = 1,
  pageSize = 20,
}: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ jobs: ScanJobListItem[]; total: number }> {
  const supabase = await createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("scan_jobs")
    .select(
      "id, contributor_id, scan_type, status, source_name, images_processed, matches_found, error_message, started_at, completed_at, created_at, contributors(full_name, display_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count } = await query;

  if (!data) return { jobs: [], total: 0 };

  const jobs: ScanJobListItem[] = data.map((row) => {
    const r = row as unknown as {
      id: string;
      contributor_id: string | null;
      scan_type: string;
      status: string;
      source_name: string | null;
      images_processed: number;
      matches_found: number;
      error_message: string | null;
      started_at: string | null;
      completed_at: string | null;
      created_at: string;
      contributors: { full_name: string; display_name: string | null } | null;
    };
    return {
      id: r.id,
      contributor_id: r.contributor_id,
      contributor_name: r.contributor_id
        ? r.contributors?.display_name || r.contributors?.full_name || "Unknown"
        : null,
      scan_type: r.scan_type,
      status: r.status,
      source_name: r.source_name,
      images_processed: r.images_processed,
      matches_found: r.matches_found,
      error_message: r.error_message,
      started_at: r.started_at,
      completed_at: r.completed_at,
      created_at: r.created_at,
    };
  });

  return { jobs, total: count || 0 };
}
