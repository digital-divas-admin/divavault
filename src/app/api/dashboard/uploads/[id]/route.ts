import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Verify ownership
  const { data: upload } = await supabase
    .from("uploads")
    .select("id, contributor_id")
    .eq("id", id)
    .eq("contributor_id", user.id)
    .single();

  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status === "removed") {
    updateData.status = "removed";
    updateData.removed_at = new Date().toISOString();
    updateData.removal_reason = body.reason || "User requested removal";
  }

  const { error } = await supabase
    .from("uploads")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity(
    user.id,
    "photo_removed",
    "Removed a photo from future training",
    { upload_id: id, reason: body.reason }
  );

  return NextResponse.json({ success: true });
}
