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

  const sparklineResults = await Promise.all(
    enabledPlatforms.map((platform) =>
      supabase
        .from("scan_jobs")
        .select("images_processed")
        .eq("source_name", platform)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(7)
    )
  );

  const platformSparklines: Record<string, number[]> = {};
  enabledPlatforms.forEach((platform, i) => {
    const rows = sparklineResults[i].data || [];
    platformSparklines[platform] = rows
      .map((r) => (r as { images_processed: number }).images_processed)
      .reverse();
  });

  return {
    funnel: {
      discovered: discoveredCount || 0,
      withFaces: withFacesCount || 0,
      compared: comparedCount || 0,
      matched: matchedCount || 0,
      confirmed: confirmedCount || 0,
    },
    platforms: (platformsRaw || []) as PlatformInfo[],
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
