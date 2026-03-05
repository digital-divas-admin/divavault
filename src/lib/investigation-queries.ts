import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { isTweetUrl } from "@/lib/investigation-utils";
import type {
  Investigation,
  InvestigationMedia,
  InvestigationFrame,
  InvestigationEvidence,
  DeepfakeTask,
  ReverseSearchResult,
  InvestigationListItem,
  InvestigationStats,
  InvestigationDetail,
  InvestigationCategory,
  InvestigationStatus,
  InvestigationVerdict,
  EvidenceType,
  ActivityEventType,
} from "@/types/investigations";

// --- Helpers ---

type SupabaseClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Attach media + evidence counts to a list of investigations. */
async function attachCounts(
  supabase: SupabaseClient,
  investigations: Investigation[]
): Promise<InvestigationListItem[]> {
  const ids = investigations.map((d) => d.id);
  if (ids.length === 0) return [];

  const [mediaRes, evidenceRes] = await Promise.all([
    supabase.from("deepfake_media").select("investigation_id").in("investigation_id", ids),
    supabase.from("deepfake_evidence").select("investigation_id").in("investigation_id", ids),
  ]);

  const mediaCounts = new Map<string, number>();
  const evidenceCounts = new Map<string, number>();

  for (const m of mediaRes.data || []) {
    mediaCounts.set(m.investigation_id, (mediaCounts.get(m.investigation_id) || 0) + 1);
  }
  for (const e of evidenceRes.data || []) {
    evidenceCounts.set(e.investigation_id, (evidenceCounts.get(e.investigation_id) || 0) + 1);
  }

  return investigations.map((d) => ({
    ...d,
    media_count: mediaCounts.get(d.id) || 0,
    evidence_count: evidenceCounts.get(d.id) || 0,
  }));
}

// --- Investigation CRUD ---

