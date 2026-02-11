import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { triggerScanSchema } from "@/lib/scanner-test-validators";

const SCAN_TYPES = ["face_match", "reverse_image", "ai_detection"];

const TIER_INTERVALS: Record<string, number> = {
  free: 168,
  protected: 72,
  premium: 24,
};

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = triggerScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { contributorId, scanType } = parsed.data;
  const service = await createServiceClient();

  try {
    // Get contributor tier for default interval
    const { data: contributor } = await service
      .from("contributors")
      .select("subscription_tier")
      .eq("id", contributorId)
      .single();

    const tier = contributor?.subscription_tier || "free";
    const interval = TIER_INTERVALS[tier] || 168;

    const typesToTrigger = scanType ? [scanType] : SCAN_TYPES;

    for (const type of typesToTrigger) {
      await service.from("scan_schedule").upsert(
        {
          contributor_id: contributorId,
          scan_type: type,
          next_scan_at: new Date().toISOString(),
          scan_interval_hours: interval,
          priority: 10,
        },
        { onConflict: "contributor_id,scan_type" }
      );
    }

    return NextResponse.json({ success: true, triggered: typesToTrigger });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trigger failed" },
      { status: 500 }
    );
  }
}
