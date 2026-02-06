import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Update display name
  if (body.display_name !== undefined) {
    const { error } = await supabase
      .from("contributors")
      .update({
        display_name: body.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity(user.id, "profile_updated", "Updated display name");
  }

  // Update notification preferences
  if (body.notifications) {
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        contributor_id: user.id,
        ...body.notifications,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
