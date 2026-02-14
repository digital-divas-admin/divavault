import { createServiceClient } from "@/lib/supabase/server";

// --- Interfaces ---

export interface AdIntelStats {
  adsScanned: number;
  aiFacesFound: number;
  stockMatches: number;
  pendingReview: number;
  confirmed: number;
  dismissed: number;
  escalated: number;
}

export interface AdIntelMatchListItem {
  id: string;
  match_type: string;
  similarity_score: number;
  confidence_tier: string;
  review_status: string;
  ad_platform: string | null;
  advertiser_name: string | null;
  face_description: string | null;
  stock_platform: string | null;
  stock_photographer: string | null;
  contributor_name: string | null;
  created_at: string;
}

export interface AdIntelMatchDetail {
  id: string;
  match_type: string;
  similarity_score: number;
  confidence_tier: string;
  review_status: string;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  // Ad info
  ad: {
    id: string;
    platform: string;
    advertiser_name: string | null;
    creative_url: string | null;
    creative_stored_path: string | null;
    landing_page_url: string | null;
    is_ai_generated: boolean | null;
    ai_detection_score: number | null;
  } | null;
  // Face info
  face: {
    id: string;
    description: string | null;
    description_keywords: string[] | null;
    demographics: Record<string, unknown> | null;
  } | null;
  // Stock candidate (if match_type = stock_to_ad)
  stock_candidate: {
    id: string;
    stock_platform: string;
    stock_image_url: string | null;
    preview_stored_path: string | null;
    photographer: string | null;
    model_name: string | null;
    license_type: string | null;
  } | null;
  // Contributor (if match_type = contributor_to_ad)
  contributor: {
    id: string;
    full_name: string | null;
  } | null;
}

// --- Stats ---

export async function getAdIntelStats(): Promise<AdIntelStats> {
  const supabase = await createServiceClient();

  const [
    { count: adsScanned },
    { count: aiFacesFound },
    { count: stockMatches },
    { count: pendingReview },
    { count: confirmed },
    { count: dismissed },
    { count: escalated },
  ] = await Promise.all([
    supabase
      .from("ad_intel_ads")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("ad_intel_faces")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("ad_intel_stock_candidates")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("ad_intel_matches")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "pending"),
    supabase
      .from("ad_intel_matches")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "confirmed"),
    supabase
      .from("ad_intel_matches")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "dismissed"),
    supabase
      .from("ad_intel_matches")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "escalated"),
  ]);

  return {
    adsScanned: adsScanned || 0,
    aiFacesFound: aiFacesFound || 0,
    stockMatches: stockMatches || 0,
    pendingReview: pendingReview || 0,
    confirmed: confirmed || 0,
    dismissed: dismissed || 0,
    escalated: escalated || 0,
  };
}

// --- Match List ---

