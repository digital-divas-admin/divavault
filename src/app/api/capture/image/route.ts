import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CAPTURE_STEPS } from "@/lib/capture-steps";
import { dispatchWebhook } from "@/lib/webhooks";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body.sessionId as string;
  const captureStep = body.captureStep as string;
  const filePath = body.filePath as string;
  const bucket = (body.bucket as string) || "capture-uploads";
  const fileSize = body.fileSize as number | undefined;
  const width = body.width as number | undefined;
  const height = body.height as number | undefined;
  const qualityScore = body.qualityScore as number | undefined;
  const sharpnessScore = body.sharpnessScore as number | undefined;
  const brightnessScore = body.brightnessScore as number | undefined;

  if (!sessionId || !captureStep || !filePath) {
    return NextResponse.json(
      { error: "Missing required fields: sessionId, captureStep, filePath" },
      { status: 400 }
    );
  }

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

  // Clamp score values to 0-1 range
  const clamp = (v: number | undefined) => v != null ? Math.max(0, Math.min(1, v)) : null;
  const clampedQualityScore = clamp(qualityScore);
  const clampedSharpnessScore = clamp(sharpnessScore);
  const clampedBrightnessScore = clamp(brightnessScore);

  try {
    const { data, error } = await supabase
      .from("contributor_images")
      .insert({
        contributor_id: user.id,
        session_id: sessionId,
        capture_step: captureStep,
        file_path: filePath,
        bucket,
        file_size: fileSize || null,
        width: width || null,
        height: height || null,
        quality_score: clampedQualityScore,
        sharpness_score: clampedSharpnessScore,
        brightness_score: clampedBrightnessScore,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Insert image error:", error.message);
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
      console.error("Insert upload record error:", uploadError.message);
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
        console.error("Session count update error:", updateError.message);
      }
    }

    // Dispatch webhook (fire and forget)
    dispatchWebhook("contributor.photos_added", {
      contributor_id: user.id,
      session_id: sessionId,
      image_id: data.id,
      capture_step: captureStep,
      total_images: count ?? 1,
    }).catch((err) => console.error("Webhook dispatch error:", err));

    return NextResponse.json({ imageId: data.id });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
