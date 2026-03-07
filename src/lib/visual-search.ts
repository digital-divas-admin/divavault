import { createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/investigation-queries";
import { extractDomain } from "@/lib/investigation-utils";

interface SerpApiVisualMatch {
  position: number;
  title: string;
  link: string;
  source: string;
  thumbnail?: string;
}

/** Maximum number of frames to process (saves API calls). */
const MAX_FRAMES = 3;

export async function processVisualSearchTasks(investigationId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Check API key early, before any DB mutations
  const apiKey = process.env.SERPAPI_API_KEY;

  // Single query for all pending tasks — split into process vs excess in code
  const { data: allTasks, error: taskErr } = await supabase
    .from("deepfake_tasks")
    .select("*")
    .eq("investigation_id", investigationId)
    .eq("task_type", "visual_search")
    .in("status", ["pending", "failed"])
    .order("created_at");

  if (taskErr) throw taskErr;
  if (!allTasks || allTasks.length === 0) return;

  const tasks = allTasks.slice(0, MAX_FRAMES);
  const excessIds = allTasks.slice(MAX_FRAMES).map((t) => t.id);

  // Cancel excess tasks beyond limit
  if (excessIds.length > 0) {
    await supabase
      .from("deepfake_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString(), error_message: "Skipped — sample limit reached" })
      .in("id", excessIds);
  }

  // If no API key, mark all tasks as skipped and return early
  if (!apiKey) {
    for (const task of tasks) {
      await supabase
        .from("deepfake_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { skipped: true, reason: "SERPAPI_API_KEY not configured" },
        })
        .eq("id", task.id);
    }
    return;
  }

  // Collect successful results, then delete+insert after loop to avoid partial data loss
  const allResults: Array<{
    investigation_id: string;
    frame_id: string;
    engine: "google_lens";
    result_url: string;
    result_domain: string;
    result_title: string | null;
    thumbnail_url: string | null;
  }> = [];
  let successCount = 0;

  // Process sequentially to avoid rate limits
  for (const task of tasks) {
    try {
      // Claim task
      await supabase
        .from("deepfake_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task.id);

      if (!task.frame_id) {
        throw new Error("visual_search task has no frame_id");
      }

      // Get frame record
      const { data: frame, error: frameErr } = await supabase
        .from("deepfake_frames")
        .select("*")
        .eq("id", task.frame_id)
        .single();

      if (frameErr || !frame) {
        throw new Error(`Frame not found: ${task.frame_id}`);
      }

      // Generate signed URL for the frame image
      const { data: signedData, error: signErr } = await supabase.storage
        .from("deepfake-evidence")
        .createSignedUrl(frame.storage_path, 600);

      if (signErr || !signedData) {
        throw new Error(`Failed to sign frame URL: ${signErr?.message}`);
      }

      // Call SerpAPI Google Lens
      const url = new URL("https://serpapi.com/search");
      url.searchParams.set("engine", "google_lens");
      url.searchParams.set("url", signedData.signedUrl);
      url.searchParams.set("api_key", apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`SerpAPI Google Lens error ${res.status}: ${text}`);
      }

      const json = await res.json();
      const visualMatches: SerpApiVisualMatch[] = json.visual_matches ?? [];

      // Collect results for batch insert after loop
      for (const match of visualMatches) {
        allResults.push({
          investigation_id: investigationId,
          frame_id: task.frame_id,
          engine: "google_lens",
          result_url: match.link,
          result_domain: extractDomain(match.link),
          result_title: match.title || null,
          thumbnail_url: match.thumbnail || null,
        });
      }

      // Mark task completed
      await supabase
        .from("deepfake_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { frame_number: frame.frame_number, matches_count: visualMatches.length },
        })
        .eq("id", task.id);

      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(`[visual-search] Task ${task.id} failed:`, message);

      await supabase
        .from("deepfake_tasks")
        .update({
          status: "failed",
          error_message: message,
          retry_count: (task.retry_count || 0) + 1,
          completed_at: new Date().toISOString(),
        })
        .eq("id", task.id);
    }
  }

  // Only delete old results and insert new ones if we had at least one success
  if (successCount > 0) {
    await supabase
      .from("deepfake_reverse_search_results")
      .delete()
      .eq("investigation_id", investigationId)
      .eq("engine", "google_lens");

    if (allResults.length > 0) {
      const { error: insertErr } = await supabase
        .from("deepfake_reverse_search_results")
        .insert(allResults);

      if (insertErr) {
        console.error("[visual-search] Failed to insert results:", insertErr.message);
      }
    }

    await logActivity(investigationId, "visual_search_completed", null, {
      results_count: allResults.length,
      frames_searched: successCount,
    });
  }
}
