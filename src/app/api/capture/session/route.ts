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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Allow empty body for session creation
  }

  const sessionType = (body.sessionType as string) || "onboarding";
  const deviceInfo = body.deviceInfo || null;

  try {
    // Ensure contributor row exists
    await supabase
      .from("contributors")
      .upsert(
        { id: user.id, email: user.email ?? "" },
        { onConflict: "id" }
      );

    const { data, error } = await supabase
      .from("capture_sessions")
      .insert({
        contributor_id: user.id,
        session_type: sessionType,
        status: "active",
        device_info: deviceInfo,
        images_captured: 0,
        images_required: 9,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Create session error:", error.message);
      return NextResponse.json(
        { error: "Failed to create capture session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: data.id });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
  const status = body.status as string;
  const imagesCaptured = body.imagesCaptured as number | undefined;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (imagesCaptured !== undefined) updateData.images_captured = imagesCaptured;
    if (status === "completed") updateData.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("capture_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .eq("contributor_id", user.id);

    if (error) {
      console.error("Update session error:", error.message);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }

    // If completed, also mark capture_completed on contributor
    if (status === "completed") {
      await supabase
        .from("contributors")
        .update({
          capture_completed: true,
          current_onboarding_step: 5,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
