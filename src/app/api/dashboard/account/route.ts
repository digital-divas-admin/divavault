import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/dashboard-queries";
import { z } from "zod";

const accountUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  notifications: z
    .object({
      email_photo_status: z.boolean().optional(),
      email_platform_updates: z.boolean().optional(),
      email_security_alerts: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Update display name
  if (parsed.data.display_name !== undefined) {
    const { error } = await supabase
      .from("contributors")
      .update({
        display_name: parsed.data.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Display name update error:", error.message);
      return NextResponse.json(
        { error: "Failed to update display name" },
        { status: 500 }
      );
    }

    await logActivity(user.id, "profile_updated", "Updated display name");
  }

  // Update notification preferences
  if (parsed.data.notifications) {
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        contributor_id: user.id,
        ...parsed.data.notifications,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Notification preferences error:", error.message);
      return NextResponse.json(
        { error: "Failed to update notification preferences" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
