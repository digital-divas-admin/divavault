import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { logAdIntelActivity } from "@/lib/ad-intel-admin-queries";

const VALID_STAGES = ["discover", "detect", "describe", "search", "match"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await requireAdmin(user.id, "admin");
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let stage: string | null = null;
  try {
    const body = await request.json();
    if (body.stage) {
      if (!VALID_STAGES.includes(body.stage)) {
        return NextResponse.json(
          { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}` },
          { status: 400 }
        );
      }
      stage = body.stage;
    }
  } catch {
    // No body is fine — means full pipeline
  }

  try {
    const service = await createServiceClient();
    const { error } = await service.from("scan_jobs").insert({
      scan_type: "ad_intel",
      status: "pending",
      stage: stage,
      images_processed: 0,
      matches_found: 0,
    });

    if (error) throw new Error(error.message);

    await logAdIntelActivity({
      event_type: "scan_triggered",
      stage: stage || undefined,
      title: stage ? `${stage} stage triggered` : "Full pipeline triggered",
      description: stage
        ? `Manually triggered the ${stage} stage`
        : "Manually triggered full pipeline scan",
      actor_id: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trigger failed" },
      { status: 500 }
    );
  }
}
