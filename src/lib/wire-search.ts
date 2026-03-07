import { createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/investigation-queries";
import { extractDomain } from "@/lib/investigation-utils";

interface SerpApiResult {
  title: string;
  link: string;
  source?: string;
  displayed_link?: string;
  snippet?: string;
  thumbnail?: string;
}

/** Wire service domains to search. */
const WIRE_DOMAINS = [
  "apnews.com",
  "reuters.com",
  "afp.com",
  "factcheck.afp.com",
  "gettyimages.com",
  "aap.com.au",
  "pa.media",
  "dpa.com",
  "efe.com",
  "xinhuanet.com",
  "kyodonews.net",
  "tass.com",
];

function buildSiteQuery(domains: string[]): string {
  return domains.map((d) => `site:${d}`).join(" OR ");
}

export async function processWireSearchTask(investigationId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { data: tasks, error: taskErr } = await supabase
    .from("deepfake_tasks")
    .select("*")
    .eq("investigation_id", investigationId)
    .eq("task_type", "wire_search")
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

    const { data: investigation, error: invErr } = await supabase
      .from("deepfake_investigations")
      .select("title, geographic_context")
      .eq("id", investigationId)
      .single();

    if (invErr || !investigation) {
      throw new Error(`Investigation not found: ${investigationId}`);
    }

    // Search Google scoped to wire service domains
    const siteClause = buildSiteQuery(WIRE_DOMAINS);
    const query = `"${investigation.title}"${investigation.geographic_context ? ` ${investigation.geographic_context}` : ""} (${siteClause})`;

    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("num", "20");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SerpAPI error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const results: SerpApiResult[] = json.organic_results ?? [];

    // Delete old wire_search results before inserting new ones
    await supabase
      .from("deepfake_reverse_search_results")
      .delete()
      .eq("investigation_id", investigationId)
      .eq("engine", "wire_search");

    await Promise.all([
      results.length > 0
        ? supabase
            .from("deepfake_reverse_search_results")
            .insert(
              results.map((r) => ({
                  investigation_id: investigationId,
                  engine: "wire_search" as const,
                  result_url: r.link,
                  result_domain: extractDomain(r.link),
                  result_title: r.title,
                  thumbnail_url: r.thumbnail || null,
              }))
            )
            .then(({ error }) => {
              if (error) throw new Error(`Failed to insert wire results: ${error.message}`);
            })
        : Promise.resolve(),
      logActivity(investigationId, "wire_search_completed", null, {
        query,
        results_count: results.length,
      }),
      supabase
        .from("deepfake_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { query, results_count: results.length },
        })
        .eq("id", task.id),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`[wire-search] Task ${task.id} failed:`, message);

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
