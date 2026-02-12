import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CAPTURE_STEPS } from "@/lib/capture-steps";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const captureStep = formData.get("captureStep") as string | null;

  if (!file || !captureStep) {
    return NextResponse.json(
      { error: "Missing required fields: file, captureStep" },
      { status: 400 }
    );
  }

  const validStepIds = CAPTURE_STEPS.map((s) => s.id);
  if (!validStepIds.includes(captureStep as (typeof validStepIds)[number])) {
    return NextResponse.json(
      { error: "Invalid captureStep" },
      { status: 400 }
    );
  }

  try {
    // Find or create a supplemental capture session
    const { data: existingSession } = await supabase
      .from("capture_sessions")
      .select("id")
      .eq("contributor_id", user.id)
      .eq("session_type", "supplemental")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionId: string;

    if (existingSession) {
      sessionId = existingSession.id;
    } else {
      const { data: newSession, error: sessionError } = await supabase
        .from("capture_sessions")
        .insert({
          contributor_id: user.id,
          session_type: "supplemental",
          status: "active",
          images_captured: 0,
          images_required: 10,
        })
        .select("id")
        .single();

      if (sessionError || !newSession) {
        console.error("Create supplemental session error:", sessionError?.message);
        return NextResponse.json(
          { error: "Failed to create capture session" },
          { status: 500 }
        );
      }
      sessionId = newSession.id;
    }

    // Upload file to capture-uploads bucket
    const timestamp = Date.now();
    const filePath = `${user.id}/${sessionId}/${captureStep}-${timestamp}.jpg`;
    const bucket = "capture-uploads";

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError.message);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Insert into contributor_images
    const { data: imageRecord, error: imageError } = await supabase
      .from("contributor_images")
      .insert({
        contributor_id: user.id,
        session_id: sessionId,
        capture_step: captureStep,
        file_path: filePath,
        bucket,
        file_size: file.size || null,
      })
      .select("id")
      .single();

    if (imageError || !imageRecord) {
      console.error("Insert image error:", imageError?.message);
      return NextResponse.json(
        { error: "Failed to save image record" },
        { status: 500 }
      );
    }

    // Also insert into uploads table (dual-insert pattern)
    const { error: uploadRecordError } = await supabase.from("uploads").insert({
      contributor_id: user.id,
      source: "capture",
      file_path: filePath,
      bucket,
      file_size: file.size || null,
      status: "processing",
    });

    if (uploadRecordError) {
      console.error("Insert upload record error:", uploadRecordError.message);
    }

    // Update session image count
    const { count } = await supabase
      .from("contributor_images")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (count !== null) {
      await supabase
        .from("capture_sessions")
        .update({ images_captured: count })
        .eq("id", sessionId);
    }

    // Generate signed URL for immediate display
    const { data: signedUrlData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600);

    return NextResponse.json({
      imageId: imageRecord.id,
      signedUrl: signedUrlData?.signedUrl || null,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
