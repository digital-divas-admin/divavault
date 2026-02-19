import { createServiceClient } from "@/lib/supabase/server";

// --- Types ---

export interface PlatformInfo {
  platform: string;
  enabled: boolean;
  last_crawl_at: string | null;
  next_crawl_at: string | null;
  crawl_interval_hours: number | null;
  crawl_phase: string | null;
  total_images_discovered: number | null;
  tags_total: number | null;
  tags_exhausted: number | null;
}

export interface SectionProfile {
  id: string;
  platform: string | null;
  section_key: string;
  section_id: string | null;
  section_name: string | null;
  scan_enabled: boolean | null;
  human_override: boolean | null;
  ai_recommendation: string | null;
  ai_reason: string | null;
  ml_priority: number | null;
  ml_risk_level: string | null;
  total_content: number | null;
  total_scanned: number | null;
  total_faces: number | null;
  face_rate: number | null;
  confidence: number | null;
  sample_count: number | null;
  last_crawl_at: string | null;
  last_updated_at: string;
  tags: string[] | null;
}

export interface Recommendation {
  id: string;
  recommendation_type: string;
  target_entity: string;
  target_id: string;
  target_platform: string | null;
  payload: Record<string, unknown> | null;
  confidence: number | null;
  status: string;
  reasoning: string | null;
  expected_impact: string | null;
  risk_level: string | null;
  supporting_data: Record<string, unknown> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  created_at: string;
}

export interface HoneypotItem {
  id: string;
  contributor_id: string;
  platform: string;
  planted_url: string;
  content_type: string;
  generation_method: string | null;
  difficulty: string;
  expected_similarity_min: number | null;
  expected_similarity_max: number | null;
  detected: boolean | null;
  detected_at: string | null;
  detected_match_id: string | null;
  detected_similarity: number | null;
  planted_at: string | null;
}

export interface ModelStateEntry {
  id: string;
  model_name: string;
  version: number;
  parameters: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  trained_at: string | null;
  created_at: string;
}

export interface AnomalyAlert {
  id: string;
  recommendation_type: string;
  target_entity: string;
  target_platform: string | null;
  reasoning: string | null;
  risk_level: string | null;
  confidence: number | null;
  status: string;
  supporting_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DiscoveredSection {
  id: string;
  section_key: string;
  section_name: string | null;
  platform: string | null;
  scan_enabled: boolean;
  total_content: number | null;
  face_rate: number | null;
  ml_risk_level: string | null;
  tags: string[] | null;
  last_updated_at: string;
  is_new: boolean; // true if created within last 7 days
}

export interface LearningProgress {
  model_name: string;
  version: number;
  accuracy: number | null;
  auc: number | null;
  signals_total: number;
  signals_7d: number;
  signals_needed: number;
  last_trained: string | null;
  outcome_stats: {
    improved: number;
    neutral: number;
    negative: number;
    total: number;
  };
}

export interface CrossPlatformRisk {
  tag: string;
  platforms: {
    platform: string;
    face_rate: number;
    match_count: number;
    scan_enabled: boolean;
    risk_level: string | null;
  }[];
}

export interface CommandCenterData {
  funnel: {
    discovered: number;
    withFaces: number;
    compared: number;
    matched: number;
    confirmed: number;
  };
  platforms: PlatformInfo[];
  sections: SectionProfile[];
  recommendations: Recommendation[];
  appliedRecs: Recommendation[];
  testUserSummary: { seeded: number; honeypot: number; synthetic: number };
  honeypotItems: HoneypotItem[];
  modelState: ModelStateEntry[];
  signalStats: { signal_type: string; count: number }[];
  platformSparklines: Record<string, number[]>;
}

// --- Main Query ---

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const supabase = await createServiceClient();

