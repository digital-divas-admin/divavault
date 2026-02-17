import { createServiceClient } from "@/lib/supabase/server";

export interface RegistryStatus {
  cid: string;
  status: string;
  embeddingStatus: string | null;
  createdAt: string;
}

export interface RegistryMatchSummary {
  totalMatches: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  latestMatchDate: string | null;
  matches: {
    id: string;
    platform: string | null;
    confidenceTier: string;
    discoveredAt: string;
  }[];
}

export async function getRegistryStatus(
  cid: string
): Promise<RegistryStatus | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("registry_identities")
    .select("cid, status, embedding_status, created_at")
    .eq("cid", cid)
    .single();

  if (error || !data) return null;

  return {
    cid: data.cid,
    status: data.status,
    embeddingStatus: data.embedding_status,
    createdAt: data.created_at,
  };
}

export async function getRegistryMatchSummary(
  cid: string
): Promise<RegistryMatchSummary> {
  const supabase = await createServiceClient();

  const { data: matches } = await supabase
    .from("registry_matches")
    .select("id, platform, confidence_tier, discovered_at")
    .eq("cid", cid)
    .order("discovered_at", { ascending: false })
    .limit(10);

  const allMatches = matches || [];

  const highConfidence = allMatches.filter(
    (m) => m.confidence_tier === "high"
  ).length;
  const mediumConfidence = allMatches.filter(
    (m) => m.confidence_tier === "medium"
  ).length;
  const lowConfidence = allMatches.filter(
    (m) => m.confidence_tier === "low"
  ).length;

  // Get total count separately in case there are more than 10
  const { count } = await supabase
    .from("registry_matches")
    .select("id", { count: "exact", head: true })
    .eq("cid", cid);

  return {
    totalMatches: count || allMatches.length,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    latestMatchDate: allMatches[0]?.discovered_at || null,
    matches: allMatches.map((m) => ({
      id: m.id,
      platform: m.platform,
      confidenceTier: m.confidence_tier,
      discoveredAt: m.discovered_at,
    })),
  };
}
