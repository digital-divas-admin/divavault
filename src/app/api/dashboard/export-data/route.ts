import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [contributor, uploads, activityLog] = await Promise.all([
    supabase.from("contributors").select("*").eq("id", user.id).single(),
    supabase
      .from("uploads")
      .select("id, source, file_path, file_size, bucket, status, created_at, removed_at, removal_reason")
      .eq("contributor_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select("action, description, created_at")
      .eq("contributor_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: contributor.data
      ? {
          full_name: contributor.data.full_name,
          email: contributor.data.email,
          display_name: contributor.data.display_name,
          verification_status: contributor.data.verification_status,
          instagram_username: contributor.data.instagram_username,
          photo_count: contributor.data.photo_count,
          consent_given: contributor.data.consent_given,
          consent_timestamp: contributor.data.consent_timestamp,
          consent_version: contributor.data.consent_version,
          consent_details: contributor.data.consent_details,
          opted_out: contributor.data.opted_out,
          opted_out_at: contributor.data.opted_out_at,
          created_at: contributor.data.created_at,
        }
      : null,
    photos: uploads.data || [],
    activity_log: activityLog.data || [],
  };

  await logActivity(user.id, "data_export", "Exported personal data");

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="madeofus-data-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
