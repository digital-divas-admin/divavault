import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export async function PATCH(
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

  // Get current state
  const { data: section, error: fetchError } = await service
    .from("ml_section_profiles")
    .select("scan_enabled")
    .eq("id", id)
    .single();

  if (fetchError || !section) {
    return NextResponse.json(
      { error: "Section not found" },
      { status: 404 }
    );
  }

  const newEnabled = !section.scan_enabled;

  // Toggle scan_enabled and mark as human override
  const { error: updateError } = await service
    .from("ml_section_profiles")
    .update({
      scan_enabled: newEnabled,
      human_override: true,
      last_updated_at: new Date().toISOString(),
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
    signal_type: "section_toggle",
    entity_type: "section_profile",
    entity_id: id,
    context: { scan_enabled: newEnabled, toggled_by: "admin" },
    actor: "admin",
  });

  return NextResponse.json({ success: true, scan_enabled: newEnabled });
}
