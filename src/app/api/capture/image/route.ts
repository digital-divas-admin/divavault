import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
        quality_score: qualityScore || null,
        sharpness_score: sharpnessScore || null,
        brightness_score: brightnessScore || null,
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

    // Update session image count
    const { data: session } = await supabase
      .from("capture_sessions")
      .select("images_captured")
      .eq("id", sessionId)
      .single();

    if (session) {
      await supabase
        .from("capture_sessions")
        .update({ images_captured: session.images_captured + 1 })
        .eq("id", sessionId);
    }

    return NextResponse.json({ imageId: data.id });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
