import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";
import { resetFaceSearched, logAdIntelActivity } from "@/lib/ad-intel-admin-queries";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ faceId: string }> }
) {
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

  const { faceId } = await params;

  try {
    await resetFaceSearched(faceId);

    await logAdIntelActivity({
      event_type: "face_searched",
      stage: "search",
      title: "Face stock search triggered",
      description: `Manually triggered stock search for face ${faceId.slice(0, 8)}...`,
      metadata: { face_id: faceId },
      actor_id: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to trigger search" },
      { status: 500 }
    );
  }
}