export async function getInvestigations(
  status?: InvestigationStatus
): Promise<InvestigationListItem[]> {
  const supabase = await createServiceClient();
  let query = supabase
    .from("deepfake_investigations")
    .select("*");

  if (status) {
    query = query.eq("status", status);
  }

  if (status === "published") {
    query = query.order("published_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  return attachCounts(supabase, (data || []) as Investigation[]);
}

export async function getInvestigationStats(): Promise<InvestigationStats> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_investigations")
    .select("status, verdict");

  if (error) throw error;
  const items = data || [];

  return {
    total: items.length,
    drafts: items.filter((i) => i.status === "draft").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    published: items.filter((i) => i.status === "published").length,
    confirmed_fake: items.filter((i) => i.verdict === "confirmed_fake").length,
  };
}

export async function getInvestigationById(id: string): Promise<InvestigationDetail | null> {
  const supabase = await createServiceClient();

  const { data: investigation, error } = await supabase
    .from("deepfake_investigations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !investigation) return null;

  const [mediaRes, framesRes, evidenceRes, tasksRes, activityRes, searchRes] = await Promise.all([
    supabase.from("deepfake_media").select("*").eq("investigation_id", id).order("created_at"),
    supabase.from("deepfake_frames").select("*").eq("investigation_id", id).order("frame_number"),
    supabase.from("deepfake_evidence").select("*").eq("investigation_id", id).order("display_order"),
    supabase.from("deepfake_tasks").select("*").eq("investigation_id", id).order("created_at", { ascending: false }),
    supabase.from("deepfake_activity_log").select("*").eq("investigation_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("deepfake_reverse_search_results").select("*").eq("investigation_id", id).order("created_at"),
  ]);

  // Sign frame storage URLs so the admin UI can display images
  const frames = framesRes.data || [];
  if (frames.length > 0) {
    const signPromises = frames.map(async (frame: Record<string, unknown>) => {
      if (frame.thumbnail_path) {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(frame.thumbnail_path as string, 3600);
        if (data) frame.thumbnail_url = data.signedUrl;
      }
      if (frame.storage_path) {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(frame.storage_path as string, 3600);
        if (data) frame.storage_url = data.signedUrl;
      }
      if (frame.annotation_image_path) {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(frame.annotation_image_path as string, 3600);
        if (data) frame.annotation_image_url = data.signedUrl;
      }
    });
    await Promise.all(signPromises);
  }

  // Sign evidence attachment URLs
  const evidence = evidenceRes.data || [];
  if (evidence.length > 0) {
    const signEvidencePromises = evidence.map(async (ev: Record<string, unknown>) => {
      if (ev.attachment_path) {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(ev.attachment_path as string, 3600);
        if (data) ev.attachment_url = data.signedUrl;
      }
    });
    await Promise.all(signEvidencePromises);
  }

  return {
    ...investigation,
    media: mediaRes.data || [],
    frames,
    evidence,
    tasks: tasksRes.data || [],
    activity: activityRes.data || [],
    reverse_search_results: searchRes.data || [],
  } as InvestigationDetail;
}

/** Cached per-request for deduplication between generateMetadata and page component. */
export const getInvestigationBySlug = cache(async (slug: string): Promise<InvestigationDetail | null> => {
  const supabase = await createServiceClient();

  const { data: investigation, error } = await supabase
    .from("deepfake_investigations")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !investigation) return null;

  const id = investigation.id;
  const [mediaRes, framesRes, evidenceRes, searchRes] = await Promise.all([
    supabase.from("deepfake_media").select("*").eq("investigation_id", id).order("created_at"),
    supabase.from("deepfake_frames").select("*").eq("investigation_id", id).or("is_key_evidence.eq.true,annotation_image_path.not.is.null").order("frame_number"),
    supabase.from("deepfake_evidence").select("*").eq("investigation_id", id).order("display_order"),
    supabase.from("deepfake_reverse_search_results").select("*").eq("investigation_id", id).order("created_at", { ascending: false }),
  ]);

  // Sign media storage URLs and auto-fetch engagement stats
  const media = mediaRes.data || [];
  if (media.length > 0) {
    const mediaPromises = media.map(async (m: Record<string, unknown>) => {
      // Sign storage URL
      if (m.storage_path && m.download_status === "completed") {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(m.storage_path as string, 3600);
        if (data) m.storage_url = data.signedUrl;
      }
      // Backfill engagement stats in the background (non-blocking) so page renders immediately
      if (!m.engagement_stats && m.source_url && isTweetUrl(m.source_url as string)) {
        const mediaId = m.id as string;
        const sourceUrl = m.source_url as string;
        import("@/lib/fetch-engagement").then(({ fetchTweetEngagement }) =>
          fetchTweetEngagement(sourceUrl).then((stats) => {
            if (stats) {
              supabase
                .from("deepfake_media")
                .update({ engagement_stats: stats })
                .eq("id", mediaId)
                .then(() => {});
            }
          })
        ).catch(() => {});
      }
    });
    await Promise.all(mediaPromises);
  }

  // Sign frame storage URLs for public display
  const frames = framesRes.data || [];
  if (frames.length > 0) {
    const signPromises = frames.map(async (frame: Record<string, unknown>) => {
      if (frame.thumbnail_path) {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(frame.thumbnail_path as string, 3600);
        if (data) frame.thumbnail_url = data.signedUrl;
      }
      if (frame.storage_path) {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(frame.storage_path as string, 3600);
        if (data) frame.storage_url = data.signedUrl;
      }
      if (frame.annotation_image_path) {
        const { data } = await supabase.storage
          .from("deepfake-evidence")
          .createSignedUrl(frame.annotation_image_path as string, 3600);
        if (data) frame.annotation_image_url = data.signedUrl;
      }
    });
    await Promise.all(signPromises);
  }

  // Sign evidence attachment URLs for public display
  const evidence = evidenceRes.data || [];
  if (evidence.length > 0) {
    try {
      const signEvidencePromises = evidence.map(async (ev: Record<string, unknown>) => {
        if (ev.attachment_path) {
          const { data } = await supabase.storage
            .from("deepfake-evidence")
            .createSignedUrl(ev.attachment_path as string, 3600);
          if (data) ev.attachment_url = data.signedUrl;
        }
      });
      await Promise.all(signEvidencePromises);
    } catch (e) {
      console.error("[getInvestigationBySlug] evidence signing error:", e);
    }
  }

  return {
    ...investigation,
    media,
    frames,
    evidence,
    tasks: [],
    activity: [],
    reverse_search_results: searchRes.data || [],
  } as InvestigationDetail;
});

export async function createInvestigation(input: {
  title: string;
  slug: string;
  category: InvestigationCategory;
  description?: string;
  summary?: string;
  source_urls?: string[];
  geographic_context?: string;
  date_first_seen?: string;
  created_by?: string;
}): Promise<Investigation> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("deepfake_investigations")
    .insert({
      ...input,
      source_urls: input.source_urls || [],
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity(data.id, "investigation_created", input.created_by || null, {
    title: input.title,
  });

  return data as Investigation;
}

export async function updateInvestigation(
  id: string,
  updates: Partial<{
    title: string;
    slug: string;
    category: InvestigationCategory;
    status: InvestigationStatus;
    verdict: InvestigationVerdict | null;
    confidence_score: number | null;
    summary: string | null;
    methodology: string | null;
    description: string | null;
    source_urls: string[];
    geographic_context: string | null;
    date_first_seen: string | null;
  }>
): Promise<Investigation> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("deepfake_investigations")
    .update({ ...updates, updated_at: now })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (updates.verdict !== undefined) {
    await logActivity(id, "verdict_set", null, {
      verdict: updates.verdict,
      confidence_score: updates.confidence_score,
    });
  } else {
    await logActivity(id, "investigation_updated", null, {
      fields: Object.keys(updates),
    });
  }

  return data as Investigation;
}

export async function deleteInvestigation(id: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("deepfake_investigations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function publishInvestigation(id: string): Promise<Investigation> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("deepfake_investigations")
    .update({ status: "published", published_at: now, updated_at: now })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  await logActivity(id, "published", null, {});
  return data as Investigation;
}

export async function unpublishInvestigation(id: string): Promise<Investigation> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("deepfake_investigations")
    .update({ status: "draft", published_at: null, updated_at: now })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  await logActivity(id, "unpublished", null, {});
  return data as Investigation;
}

// --- Media ---

export async function addMedia(
  investigationId: string,
  input: {
    source_url: string;
    platform?: string;
    media_type?: "video" | "image" | "unknown";
  }
): Promise<InvestigationMedia> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("deepfake_media")
    .insert({
      investigation_id: investigationId,
      source_url: input.source_url,
      platform: input.platform || null,
      media_type: input.media_type || "unknown",
    })
    .select()
    .single();

  if (error) throw error;

  // Create a download task (processing is triggered by the UI via the process endpoint)
  await supabase.from("deepfake_tasks").insert({
    investigation_id: investigationId,
    media_id: data.id,
    task_type: "download_media",
  });

  await logActivity(investigationId, "media_added", null, {
    source_url: input.source_url,
    media_id: data.id,
  });

  return data as InvestigationMedia;
}

export async function getMediaForInvestigation(
  investigationId: string
): Promise<InvestigationMedia[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_media")
    .select("*")
    .eq("investigation_id", investigationId)
    .order("created_at");
  if (error) throw error;
  return (data || []) as InvestigationMedia[];
}

// --- Frames ---

export async function getFramesForInvestigation(
  investigationId: string
): Promise<InvestigationFrame[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_frames")
    .select("*")
    .eq("investigation_id", investigationId)
    .order("frame_number");
  if (error) throw error;
  return (data || []) as InvestigationFrame[];
}

export async function annotateFrame(
  frameId: string,
  updates: {
    admin_notes?: string | null;
    has_artifacts?: boolean;
    is_key_evidence?: boolean;
    drawing_data?: Record<string, unknown> | null;
    annotation_image_path?: string | null;
  }
): Promise<InvestigationFrame> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_frames")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", frameId)
    .select()
    .single();

  if (error) throw error;

  await logActivity(data.investigation_id, "frame_annotated", null, {
    frame_id: frameId,
    ...updates,
  });

  return data as InvestigationFrame;
}

