import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/investigation-queries";
import { CORROBORATION_ENGINES } from "@/lib/investigation-utils";

interface TriageResult {
  triaged: number;
  high: number;
  medium: number;
  low: number;
}

interface TriageItem {
  id: string;
  relevance: "high" | "medium" | "low";
  reason: string;
}

// parseTriageNote lives in investigation-utils.ts (client-safe) to avoid pulling server deps into client components

export async function triageCorroborationResults(
  investigationId: string
): Promise<TriageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const service = await createServiceClient();

  // 1. Fetch investigation context
  const { data: investigation, error: invError } = await service
    .from("deepfake_investigations")
    .select("title, summary, category, geographic_context")
    .eq("id", investigationId)
    .single();

  if (invError || !investigation) {
    throw new Error("Investigation not found");
  }

  // 2. Fetch unreviewed corroboration results (notes doesn't start with [AI:)
  const { data: allResults, error: resultsError } = await service
    .from("deepfake_reverse_search_results")
    .select("id, result_title, result_domain, result_url, engine, notes")
    .eq("investigation_id", investigationId)
    .in("engine", [...CORROBORATION_ENGINES]);

  if (resultsError) {
    throw new Error(`Failed to fetch results: ${resultsError.message}`);
  }

  // Filter out already-triaged results
  const untriaged = (allResults || []).filter(
    (r) => !r.notes?.startsWith("[AI:")
  );

  if (untriaged.length === 0) {
    return { triaged: 0, high: 0, medium: 0, low: 0 };
  }

  // Cap at 500 results per triage call to stay within token limits
  const batch = untriaged.slice(0, 500);

  // 3. Build prompt
  const resultsList = batch
    .map(
      (r, i) =>
        `${i + 1}. [${r.id}] "${r.result_title || "Untitled"}" — ${r.result_domain || "unknown domain"} (${r.engine}) ${r.result_url}`
    )
    .join("\n");

  const systemPrompt =
    "You are a media forensics analyst triaging corroboration search results for a deepfake investigation. Respond only with valid JSON.";

  const userPrompt = `Investigation context:
- Title: ${investigation.title}
- Summary: ${investigation.summary || "N/A"}
- Category: ${investigation.category}
- Geographic context: ${investigation.geographic_context || "N/A"}

Below are ${batch.length} search results to triage. For each result, assess its relevance to this specific investigation:
- high = directly shows, discusses, or covers this specific media/event/incident
- medium = related topic, same region, or adjacent story but not a direct match
- low = unrelated, spam, or generic content

Results:
${resultsList}

Return a JSON array with one object per result:
[{ "id": "uuid", "relevance": "high"|"medium"|"low", "reason": "brief explanation" }]`;

  // 4. Call Claude Haiku
  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  // 5. Parse response
  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON array from response (handle markdown code blocks, truncation)
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("[ai-triage] Could not extract JSON array. Response length:", responseText.length, "Stop reason:", message.stop_reason);
    throw new Error("Failed to parse AI triage response");
  }

  let triageItems: TriageItem[];
  try {
    triageItems = JSON.parse(jsonMatch[0]);
  } catch {
    // Response may have been truncated — try to salvage by closing the array
    const salvaged = jsonMatch[0].replace(/,?\s*\{[^}]*$/, "") + "]";
    triageItems = JSON.parse(salvaged);
    console.warn("[ai-triage] Salvaged truncated JSON, got", triageItems.length, "items");
  }

  // 6. Batch-update results in parallel (chunks of 50 to avoid connection pressure)
  const counts = { triaged: 0, high: 0, medium: 0, low: 0 };
  const CHUNK_SIZE = 50;

  for (let i = 0; i < triageItems.length; i += CHUNK_SIZE) {
    const chunk = triageItems.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((item) =>
        service
          .from("deepfake_reverse_search_results")
          .update({ notes: `[AI:${item.relevance}] ${item.reason}` })
          .eq("id", item.id)
          .then(({ error }) => (error ? null : item))
      )
    );
    for (const item of results) {
      if (item) {
        counts.triaged++;
        counts[item.relevance]++;
      }
    }
  }

  // 7. Log activity
  await logActivity(investigationId, "ai_triage_completed", null, {
    triaged: counts.triaged,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
  });

  return counts;
}