export async function getAdIntelMatches({
  confidence,
  status,
  matchType,
  page = 1,
  pageSize = 20,
}: {
  confidence?: string;
  status?: string;
  matchType?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ matches: AdIntelMatchListItem[]; total: number }> {
  const supabase = await createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("ad_intel_matches")
    .select(
      "id, match_type, similarity_score, confidence_tier, review_status, ad_platform, advertiser_name, created_at, ad_intel_faces(description), ad_intel_stock_candidates(stock_platform, photographer), contributors(full_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (confidence && confidence !== "all") {
    query = query.eq("confidence_tier", confidence);
  }
  if (status && status !== "all") {
    query = query.eq("review_status", status);
  }
  if (matchType && matchType !== "all") {
    query = query.eq("match_type", matchType);
  }

  const { data, count } = await query;

  if (!data) return { matches: [], total: 0 };

  const matches: AdIntelMatchListItem[] = data.map((row) => {
    const r = row as unknown as {
      id: string;
      match_type: string;
      similarity_score: number;
      confidence_tier: string;
      review_status: string;
      ad_platform: string | null;
      advertiser_name: string | null;
      created_at: string;
      ad_intel_faces: { description: string | null } | null;
      ad_intel_stock_candidates: {
        stock_platform: string | null;
        photographer: string | null;
      } | null;
      contributors: { full_name: string | null } | null;
    };
    return {
      id: r.id,
      match_type: r.match_type,
      similarity_score: r.similarity_score,
      confidence_tier: r.confidence_tier,
      review_status: r.review_status,
      ad_platform: r.ad_platform,
      advertiser_name: r.advertiser_name,
      face_description: r.ad_intel_faces?.description || null,
      stock_platform: r.ad_intel_stock_candidates?.stock_platform || null,
      stock_photographer: r.ad_intel_stock_candidates?.photographer || null,
      contributor_name: r.contributors?.full_name || null,
      created_at: r.created_at,
    };
  });

  return { matches, total: count || 0 };
}

// --- Match Detail ---

export async function getAdIntelMatchDetail(
  matchId: string
): Promise<AdIntelMatchDetail | null> {
  const supabase = await createServiceClient();

  const { data: match } = await supabase
    .from("ad_intel_matches")
    .select(
      "*, ad_intel_faces(id, ad_id, description, description_keywords, demographics), ad_intel_stock_candidates(id, stock_platform, stock_image_url, preview_stored_path, photographer, model_name, license_type), contributors(id, full_name)"
    )
    .eq("id", matchId)
    .single();

  if (!match) return null;

  const m = match as unknown as {
    id: string;
    ad_face_id: string;
    stock_candidate_id: string | null;
    contributor_id: string | null;
    match_type: string;
    similarity_score: number;
    confidence_tier: string;
    review_status: string;
    reviewer_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
    ad_intel_faces: {
      id: string;
      ad_id: string;
      description: string | null;
      description_keywords: string[] | null;
      demographics: Record<string, unknown> | null;
    } | null;
    ad_intel_stock_candidates: {
      id: string;
      stock_platform: string;
      stock_image_url: string | null;
      preview_stored_path: string | null;
      photographer: string | null;
      model_name: string | null;
      license_type: string | null;
    } | null;
    contributors: {
      id: string;
      full_name: string | null;
    } | null;
  };

  // Fetch the ad record via the face's ad_id
  let ad: AdIntelMatchDetail["ad"] = null;
  if (m.ad_intel_faces?.ad_id) {
    const { data: adData } = await supabase
      .from("ad_intel_ads")
      .select(
        "id, platform, advertiser_name, creative_url, creative_stored_path, landing_page_url, is_ai_generated, ai_detection_score"
      )
      .eq("id", m.ad_intel_faces.ad_id)
      .single();

    if (adData) {
      ad = adData as AdIntelMatchDetail["ad"];
    }
  }

  return {
    id: m.id,
    match_type: m.match_type,
    similarity_score: m.similarity_score,
    confidence_tier: m.confidence_tier,
    review_status: m.review_status,
    reviewer_notes: m.reviewer_notes,
    reviewed_at: m.reviewed_at,
    created_at: m.created_at,
    ad,
    face: m.ad_intel_faces
      ? {
          id: m.ad_intel_faces.id,
          description: m.ad_intel_faces.description,
          description_keywords: m.ad_intel_faces.description_keywords,
          demographics: m.ad_intel_faces.demographics,
        }
      : null,
    stock_candidate: m.ad_intel_stock_candidates,
    contributor: m.contributors,
  };
}

// --- Review Match ---

export async function reviewMatch(
  matchId: string,
  {
    status,
    notes,
    reviewerId,
  }: {
    status: "confirmed" | "dismissed" | "escalated";
    notes?: string;
    reviewerId: string;
  }
): Promise<void> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("ad_intel_matches")
    .update({
      review_status: status,
      reviewer_notes: notes || null,
      reviewed_by: reviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", matchId);

  if (error) throw new Error(error.message);
}

// --- Config ---

export async function getAdIntelConfig(): Promise<
  Record<string, { value: unknown; description: string | null }>
> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("ad_intel_config")
    .select("key, value, description")
    .order("key");

  if (!data) return {};

  const config: Record<string, { value: unknown; description: string | null }> =
    {};
  for (const row of data) {
    const r = row as { key: string; value: unknown; description: string | null };
    config[r.key] = { value: r.value, description: r.description };
  }
  return config;
}

export async function updateAdIntelConfig(
  key: string,
  value: unknown
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("ad_intel_config")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);

  if (error) throw new Error(error.message);
}

// --- Ad Intel Jobs ---

export interface AdIntelJobListItem {
  id: string;
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

export async function getAdIntelJobs({
  status,
  page = 1,
  pageSize = 20,
}: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ jobs: AdIntelJobListItem[]; total: number }> {
  const supabase = await createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("scan_jobs")
    .select(
      "id, scan_type, status, source_name, images_processed, matches_found, error_message, started_at, completed_at, created_at",
      { count: "exact" }
    )
    .eq("scan_type", "ad_intel")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count } = await query;

  if (!data) return { jobs: [], total: 0 };

  const jobs: AdIntelJobListItem[] = data.map((row) => {
    const r = row as unknown as AdIntelJobListItem;
    return r;
  });

  return { jobs, total: count || 0 };
}
