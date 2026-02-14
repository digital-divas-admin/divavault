import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-queries";

export async function POST() {
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

  try {
    const service = await createServiceClient();
    const { error } = await service.from("scan_jobs").insert({
      scan_type: "ad_intel",
      status: "pending",
      images_processed: 0,
      matches_found: 0,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trigger failed" },
      { status: 500 }
    );
  }
}