  const [
    // Funnel counts
    { count: discoveredCount },
    { count: withFacesCount },
    { count: comparedCount },
    { count: matchedCount },
    { count: confirmedCount },
    // Platforms
    { data: platformsRaw },
    // Sections
    { data: sectionsRaw },
    // Recommendations (pending)
    { data: recsRaw },
    // Applied recs
    { data: appliedRecsRaw },
    // Test users
    { data: testUsersRaw },
    // Honeypots
    { data: honeypotRaw },
    // Model state
    { data: modelStateRaw },
    // Signal stats (raw — we group in JS)
    { data: signalsRaw },
  ] = await Promise.all([
    // Funnel
    supabase
      .from("discovered_images")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("discovered_images")
      .select("*", { count: "exact", head: true })
      .eq("has_face", true),
    supabase
      .from("discovered_face_embeddings")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed"),
    // Platforms
    supabase
      .from("platform_crawl_schedule")
      .select("*")
      .order("platform"),
    // Sections
    supabase
      .from("ml_section_profiles")
      .select("*")
      .order("ml_priority", { ascending: false }),
    // Recommendations (pending first, then others)
    supabase
      .from("ml_recommendations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    // Applied recs
    supabase
      .from("ml_recommendations")
      .select("*")
      .eq("status", "applied")
      .order("applied_at", { ascending: false })
      .limit(10),
    // Test users — select all test users to group in JS
    supabase
      .from("contributors")
      .select("test_user_type")
      .eq("is_test_user", true),
    // Honeypots
    supabase
      .from("test_honeypot_items")
      .select("*")
      .order("planted_at", { ascending: false })
      .limit(50),
    // Model state
    supabase
      .from("ml_model_state")
      .select("*")
      .order("trained_at", { ascending: false })
      .limit(5),
    // Signals (all — group in JS)
    supabase
      .from("ml_feedback_signals")
      .select("signal_type"),
  ]);

  // Group test users by type
  const testUserSummary = { seeded: 0, honeypot: 0, synthetic: 0 };
  for (const row of testUsersRaw || []) {
    const r = row as { test_user_type: string | null };
    if (r.test_user_type === "seeded") testUserSummary.seeded++;
    else if (r.test_user_type === "honeypot") testUserSummary.honeypot++;
    else if (r.test_user_type === "synthetic") testUserSummary.synthetic++;
  }

  // Group signal stats
  const signalMap = new Map<string, number>();
  for (const row of signalsRaw || []) {
    const r = row as { signal_type: string };
    signalMap.set(r.signal_type, (signalMap.get(r.signal_type) || 0) + 1);
  }
  const signalStats = Array.from(signalMap.entries()).map(([signal_type, count]) => ({
    signal_type,
    count,
  }));

  // Platform sparklines — last 7 scan_jobs per enabled platform
  const enabledPlatforms = (platformsRaw || [])
    .filter((p) => (p as PlatformInfo).enabled)
    .map((p) => (p as PlatformInfo).platform);

  const [sparklineResults, platformCountResults] = await Promise.all([
    Promise.all(
      enabledPlatforms.map((platform) =>
        supabase
          .from("scan_jobs")
          .select("images_processed")
          .eq("source_name", platform)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(7)
      )
    ),
    // Real per-platform discovered_images counts (replaces stale denormalized counter)
    Promise.all(
      enabledPlatforms.map((platform) =>
        supabase
          .from("discovered_images")
          .select("*", { count: "exact", head: true })
          .eq("platform", platform)
      )
    ),
  ]);

  const platformSparklines: Record<string, number[]> = {};
  enabledPlatforms.forEach((platform, i) => {
    const rows = sparklineResults[i].data || [];
    platformSparklines[platform] = rows
      .map((r) => (r as { images_processed: number }).images_processed)
      .reverse();
  });

  // Override stale total_images_discovered with real counts
  const platformCountMap: Record<string, number> = {};
  enabledPlatforms.forEach((platform, i) => {
    platformCountMap[platform] = platformCountResults[i].count || 0;
  });
  const platforms = (platformsRaw || []).map((p) => {
    const pi = p as PlatformInfo;
    if (platformCountMap[pi.platform] !== undefined) {
      return { ...pi, total_images_discovered: platformCountMap[pi.platform] };
    }
    return pi;
  }) as PlatformInfo[];

  return {
    funnel: {
      discovered: discoveredCount || 0,
      withFaces: withFacesCount || 0,
      compared: comparedCount || 0,
      matched: matchedCount || 0,
      confirmed: confirmedCount || 0,
    },
    platforms,
    sections: (sectionsRaw || []) as SectionProfile[],
    recommendations: (recsRaw || []) as Recommendation[],
    appliedRecs: (appliedRecsRaw || []) as Recommendation[],
    testUserSummary,
    honeypotItems: (honeypotRaw || []) as HoneypotItem[],
    modelState: (modelStateRaw || []) as ModelStateEntry[],
    signalStats,
    platformSparklines,
  };
}

// --- Specialized Queries ---

export async function fetchAnomalyAlerts(): Promise<AnomalyAlert[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("ml_recommendations")
    .select("id, recommendation_type, target_entity, target_platform, reasoning, risk_level, confidence, status, supporting_data, created_at")
    .eq("recommendation_type", "anomaly_alert")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function fetchDiscoveredSections(): Promise<DiscoveredSection[]> {
  const supabase = await createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ml_section_profiles")
    .select("id, section_key, section_name, platform, scan_enabled, total_content, face_rate, ml_risk_level, tags, last_updated_at")
    .order("last_updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    ...s,
    is_new: s.last_updated_at > sevenDaysAgo && !s.scan_enabled,
  }));
}

