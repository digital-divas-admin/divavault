import { createServiceClient } from "@/lib/supabase/server";

export interface ContributorEmbeddingStatus {
  contributorId: string;
  name: string;
  tier: string;
  images: { pending: number; completed: number; failed: number };
  uploads: { pending: number; completed: number; failed: number };
  embeddingsCount: number;
}

export async function getContributorEmbeddingStatus(
  contributorId: string
): Promise<ContributorEmbeddingStatus | null> {
  const supabase = await createServiceClient();

  const [
    { data: contributor },
    { count: imgPending },
    { count: imgCompleted },
    { count: imgFailed },
    { count: uplPending },
    { count: uplCompleted },
    { count: uplFailed },
    { count: embeddingsCount },
  ] = await Promise.all([
    supabase
      .from("contributors")
      .select("full_name, display_name, subscription_tier")
      .eq("id", contributorId)
      .single(),
    supabase
      .from("contributor_images")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", contributorId)
      .eq("embedding_status", "pending"),
    supabase
      .from("contributor_images")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", contributorId)
      .eq("embedding_status", "completed"),
    supabase
      .from("contributor_images")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", contributorId)
      .eq("embedding_status", "failed"),
    supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", contributorId)
      .eq("embedding_status", "pending"),
    supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", contributorId)
      .eq("embedding_status", "completed"),
    supabase
      .from("uploads")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", contributorId)
      .eq("embedding_status", "failed"),
    supabase
      .from("contributor_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("contributor_id", contributorId),
  ]);

  if (!contributor) return null;

  return {
    contributorId,
    name: contributor.display_name || contributor.full_name || "Unknown",
    tier: contributor.subscription_tier || "free",
    images: {
      pending: imgPending || 0,
      completed: imgCompleted || 0,
      failed: imgFailed || 0,
    },
    uploads: {
      pending: uplPending || 0,
      completed: uplCompleted || 0,
      failed: uplFailed || 0,
    },
    embeddingsCount: embeddingsCount || 0,
  };
}

export interface ScanScheduleRow {
  contributor_id: string;
  scan_type: string;
  last_scan_at: string | null;
  next_scan_at: string | null;
  scan_interval_hours: number;
  priority: number;
}

export async function getContributorScanSchedule(
  contributorId: string
): Promise<ScanScheduleRow[]> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("scan_schedule")
    .select("*")
    .eq("contributor_id", contributorId)
    .order("scan_type");

  return (data || []) as ScanScheduleRow[];
}

export interface CrawlScheduleRow {
  platform: string;
  last_crawl_at: string | null;
  next_crawl_at: string | null;
  crawl_interval_hours: number;
  enabled: boolean;
  search_terms: unknown;
}

export async function getAllCrawlSchedules(): Promise<CrawlScheduleRow[]> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("platform_crawl_schedule")
    .select("*")
    .order("platform");

  return (data || []) as CrawlScheduleRow[];
}

export interface ContributorSearchResult {
  id: string;
  full_name: string | null;
  email: string;
  subscription_tier: string;
}

export async function getContributorSearchResults(
  search: string
): Promise<ContributorSearchResult[]> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("contributors")
    .select("id, full_name, email, subscription_tier")
    .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    .limit(10);

  return (data || []) as ContributorSearchResult[];
}
