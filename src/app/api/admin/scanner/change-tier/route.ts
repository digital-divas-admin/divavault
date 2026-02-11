import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { changeTierSchema } from "@/lib/scanner-test-validators";

const TIER_INTERVALS: Record<string, number> = {
  free: 168,
  protected: 72,
  premium: 24,
};

const SCAN_TYPES = ["face_match", "reverse_image", "ai_detection"];

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

  const parsed = changeTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { contributorId, tier } = parsed.data;
  const service = await createServiceClient();

  try {
    // Update contributor tier
    const { error: updateErr } = await service
      .from("contributors")
      .update({ subscription_tier: tier })
      .eq("id", contributorId);

    if (updateErr) throw updateErr;

    // Upsert scan schedules with new tier intervals
    const interval = TIER_INTERVALS[tier] || 168;

    for (const scanType of SCAN_TYPES) {
      await service.from("scan_schedule").upsert(
        {
          contributor_id: contributorId,
          scan_type: scanType,
          scan_interval_hours: interval,
        },
        { onConflict: "contributor_id,scan_type" }
      );
    }

    return NextResponse.json({ success: true, tier, interval });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tier change failed" },
      { status: 500 }
    );
  }
}
