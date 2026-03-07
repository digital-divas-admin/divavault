import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CAPTURE_STEPS } from "@/lib/capture-steps";
import { dispatchWebhook } from "@/lib/webhooks";
import { z } from "zod/v4";
import { logApiError } from "@/lib/api-logger";

const captureImageSchema = z.object({
  sessionId: z.string().uuid(),
  captureStep: z.string(),
  filePath: z.string().min(1),
  bucket: z.string().optional().default("capture-uploads"),
  fileSize: z.number().int().min(0).optional(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  sharpnessScore: z.number().min(0).max(1).optional(),
  brightnessScore: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = captureImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const {
    sessionId,
    captureStep,
    filePath,
    bucket,
    fileSize,
    width,
    height,
    qualityScore,
    sharpnessScore,
    brightnessScore,
  } = parsed.data;

  // Validate captureStep against known steps
  const validStepIds = CAPTURE_STEPS.map((s) => s.id);
  if (!validStepIds.includes(captureStep as (typeof validStepIds)[number])) {
    return NextResponse.json(
      { error: "Invalid captureStep" },
      { status: 400 }
    );
  }

  // Sanitize filePath — must match expected pattern and not contain traversal
  if (filePath.includes("..") || filePath.startsWith("/") || !/^[a-zA-Z0-9\-_/.]+$/.test(filePath)) {
    return NextResponse.json(
      { error: "Invalid filePath" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("contributor_images")
      .insert({
        contributor_id: user.id,
        session_id: sessionId,
        capture_step: captureStep,
        file_path: filePath,
        bucket,
        file_size: fileSize ?? null,
        width: width ?? null,
        height: height ?? null,
        quality_score: qualityScore ?? null,
        sharpness_score: sharpnessScore ?? null,
        brightness_score: brightnessScore ?? null,
      })
      .select("id")
      .single();

    if (error) {
      logApiError("POST", "/api/capture/image", "insert image record", error);
      return NextResponse.json(
        { error: "Failed to save image record" },
        { status: 500 }
      );
    }

    // Also insert into uploads table so dashboard queries can find these photos
    const { error: uploadError } = await supabase.from("uploads").insert({
      contributor_id: user.id,
      source: "capture",
      file_path: filePath,
      bucket,
      file_size: fileSize || null,
      status: "processing",
    });

    if (uploadError) {
      logApiError("POST", "/api/capture/image", "insert upload record", uploadError);
    }

    // Update session image count using actual DB count for accuracy
    const { count, error: countError } = await supabase
      .from("contributor_images")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (!countError && count !== null) {
      const { error: updateError } = await supabase
        .from("capture_sessions")
        .update({ images_captured: count })
        .eq("id", sessionId);

      if (updateError) {
        logApiError("POST", "/api/capture/image", "session count update", updateError);
      }
    }

    // Dispatch webhook (fire and forget)
    dispatchWebhook("contributor.photos_added", {
      contributor_id: user.id,
      session_id: sessionId,
      image_id: data.id,
      capture_step: captureStep,
      total_images: count ?? 1,
    }).catch((err) => logApiError("POST", "/api/capture/image", "webhook dispatch", err));

    return NextResponse.json({ imageId: data.id });
  } catch (e) {
    logApiError("POST", "/api/capture/image", "unexpected error", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
