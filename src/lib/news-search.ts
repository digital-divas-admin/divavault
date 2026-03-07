import { createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/investigation-queries";
import { extractDomain } from "@/lib/investigation-utils";

interface SerpApiNewsResult {
  title: string;
  link: string;
  source: string;
  date?: string;
  snippet?: string;
  thumbnail?: string;
}

export async function processNewsSearchTask(investigationId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Claim the pending news_search task
  const { data: tasks, error: taskErr } = await supabase
    .from("deepfake_tasks")
    .select("*")
    .eq("investigation_id", investigationId)
    .eq("task_type", "news_search")
    .in("status", ["pending", "failed"])
    .order("created_at")
    .limit(1);

  if (taskErr) throw taskErr;
  if (!tasks || tasks.length === 0) return;

  const task = tasks[0];

  try {
    await supabase
      .from("deepfake_tasks")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", task.id);

    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      await supabase
        .from("deepfake_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { skipped: true, reason: "SERPAPI_API_KEY not configured" },
        })
        .eq("id", task.id);
      return;
    }

    // Fetch investigation title + region
    const { data: investigation, error: invErr } = await supabase
      .from("deepfake_investigations")
      .select("title, geographic_context")
      .eq("id", investigationId)
      .single();

    if (invErr || !investigation) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }

    // Build search query like the scanner does
    const query = `"${investigation.title}"${investigation.geographic_context ? ` ${investigation.geographic_context}` : ""}`;

    // Call SerpAPI Google News
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google");
    url.searchParams.set("tbm", "nws");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("num", "20");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SerpAPI error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const newsResults: SerpApiNewsResult[] = json.news_results ?? [];

    // Delete old news_search results before inserting new ones
    await supabase
      .from("deepfake_reverse_search_results")
      .delete()
      .eq("investigation_id", investigationId)
      .eq("engine", "news_search");

    // Insert results, log activity, and mark task complete in parallel
    await Promise.all([
      newsResults.length > 0
        ? supabase
            .from("deepfake_reverse_search_results")
            .insert(
              newsResults.map((r) => ({
                  investigation_id: investigationId,
                  engine: "news_search" as const,
                  result_url: r.link,
                  result_domain: extractDomain(r.link),
                  result_title: r.title,
                  result_date: r.date && !isNaN(Date.parse(r.date)) ? r.date : null,
                  thumbnail_url: r.thumbnail || null,
              }))
            )
            .then(({ error }) => {
              if (error) throw new Error(`Failed to insert news results: ${error.message}`);
            })
        : Promise.resolve(),
      logActivity(investigationId, "news_search_completed", null, {
        query,
        results_count: newsResults.length,
      }),
      supabase
        .from("deepfake_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { query, results_count: newsResults.length },
        })
        .eq("id", task.id),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`[news-search] Task ${task.id} failed:`, message);

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