// --- Evidence ---

export async function getEvidenceForInvestigation(
  investigationId: string
): Promise<InvestigationEvidence[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_evidence")
    .select("*")
    .eq("investigation_id", investigationId)
    .order("display_order");
  if (error) throw error;
  return (data || []) as InvestigationEvidence[];
}

export async function createEvidence(
  investigationId: string,
  input: {
    evidence_type: EvidenceType;
    title?: string;
    content?: string;
    external_url?: string;
    attachment_path?: string;
    display_order?: number;
    ai_detection_score?: number | null;
    ai_detection_deepfake_score?: number | null;
    ai_detection_generator?: string | null;
    frame_number?: number | null;
  }
): Promise<InvestigationEvidence> {
  const supabase = await createServiceClient();

  // Auto-set display_order if not provided
  let displayOrder = input.display_order;
  if (displayOrder === undefined) {
    const { data: existing } = await supabase
      .from("deepfake_evidence")
      .select("display_order")
      .eq("investigation_id", investigationId)
      .order("display_order", { ascending: false })
      .limit(1);
    displayOrder = existing && existing.length > 0 ? (existing[0] as { display_order: number }).display_order + 1 : 0;
  }

  const { data, error } = await supabase
    .from("deepfake_evidence")
    .insert({
      investigation_id: investigationId,
      ...input,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity(investigationId, "evidence_added", null, {
    evidence_type: input.evidence_type,
    evidence_id: data.id,
  });

  return data as InvestigationEvidence;
}

export async function updateEvidence(
  evidenceId: string,
  updates: Partial<{
    evidence_type: EvidenceType;
    title: string | null;
    content: string | null;
    external_url: string | null;
    display_order: number;
  }>
): Promise<InvestigationEvidence> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_evidence")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", evidenceId)
    .select()
    .single();

  if (error) throw error;

  await logActivity(data.investigation_id, "evidence_updated", null, {
    evidence_id: evidenceId,
  });

  return data as InvestigationEvidence;
}