export async function fetchLearningProgress(): Promise<LearningProgress[]> {
  const supabase = await createServiceClient();

  // Get latest model states
  const { data: models, error: modelsErr } = await supabase
    .from("ml_model_state")
    .select("model_name, version, metrics, parameters, trained_at")
    .order("model_name")
    .order("version", { ascending: false });
  if (modelsErr) throw modelsErr;

  // Get signal counts
  const { count: totalSignals } = await supabase
    .from("ml_feedback_signals")
    .select("*", { count: "exact", head: true });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentSignals } = await supabase
    .from("ml_feedback_signals")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  // Get outcome stats
  const { data: outcomes } = await supabase
    .from("ml_recommendations")
    .select("outcome_metrics")
    .not("outcome_metrics", "is", null);

  const outcomeStats = { improved: 0, neutral: 0, negative: 0, total: 0 };
  for (const o of outcomes ?? []) {
    const verdict = (o.outcome_metrics as Record<string, unknown>)?.verdict;
    if (verdict === "improved") outcomeStats.improved++;
    else if (verdict === "neutral") outcomeStats.neutral++;
    else if (verdict === "negative") outcomeStats.negative++;
    outcomeStats.total++;
  }

  // Deduplicate to latest version per model
  const seen = new Set<string>();
  const progress: LearningProgress[] = [];
  for (const m of models ?? []) {
    if (seen.has(m.model_name)) continue;
    seen.add(m.model_name);
    const metrics = m.metrics as Record<string, unknown> | null;
    progress.push({
      model_name: m.model_name,
      version: m.version,
      accuracy: (metrics?.accuracy as number) ?? null,
      auc: (metrics?.auc as number) ?? null,
      signals_total: totalSignals ?? 0,
      signals_7d: recentSignals ?? 0,
      signals_needed: Math.max(0, 50 - (recentSignals ?? 0)),
      last_trained: m.trained_at,
      outcome_stats: outcomeStats,
    });
  }

  return progress;
}

export async function fetchCrossPlatformRisks(): Promise<CrossPlatformRisk[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("ml_section_profiles")
    .select("section_key, platform, face_rate, total_scanned, scan_enabled, ml_risk_level, tags")
    .gt("total_scanned", 50);
  if (error) throw error;

  // Group by tags that appear across multiple platforms
  const tagMap = new Map<string, CrossPlatformRisk["platforms"]>();
  for (const row of data ?? []) {
    for (const tag of (row.tags as string[] | null) ?? []) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push({
        platform: (row.platform as string) ?? "unknown",
        face_rate: (row.face_rate as number) ?? 0,
        match_count: (row.total_scanned as number) ?? 0,
        scan_enabled: (row.scan_enabled as boolean) ?? false,
        risk_level: row.ml_risk_level as string | null,
      });
    }
  }

  // Filter to tags on 2+ platforms, sort by max face_rate
  const risks: CrossPlatformRisk[] = [];
  for (const [tag, platforms] of tagMap) {
    const uniquePlatforms = new Set(platforms.map((p) => p.platform));
    if (uniquePlatforms.size >= 2) {
      risks.push({ tag, platforms });
    }
  }
  risks.sort((a, b) => {
    const maxA = Math.max(...a.platforms.map((p) => p.face_rate));
    const maxB = Math.max(...b.platforms.map((p) => p.face_rate));
    return maxB - maxA;
  });

  return risks.slice(0, 30);
}
