import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const service = await createServiceClient();

  const { error: updateError } = await service
    .from("ml_recommendations")
    .update({
      status: "dismissed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: "admin",
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // Emit feedback signal
  await service.from("ml_feedback_signals").insert({
    signal_type: "recommendation_dismissed",
    entity_type: "recommendation",
    entity_id: id,
    context: { dismissed_by: user.id },
    actor: "admin",
  });

  return NextResponse.json({ success: true });
}