export async function deleteEvidence(evidenceId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("deepfake_evidence")
    .delete()
    .eq("id", evidenceId);
  if (error) throw error;
}

// --- Reverse Search ---

export async function addSearchResult(
  investigationId: string,
  input: {
    frame_id?: string;
    engine: ReverseSearchResult["engine"];
    result_url: string;
    result_domain?: string;
    result_title?: string;
    result_date?: string;
    relevance_rating?: number;
    notes?: string;
  }
): Promise<ReverseSearchResult> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_reverse_search_results")
    .insert({
      investigation_id: investigationId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity(investigationId, "search_result_added", null, {
    engine: input.engine,
    result_url: input.result_url,
  });

  return data as ReverseSearchResult;
}

export async function deleteSearchResult(id: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("deepfake_reverse_search_results")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// --- Tasks ---

export async function getTasksForInvestigation(
  investigationId: string
): Promise<DeepfakeTask[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("deepfake_tasks")
    .select("*")
    .eq("investigation_id", investigationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DeepfakeTask[];
}

// --- Activity Log ---

export async function logActivity(
  investigationId: string,
  eventType: ActivityEventType,
  actorId: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  const supabase = await createServiceClient();
  await supabase.from("deepfake_activity_log").insert({
    investigation_id: investigationId,
    event_type: eventType,
    actor_id: actorId,
    metadata,
  });
}

// --- Public queries ---

export async function getPublishedInvestigations(): Promise<InvestigationListItem[]> {
  return getInvestigations("published");
}

/** Fetch up to 3 related published investigations, preferring same category. */
export async function getRelatedInvestigations(
  currentId: string,
  category: InvestigationCategory
): Promise<InvestigationListItem[]> {
  const supabase = await createServiceClient();

  // Try same category first
  const { data: sameCat } = await supabase
    .from("deepfake_investigations")
    .select("*")
    .eq("status", "published")
    .eq("category", category)
    .neq("id", currentId)
    .order("published_at", { ascending: false })
    .limit(3);

  const results = (sameCat || []) as Investigation[];

  // If fewer than 3, fill with other categories
  if (results.length < 3) {
    const excludeIds = [currentId, ...results.map((r) => r.id)];
    const { data: others } = await supabase
      .from("deepfake_investigations")
      .select("*")
      .eq("status", "published")
      .not("id", "in", `(${excludeIds.join(",")})`)
      .order("published_at", { ascending: false })
      .limit(3 - results.length);

    if (others) results.push(...(others as Investigation[]));
  }

  return attachCounts(supabase, results);
}
