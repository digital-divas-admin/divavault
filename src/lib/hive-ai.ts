import { createServiceClient } from "@/lib/supabase/server";
import { createEvidence, logActivity } from "@/lib/investigation-queries";
import { analyzeWithSentinel, type SentinelDetectionResult } from "@/lib/sentinel-detection";

// --- Types ---

export interface HiveDetectionResult {
  ai_generated_score: number;
  deepfake_score: number;
  top_generator: string | null;
  top_generator_score: number;
  all_generators: Record<string, number>;
  raw_classes: Array<{ class: string; score: number }>;
}

// Known AI generator class names from Hive's model (normalized: lowercase, underscores)
function normalizeClassName(name: string): string {
  return name.toLowerCase().replace(/-/g, "_");
}

const GENERATOR_NAMES = [
  "midjourney",
  "stable_diffusion",
  "stablediffusion",
  "dall-e",
  "flux",
  "ideogram",
  "firefly",
  "sora",
  "kling",
  "runway",
  "pika",
  "luma",
  "imagen",
  "kandinsky",
  "playground",
  "sd_xl",
  "sdxl",
  "stable_diffusion_xl",
  "leonardo",
  "deepfloyd",
  "wuerstchen",
];

const GENERATOR_CLASSES = new Set(GENERATOR_NAMES.map(normalizeClassName));

/** Maximum number of frames to analyze per investigation (saves API calls). */
const MAX_FRAMES_TO_ANALYZE = 3;

// --- Hive API ---

export async function analyzeWithHive(imageUrl: string): Promise<HiveDetectionResult> {
  const apiKey = process.env.HIVE_API_KEY;
  if (!apiKey) throw new Error("HIVE_API_KEY not configured");

  const res = await fetch(
    "https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: [{ media_url: imageUrl }] }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hive API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const classes: Array<{ class: string; value: number }> =
    json?.output?.[0]?.classes ?? [];

  if (classes.length === 0) {
    throw new Error("Hive API returned no detection classes");
  }

  // Extract key scores
  let aiGeneratedScore = 0;
  let deepfakeScore = 0;
  const generators: Record<string, number> = {};
  let topGenerator: string | null = null;
  let topGeneratorScore = 0;

  for (const c of classes) {
    const normalized = normalizeClassName(c.class);

    if (normalized === "ai_generated") {
      aiGeneratedScore = c.value;
    } else if (normalized === "deepfake") {
      deepfakeScore = c.value;
    } else if (normalized === "not_ai_generated") {
      // If ai_generated wasn't found explicitly, derive it
      if (aiGeneratedScore === 0) aiGeneratedScore = 1 - c.value;
    } else if (normalized === "none" || normalized.endsWith("_audio")) {
      // Skip "none" class and audio-specific classes
    } else if (GENERATOR_CLASSES.has(normalized)) {
      generators[c.class] = c.value;
      if (c.value > topGeneratorScore) {
        topGenerator = c.class;
        topGeneratorScore = c.value;
      }
    }
  }

  return {
    ai_generated_score: aiGeneratedScore,
    deepfake_score: deepfakeScore,
    top_generator: topGenerator,
    top_generator_score: topGeneratorScore,
    all_generators: generators,
    raw_classes: classes.map(c => ({ class: c.class, score: c.value })),
  };
}

// --- Orchestrator ---

export async function processAiDetectionTasks(investigationId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Get pending/failed ai_detection tasks for this investigation
  const { data: tasks, error: taskErr } = await supabase
    .from("deepfake_tasks")
    .select("*")
    .eq("investigation_id", investigationId)
    .eq("task_type", "ai_detection")
    .in("status", ["pending", "failed"])
    .order("created_at")
    .limit(MAX_FRAMES_TO_ANALYZE);

  if (taskErr) throw taskErr;
  if (!tasks || tasks.length === 0) return;

  // Cancel any excess tasks beyond our limit
  const { data: allPending } = await supabase
    .from("deepfake_tasks")
    .select("id")
    .eq("investigation_id", investigationId)
    .eq("task_type", "ai_detection")
    .in("status", ["pending", "failed"])
    .order("created_at");

  if (allPending && allPending.length > MAX_FRAMES_TO_ANALYZE) {
    const excessIds = allPending.slice(MAX_FRAMES_TO_ANALYZE).map((t) => t.id);
    await supabase
      .from("deepfake_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString(), error_message: "Skipped — sample limit reached" })
      .in("id", excessIds);
  }

  // Collect per-frame results
  const frameResults: Array<{
    frameNumber: number;
    result: HiveDetectionResult;
    sentinelResult: SentinelDetectionResult | null;
  }> = [];

  // Process sequentially to avoid Hive API rate limits
  for (const task of tasks) {
    try {
      // Claim task
      await supabase
        .from("deepfake_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task.id);

      if (!task.frame_id) {
        throw new Error("ai_detection task has no frame_id");
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

      // Call Hive and Sentinel in parallel (Hive = network API, Sentinel = local subprocess)
      const [result, sentinelResult] = await Promise.all([
        analyzeWithHive(signedData.signedUrl),
        analyzeWithSentinel(signedData.signedUrl).catch((err) => {
          console.warn("[hive-ai] Sentinel analysis failed, continuing with Hive only:", err);
          return null;
        }),
      ]);

      // Store result in task
      await supabase
        .from("deepfake_tasks")
        .update({
          status: "completed",
          result: {
            ...(result as unknown as Record<string, unknown>),
            sentinel: sentinelResult,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      frameResults.push({ frameNumber: frame.frame_number, result, sentinelResult });

      await logActivity(investigationId, "ai_detection_completed", null, {
        frame_id: task.frame_id,
        frame_number: frame.frame_number,
        ai_generated_score: result.ai_generated_score,
        top_generator: result.top_generator,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(`[hive-ai] Task ${task.id} failed:`, message);

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

  if (frameResults.length === 0) return;

  // Delete any old ai_detection evidence for this investigation before creating new
  await supabase
    .from("deepfake_evidence")
    .delete()
    .eq("investigation_id", investigationId)
    .eq("evidence_type", "ai_detection");

  // Create one evidence record per analyzed frame (the public page aggregates them)
  for (const { frameNumber, result, sentinelResult } of frameResults) {
    await createEvidence(investigationId, {
      evidence_type: "ai_detection",
      title: `AI Detection — Frame #${frameNumber}`,
      content: `AI Generated: ${(result.ai_generated_score * 100).toFixed(1)}%${result.top_generator ? ` | Generator: ${result.top_generator}` : ""}${sentinelResult ? ` | Sentinel: ${sentinelResult.prediction} (${(sentinelResult.p_ai * 100).toFixed(1)}%)` : ""}`,
      ai_detection_score: result.ai_generated_score,
      ai_detection_deepfake_score: result.deepfake_score,
      ai_detection_generator: result.top_generator,
      frame_number: frameNumber,
      sentinel_score: sentinelResult?.p_ai ?? null,
      sentinel_classification: sentinelResult?.prediction ?? null,
      detection_sources: [
        "hive",
        ...(sentinelResult ? ["sentinel"] : []),
      ],
    });
  }
}
